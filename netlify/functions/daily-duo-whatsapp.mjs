/**
 * Daily Duo WhatsApp Cloud API reminder dispatcher.
 * Netlify scheduled functions run in UTC. We compute each member's local clock.
 * No secrets are exposed to browser code.
 * At most one send attempt per user and Daily Duo day is reserved in Supabase.
 */
export const config = { schedule: "*/15 * * * *" };

const needed = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_GRAPH_VERSION",
  "WHATSAPP_TEMPLATE_NAME",
  "WHATSAPP_TEMPLATE_LANGUAGE",
];

function contextClock(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const field = type => parts.find(p => p.type === type)?.value;
  return {
    date: [field("year"), field("month"), field("day")].join("-"),
    minuteOfDay: Number(field("hour")) * 60 + Number(field("minute")),
  };
}

async function db(endpoint, { method = "GET", body, prefer } = {}) {
  const base = process.env.SUPABASE_URL.replace(/\/$/, "");
  const result = await fetch(base + "/rest/v1/" + endpoint, {
    method,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  const raw = await result.text();
  if (!result.ok) {
    throw new Error("Supabase " + method + " " + result.status + " at " + endpoint.split("?")[0]);
  }
  return raw ? JSON.parse(raw) : null;
}

async function recordStatus(userId, date, status, extra = {}) {
  const query = "daily_duo_whatsapp_deliveries?user_id=eq." +
    encodeURIComponent(userId) + "&task_date=eq." + encodeURIComponent(date);
  await db(query, {
    method: "PATCH",
    body: { status, updated_at: new Date().toISOString(), ...extra },
    prefer: "return=minimal",
  });
}

async function processPreference(pref, now) {
  if (!pref.enabled || !pref.consented_at) return "not-consented";
  if (!/^\+[1-9][0-9]{7,14}$/.test(pref.phone_e164)) return "invalid-number";

  let local;
  let sofia;
  try {
    local = contextClock(now, pref.time_zone);
    sofia = contextClock(now, "Europe/Sofia");
  } catch {
    return "invalid-timezone";
  }
  const match = /^(\d\d):(\d\d)/.exec(pref.reminder_time || "");
  if (!match) return "invalid-time";
  const targetMinute = Number(match[1]) * 60 + Number(match[2]);
  const elapsed = local.minuteOfDay - targetMinute;
  // Run each 15 minutes; tolerate a slightly delayed scheduled invocation.
  if (elapsed < 0 || elapsed >= 30) return "not-due";

  // A reminder may only be sent to someone who is still in that duo.
  const membership = await db(
    "duo_members?select=user_id&user_id=eq." +
    encodeURIComponent(pref.user_id) + "&duo_id=eq." +
    encodeURIComponent(pref.duo_id) + "&limit=1"
  );
  if (!membership?.length) return "not-member";

  const created = await db("rpc/daily_duo_reminder_ensure_task", {
    method: "POST",
    body: { p_duo_id: pref.duo_id, p_task_date: sofia.date },
  });
  if (typeof created !== "string") throw new Error("Unable to resolve daily task ID");

  const checks = await db(
    "task_completions?select=user_id&task_id=eq." +
    encodeURIComponent(created) + "&user_id=eq." +
    encodeURIComponent(pref.user_id) + "&limit=1"
  );
  if (checks?.length) return "completed";

  // Ignore duplicate reservations so overlapping runs cannot double-send.
  const reserved = await db(
    "daily_duo_whatsapp_deliveries?on_conflict=user_id,task_date",
    {
      method: "POST",
      body: [{
        user_id: pref.user_id,
        duo_id: pref.duo_id,
        task_date: sofia.date,
        status: "reserved",
      }],
      prefer: "resolution=ignore-duplicates,return=representation",
    }
  );
  if (!Array.isArray(reserved) || reserved.length === 0) return "already-attempted";

  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION;
  const url = "https://graph.facebook.com/" + graphVersion + "/" +
    encodeURIComponent(process.env.WHATSAPP_PHONE_NUMBER_ID) + "/messages";
  let status = "failed";
  let errorCode = null;
  let messageId = null;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.WHATSAPP_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: pref.phone_e164.replace(/^\+/, ""),
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE_NAME,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE },
        },
      }),
      signal: AbortSignal.timeout(10000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.messages?.[0]?.id) {
      // Only store a provider error code, never the message body or phone number.
      errorCode = String(payload.error?.code ?? "HTTP_" + response.status).slice(0, 60);
    } else {
      status = "sent";
      messageId = String(payload.messages[0].id).slice(0, 250);
    }
  } catch {
    errorCode = "NETWORK_ERROR";
  }
  await recordStatus(pref.user_id, sofia.date, status, {
    error_code: errorCode,
    provider_message_id: messageId,
  });
  return status;
}

export default async function handler() {
  const missing = needed.filter(name => !process.env[name]);
  if (missing.length) {
    console.error("Daily Duo WhatsApp: missing environment variable names:", missing.join(", "));
    return;
  }
  if (!/^v\d+\.\d+$/.test(process.env.WHATSAPP_GRAPH_VERSION)) {
    console.error("Daily Duo WhatsApp: invalid Graph API version setting");
    return;
  }
  const now = new Date();
  let preferences;
  try {
    preferences = await db(
      "daily_duo_whatsapp_preferences?select=user_id,duo_id,phone_e164,reminder_time,time_zone,enabled,consented_at&enabled=eq.true&limit=100"
    );
  } catch (error) {
    console.error("Daily Duo WhatsApp: could not load preferences", error.message);
    return;
  }
  const counts = {};
  for (const pref of preferences ?? []) {
    try {
      const result = await processPreference(pref, now);
      counts[result] = (counts[result] || 0) + 1;
    } catch (error) {
      counts.error = (counts.error || 0) + 1;
      console.error("Daily Duo WhatsApp: reminder attempt failed:", error.message);
    }
  }
  console.log("Daily Duo WhatsApp summary:", counts);
}
