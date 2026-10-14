# Daily Duo 🐾 — WhatsApp reminders

## Current status

The code for a WhatsApp Cloud API sender is in
`netlify/functions/daily-duo-whatsapp.mjs`. The client has an opt-in form.
**No messages will be sent until setup is completed and
`WHATSAPP_SEND_ENABLED=true` is configured on Netlify.**

WhatsApp Cloud API is intended for properly authorized business messaging.
An eligible adult/business administrator must handle Business Platform setup,
account eligibility, payment arrangements, and templates. Do not register
business details that are inaccurate or bypass age/account restrictions.
This personal two-person challenge may **not** qualify for Meta Business Platform
use; Meta can reject it. Do not switch to unauthorized WhatsApp automation.

## 1. Supabase schema (one-time)

In the existing Supabase project's SQL Editor, apply
[`whatsapp-setup.sql`](./whatsapp-setup.sql). This migration creates:

- `daily_duo_whatsapp_preferences`: each logged-in member can write/read/delete
  **only their own** phone number, notification time, consent and enabled state.
- `daily_duo_whatsapp_deliveries`: a server-only reservation log; at most
  one attempt per user per Daily Duo date, even if Netlify jobs overlap.
- `daily_duo_reminder_ensure_task`: server-only RPC ensuring today's plank
  exists even if nobody visited the site.

The existing Daily Duo tables (`duos`, `duo_members`, `daily_tasks`,
`task_completions`) and the plank setup must already exist.

## 2. WhatsApp Cloud API (eligible administrator only)

Official starting points:
- https://developers.facebook.com/docs/whatsapp/cloud-api/
- https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api

An eligible WhatsApp Business Platform operator must configure a legitimate
WhatsApp Business Account, sender phone number, Phone Number ID and access
token. Test senders can only message numbers that are explicitly added as
test recipients in Meta's developer setup.

For an initial *authorized* sandbox verification, Meta usually provides the
preapproved template `hello_world` with language `en_US`. For the actual
Ukrainian reminders, register an appropriate template and wait for approval.

**Suggested template** (subject to Meta's content/category review):

- Name: `daily_duo_reminder`
- Language: Ukrainian, code `uk`
- Body: `Daily Duo 🐾: твоє щоденне нагадування перевірити завдання й відмітку в застосунку. Якщо не хочеш отримувати ці повідомлення, вимкни нагадування у Daily Duo.`

Our dispatcher sends the *approved template without parameters*. If you
register a template that uses variables/buttons, the request payload
in the server function must be modified to match it.

**Costs:** Meta may charge per delivered template message, and Netlify
usage also counts against your plan. Check the account's live rate card,
message category and spending controls before enabling.

## 3. Netlify environment variables

Open your linked **Netlify site → Environment variables** as its
authorized administrator. Add these variables in the Netlify UI,
available to Functions:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **service_role** secret (server only) |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Cloud API server access token |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta sender's Phone Number ID (not your personal recipient number) |
| `WHATSAPP_GRAPH_VERSION` | API version enabled by Meta for your account, e.g. `v24.0` if supported |
| `WHATSAPP_TEMPLATE_NAME` | Exact approved template name (or `hello_world` during sandbox testing) |
| `WHATSAPP_TEMPLATE_LANGUAGE` | Exact approved language code (`uk` or sandbox `en_US`) |
| `WHATSAPP_SEND_ENABLED` | Initially `false`; switch to `true` only after ready |

**NEVER place access tokens, service_role keys, or secrets in
`daily-duo/config.js`, client JavaScript, GitHub, or chat messages.**
The existing `config.js` contains only the public Supabase publishable key.

Redeploy the production branch after setting environment variables.
Netlify recognizes the function in the standard `netlify/functions`
directory and its inline schedule `*/15 * * * *` (UTC). Check in
**Netlify → Functions** that `daily-duo-whatsapp` is listed as *Scheduled*.

## 4. Each of the two members

1. Sign into Daily Duo on their own phone.
2. In the WhatsApp section, select a time in 15-minute increments.
3. Enter their **own** number in international format, e.g. `+359...`.
4. Read/accept the consent checkbox and save.
5. To stop messages, use **Вимкнути й видалити мій номер**.

Preferences sync through Supabase, not localStorage. The timezone is
taken from the browser; the duo's task date still follows
`Europe/Sofia`, consistent with the existing plank RPC.

## 5. Testing and limitations

1. Keep `WHATSAPP_SEND_ENABLED=false` until Meta's sender, template and
   recipients are correctly configured.
2. Perform an authorized Meta sandbox test to a verified recipient.
3. Have a member opt in using their own verified number.
4. Set the next appropriate 15-minute reminder time while leaving today's
   challenge unchecked.
5. Set `WHATSAPP_SEND_ENABLED=true`, deploy and inspect **Netlify →
   Functions → daily-duo-whatsapp → logs** when a run occurs.
6. Verify the message arrived in the WhatsApp recipient chat.

The server checks whether the member already completed the task and
does not send to them if so. Each recipient can receive at most one
*attempt* per Daily Duo date. If Meta fails, the attempt is recorded as
`failed` and **not automatically retried** to avoid double-sending.
The current implementation sees Meta's accepted message ID, **not**
delivery/read receipts (which need a separate verified webhook).
Delivery can also be blocked by template status, recipient eligibility,
account restrictions, or payment setup.

The function stays off unless explicitly enabled, and it must not be
used for unsolicited contacts. Do not enable production billing without
reviewing the expected message volume.

## Troubleshooting

- No settings saved: execute `whatsapp-setup.sql`; confirm existing
  duo membership and normal Supabase login.
- Function missing: check published deploy and `netlify/functions`
  directory in repo root.
- No sends: check `WHATSAPP_SEND_ENABLED`, enabled recipient consent,
  due time, existing completion and Netlify logs.
- Meta error: confirm template name/language, recipient verification
  (for sandbox), API permissions, token validity, sender ID, and costs.
