-- Run once in Supabase Dashboard → SQL Editor.
-- This preserves all existing tasks, completions and duo memberships.
alter table public.duos
  add column if not exists name text not null default 'Daily Duo';

-- Only the duo creator can rename it. Existing SELECT policies still control reading.
alter table public.duos enable row level security;
drop policy if exists "daily_duo_owner_can_rename" on public.duos;
create policy "daily_duo_owner_can_rename"
  on public.duos
  for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
