-- PROPOSED / P1 AND TEAM REVIEW ONLY. Not executed against any database here.
-- Forward hardening; do not edit the manually applied Save/Join source/baseline.
-- Requires baseline 150000, management 160000, ratings 170000 and Skip 180000.
-- Permission reductions require explicit team approval: current P2 APIs use RPC
-- Leave and INSERT-only ratings; no edit/delete rating workflow is specified.
begin;

do $$
begin
  if pg_catalog.to_regclass('public.activity_bookmarks') is null or
     pg_catalog.to_regprocedure('public.set_activity_registration(uuid,boolean)') is null or
     pg_catalog.to_regprocedure('public.skip_activity(uuid)') is null then
    raise exception 'Apply/verify the P2 Save/Join baseline and Skip prerequisites first.';
  end if;
  if not exists (select 1 from pg_catalog.pg_policy
    where polrelid = 'public.activities'::regclass
      and polname = 'P2 active activity managers only' and not polpermissive and polcmd = 'w') or
     not exists (select 1 from pg_catalog.pg_policy
    where polrelid = 'public.activity_ratings'::regclass
      and polname = 'P2 active residents rate concluded activities' and not polpermissive and polcmd = 'a') then
    raise exception 'Apply/verify the P2 management and rating policies first.';
  end if;
  if not exists (select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.activities'::regclass and tgname = 'activities_capacity_guard'
      and tgfoid = pg_catalog.to_regprocedure('public.guard_activity_capacity()')
      and not tgisinternal and tgenabled in ('O', 'A')) or
     not exists (select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.activities'::regclass and tgname = 'activities_management_guard'
      and tgfoid = pg_catalog.to_regprocedure('public.guard_activity_management()')
      and not tgisinternal and tgenabled in ('O', 'A')) then
    raise exception 'Verify enabled capacity/management guard triggers before hardening.';
  end if;
end;
$$;

-- SELECT is retained for state, capacity/popularity and review reads. Existing
-- permissive policies cannot authorize these writes after privileges are revoked.
-- Leave remains available through the active-resident registration RPC only.
revoke delete on public.activity_participants from public, anon, authenticated;

-- Single-submission rating contract: no client edit/delete path or delete/reinsert
-- escape from the unique-key guard. Revoke both table and ALL existing column
-- UPDATE privileges; revoking table UPDATE alone does not revoke column grants.
revoke update, delete on public.activity_ratings from public, anon, authenticated;
revoke update(activity_id, user_id, rating, comment, created_at)
  on public.activity_ratings from public, anon, authenticated;

-- now() is the transaction-start timestamp. Lock waits can cross the start time.
-- Validate new Join/Skip against the wall clock AFTER acquiring the activity lock.
-- READ COMMITTED refreshes the count snapshot after waiting for the parent lock.
-- REPEATABLE READ can retain a stale child-row count even with that lock. Reject
-- unsupported isolation for new Join/capacity edits; do not pretend row locks alone
-- repair the snapshot. Ordinary Supabase/PostgREST calls use READ COMMITTED.


create or replace function public.set_activity_registration(target_activity uuid, should_join boolean)
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
  joined_count bigint;
begin
  if resident_id is null then
    raise exception using errcode = '42501', message = 'You need to be logged in.';
  end if;
  select role, status into resident_role, resident_status
    from public.profiles where id = resident_id for share;
  if resident_role is distinct from 'resident' or resident_status is distinct from 'active' then
    raise exception using errcode = '42501', message = 'An active resident account is required.';
  end if;
  if should_join is null then
    raise exception using errcode = '22023', message = 'Specify whether to join or leave.';
  end if;

  if should_join and pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = '0A000', message = 'Joining requires READ COMMITTED transaction isolation.';
  end if;

  -- All joins for this activity serialize on one row. With the normal READ COMMITTED
  -- isolation level, subsequent queries see the prior join's committed registration.
  -- Higher isolation is rejected above; review connection/role settings before retry.
  select * into activity from public.activities where id = target_activity for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Activity not found.';
  end if;
  if not should_join then
    delete from public.activity_participants
      where activity_id = target_activity and user_id = resident_id and status = 'joined';
    return false;
  end if;
  -- An existing registration is idempotent and consumes no additional seat.
  if exists (select 1 from public.activity_participants
    where activity_id = target_activity and user_id = resident_id and status = 'joined') then
    return true;
  end if;
  if activity.status <> 'scheduled' or activity.starts_at <= clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'This activity is not open for registration.';
  end if;
  select count(*) into joined_count from public.activity_participants
    where activity_id = target_activity and status = 'joined';
  if activity.capacity is not null and joined_count >= activity.capacity then
    raise exception using errcode = 'P0001', message = 'This activity is full.';
  end if;
  insert into public.activity_participants(activity_id, user_id, status)
    values (target_activity, resident_id, 'joined')
    on conflict (activity_id, user_id) do update set status = 'joined';
  return true;
end;
$$;

revoke all on function public.set_activity_registration(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_activity_registration(uuid, boolean) to authenticated;

create or replace function public.skip_activity(target_activity uuid)
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
  if activity.status <> 'scheduled' or activity.starts_at <= clock_timestamp() then
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


-- Existing trigger binding is retained; no competing capacity trigger is created.
create or replace function public.guard_activity_capacity()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = '0A000', message = 'Capacity edits require READ COMMITTED transaction isolation.';
  end if;
  if new.capacity is not null and
     (select count(*) from public.activity_participants
      where activity_id = new.id and status = 'joined') > new.capacity then
    raise exception using errcode = 'P0001', message = 'Capacity is below existing registrations.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_activity_capacity() from public, anon, authenticated;

commit;
