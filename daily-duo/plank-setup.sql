-- Daily Duo: daily plank only. Execute in Supabase SQL Editor.
create or replace function public.get_or_create_daily_task(p_duo_id uuid)
returns public.daily_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Europe/Sofia')::date;
  v_task public.daily_tasks;
begin
  if (select auth.uid()) is null or not public.is_duo_member(p_duo_id) then
    raise exception 'Access denied';
  end if;
  insert into public.daily_tasks (duo_id, task_date, title, description, category)
  values (
    p_duo_id, v_day, 'Планка 💪',
    'Зроби планку стільки часу, скільки тобі комфортно. Без змагання та обовʼязкових секунд. Після виконання постав свою галочку.',
    '💪 ПЛАНКА'
  )
  on conflict (duo_id, task_date) do update
  set title = excluded.title,
      description = excluded.description,
      category = excluded.category
  returning * into v_task;
  return v_task;
end;
$$;
revoke all on function public.get_or_create_daily_task(uuid) from public;
grant execute on function public.get_or_create_daily_task(uuid) to authenticated;
