create or replace function public.skip_activity(target_activity uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Sign in to skip an activity.' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.profiles
    where id = actor
      and role = 'resident'
      and status = 'active'
  ) then
    raise exception 'Only active residents can skip activities.' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.activities
    where id = target_activity
      and status = 'scheduled'
      and starts_at > pg_catalog.now()
  ) then
    raise exception 'This activity is no longer available to skip.' using errcode = '22023';
  end if;

  insert into public.activity_participants (activity_id, user_id, status)
  values (target_activity, actor, 'skipped')
  on conflict (activity_id, user_id)
  do update set status = 'skipped';
  return true;
end;
$$;

revoke execute on function public.skip_activity(uuid) from public, anon;
grant execute on function public.skip_activity(uuid) to authenticated;
