-- Daily Duo / WhatsApp reminder infrastructure
-- Execute once in Supabase SQL Editor after the existing Daily Duo schema.
-- No Meta or Supabase secret keys should ever be stored in this file.

create table if not exists public.daily_duo_whatsapp_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  duo_id uuid not null references public.duos(id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  reminder_time time without time zone not null default '20:00:00',
  time_zone text not null default 'Europe/Sofia'
    check (char_length(time_zone) between 3 and 64),
  enabled boolean not null default false,
  consented_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint daily_duo_whatsapp_consent_required
    check (not enabled or consented_at is not null),
  constraint daily_duo_whatsapp_quarter_hour
    check (extract(minute from reminder_time) in (0,15,30,45)
       and extract(second from reminder_time)=0)
);

create table if not exists public.daily_duo_whatsapp_deliveries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  duo_id uuid not null references public.duos(id) on delete cascade,
  task_date date not null,
  status text not null default 'reserved'
    check (status in ('reserved','sent','failed')),
  attempted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider_message_id text,
  error_code text,
  unique (user_id, task_date)
);

create index if not exists daily_duo_whatsapp_preferences_enabled_idx
  on public.daily_duo_whatsapp_preferences (enabled, duo_id);

alter table public.daily_duo_whatsapp_preferences enable row level security;
alter table public.daily_duo_whatsapp_deliveries enable row level security;

drop policy if exists "daily_duo_whatsapp_select_own" on public.daily_duo_whatsapp_preferences;
create policy "daily_duo_whatsapp_select_own"
on public.daily_duo_whatsapp_preferences for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "daily_duo_whatsapp_insert_own" on public.daily_duo_whatsapp_preferences;
create policy "daily_duo_whatsapp_insert_own"
on public.daily_duo_whatsapp_preferences for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.duo_members m
    where m.user_id = (select auth.uid()) and m.duo_id = daily_duo_whatsapp_preferences.duo_id
  )
);

drop policy if exists "daily_duo_whatsapp_update_own" on public.daily_duo_whatsapp_preferences;
create policy "daily_duo_whatsapp_update_own"
on public.daily_duo_whatsapp_preferences for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.duo_members m
    where m.user_id = (select auth.uid()) and m.duo_id = daily_duo_whatsapp_preferences.duo_id
  )
);

drop policy if exists "daily_duo_whatsapp_delete_own" on public.daily_duo_whatsapp_preferences;
create policy "daily_duo_whatsapp_delete_own"
on public.daily_duo_whatsapp_preferences for delete to authenticated
using ((select auth.uid()) = user_id);

-- No browser-readable policy on deliveries. Only backend service_role
-- may reserve/update outgoing reminders to prevent duplicate sends.

-- Create today's same-day plank even when neither member has opened the site.
-- Existing get_or_create_daily_task() expects auth.uid(), so a backend-only
-- RPC is necessary. The duo's task date always follows Europe/Sofia.
create or replace function public.daily_duo_reminder_ensure_task(
  p_duo_id uuid,
  p_task_date date
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task_id text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Not authorized';
  end if;

  insert into public.daily_tasks (duo_id, task_date, title, description, category)
  values (
    p_duo_id, p_task_date, 'Планка 💪',
    'Зроби планку стільки часу, скільки тобі комфортно. Без змагання та обов’язкових секунд. Після виконання постав свою галочку.',
    '💪 ПЛАНКА'
  )
  on conflict (duo_id, task_date) do nothing
  returning id::text into v_task_id;

  if v_task_id is null then
    select id::text into v_task_id
    from public.daily_tasks
    where duo_id = p_duo_id and task_date = p_task_date;
  end if;

  return v_task_id;
end;
$$;

revoke all on function public.daily_duo_reminder_ensure_task(uuid, date) from public;
revoke all on function public.daily_duo_reminder_ensure_task(uuid, date) from anon;
revoke all on function public.daily_duo_reminder_ensure_task(uuid, date) from authenticated;
grant execute on function public.daily_duo_reminder_ensure_task(uuid, date) to service_role;

-- Limit direct table privileges to the least-privileged access required.
grant select, insert, update, delete on public.daily_duo_whatsapp_preferences to authenticated;
revoke all on public.daily_duo_whatsapp_deliveries from anon, authenticated;
