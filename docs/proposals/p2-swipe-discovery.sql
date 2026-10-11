-- REVIEW ONLY: do not execute against the shared Supabase project here.
-- Dependency: p2-save-join.sql has been applied; independent bookmarks exist,
-- and direct participant INSERT/UPDATE (including UPDATE(status)) are revoked.
-- No new table, enum, grant to participant writes, or registration RPC replacement.
begin;

create function public.skip_activity(target_activity uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  resident_id uuid := auth.uid();
  resident_role public.user_role;
  resident_status public.account_status;
  activity public.activities%rowtype;
  existing_status public.participation_status;
begin
  if resident_id is null then
    raise exception using errcode = '42501', message = 'You need to be logged in.';
  end if;
  select role, status into resident_role, resident_status
    from public.profiles where id = resident_id for share;
  if resident_role is distinct from 'resident' or resident_status is distinct from 'active' then
    raise exception using errcode = '42501', message = 'An active resident account is required.';
  end if;
  if target_activity is null then
    raise exception using errcode = '22023', message = 'A target activity is required.';
  end if;

  -- Same activity lock/order as set_activity_registration: simultaneous Join and
  -- Skip cannot overwrite an existing joined registration or count as a seat.
  select * into activity from public.activities where id = target_activity for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Activity not found.';
  end if;
  select status into existing_status from public.activity_participants
    where activity_id = target_activity and user_id = resident_id;
  if existing_status = 'skipped' then
    -- Idempotent retry even if the activity has since started or been cancelled.
    return true;
  end if;
  if existing_status = 'joined' then
    raise exception using errcode = 'P0001', message = 'Already joined. Skip cannot cancel your registration.';
  end if;
  if existing_status = 'saved' then
    -- The prerequisite converted legacy saves to bookmarks. Do not silently lose
    -- a legacy saved status if a deployed database still contains one.
    raise exception using errcode = 'P0001', message = 'Legacy saved participation needs team review before Skip.';
  end if;
  if activity.status <> 'scheduled' or activity.starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'Only upcoming scheduled activities can be skipped.';
  end if;
  -- No ON CONFLICT UPDATE: never replace a joined/saved status. Controlled Join
  -- serializes on the activity row; duplicate Skip returns above without a write.
  insert into public.activity_participants(activity_id, user_id, status)
    values (target_activity, resident_id, 'skipped');
  return true;
end;
$$;
revoke all on function public.skip_activity(uuid) from public, anon, authenticated;
grant execute on function public.skip_activity(uuid) to authenticated;

commit;
