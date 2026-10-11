-- REVIEW ONLY. Not a migration; do not execute against the shared project here.
-- Based on the repository schema. P1 must compare with the deployed schema,
-- review privileges and existing data, and test locally before adoption.
begin;

-- Independent bookmarks preserve saves even when residents join or leave.
create table public.activity_bookmarks (
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);
create index activity_bookmarks_user_idx on public.activity_bookmarks(user_id);
alter table public.activity_bookmarks enable row level security;
revoke all on public.activity_bookmarks from public, anon, authenticated;
grant select, insert, delete on public.activity_bookmarks to authenticated;
create policy "residents read own bookmarks" on public.activity_bookmarks
  for select to authenticated using (user_id = (select auth.uid()));
create policy "active residents save own bookmarks" on public.activity_bookmarks
  for insert to authenticated with check (
    user_id = (select auth.uid()) and public.is_active_user()
    and public.current_user_role() = 'resident'
  );
create policy "active residents unsave own bookmarks" on public.activity_bookmarks
  for delete to authenticated using (
    user_id = (select auth.uid()) and public.is_active_user()
    and public.current_user_role() = 'resident'
  );

-- Preserve existing saved rows before removing their old representation.
-- Old status transitions already lost historical bookmarks; those cannot be recovered.
insert into public.activity_bookmarks(activity_id, user_id, created_at)
  select activity_id, user_id, created_at from public.activity_participants
  where status = 'saved';
delete from public.activity_participants where status = 'saved';

-- Only the RPC may create or change registrations. Revoke column grants too:
-- revoking table UPDATE alone does not revoke the existing UPDATE(status) grant.
revoke insert, update on public.activity_participants from public, anon, authenticated;
revoke update(status) on public.activity_participants from public, anon, authenticated;
-- Existing own-row SELECT/DELETE RLS stays in place. DELETE can only free seats.

create function public.set_activity_registration(target_activity uuid, should_join boolean)
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

  -- All joins for this activity serialize on one row. With the normal READ COMMITTED
  -- isolation level, subsequent queries see the prior join's committed registration.
  -- Higher isolation may return a serialization failure; callers must retry.
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
  if activity.status <> 'scheduled' or activity.starts_at <= now() then
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
revoke all on function public.set_activity_registration(uuid, boolean) from public, anon;
grant execute on function public.set_activity_registration(uuid, boolean) to authenticated;

-- Capacity edits acquire the same activity-row lock as joining. They must not
-- reduce capacity below the existing joined count. No organiser UI is added.
create function public.guard_activity_capacity()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.capacity is not null and
     (select count(*) from public.activity_participants
      where activity_id = new.id and status = 'joined') > new.capacity then
    raise exception using errcode = 'P0001', message = 'Capacity is below existing registrations.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_activity_capacity() from public, anon, authenticated;
create trigger activities_capacity_guard before update of capacity on public.activities
  for each row execute function public.guard_activity_capacity();

commit;
