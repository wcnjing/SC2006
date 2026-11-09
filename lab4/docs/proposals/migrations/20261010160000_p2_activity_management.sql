-- PROPOSED / REVIEW REQUIRED. Do not execute against the shared database here.
-- Prerequisite: applied docs/proposals/p2-save-join.sql, including its capacity
-- guard and row-locking registration RPC. No data rewrites or P4 notifications.
begin;

-- Fail clearly if the deployed schema lacks the already-approved capacity guard.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.activities'::regclass
      and tgname = 'activities_capacity_guard' and not tgisinternal and tgenabled <> 'D') then
    raise exception 'Review/apply the P2 save/join capacity guard before this migration.';
  end if;
end;
$$;

-- Preserve existing active-admin moderation permissions. Tighten organiser
-- updates even if another permissive UPDATE policy is present.
create policy "P2 active activity managers only" on public.activities
  as restrictive for update to authenticated
  using (
    public.is_admin() or (
      public.is_active_user() and public.current_user_role() = 'organiser'
      and organiser_id = (select auth.uid()) and source = 'organiser'
    )
  )
  with check (
    public.is_admin() or (
      public.is_active_user() and public.current_user_role() = 'organiser'
      and organiser_id = (select auth.uid()) and source = 'organiser'
    )
  );

create function public.guard_activity_management()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  actor_role public.user_role;
  actor_status public.account_status;
  cancellation_only boolean;
begin
  -- Lock the actor profile against simultaneous suspension/demotion for client
  -- writes, just as the registration RPC does. Service-role jobs have no user id;
  -- RLS/grants remain the boundary for those trusted administrative processes.
  if auth.uid() is not null then
    select role, status into actor_role, actor_status from public.profiles
      where id = auth.uid() for share;
    if actor_status is distinct from 'active' or actor_role not in ('organiser', 'admin') or actor_role is null then
      raise exception using errcode = '42501', message = 'An active organiser account is required.';
    end if;
    if actor_role <> 'admin' then
      if new.organiser_id is distinct from auth.uid() or new.source <> 'organiser' then
        raise exception using errcode = '42501', message = 'You can only manage your own organiser activities.';
      end if;
      if tg_op = 'INSERT' then
        if new.status <> 'scheduled' or new.starts_at <= clock_timestamp() then
          raise exception using errcode = 'P0001', message = 'New activities must be scheduled for the future.';
        end if;
      else
        if old.organiser_id is distinct from auth.uid() or old.source <> 'organiser' or old.status <> 'scheduled' then
          raise exception using errcode = '42501', message = 'Only your own scheduled activities can be managed.';
        end if;
        if new.status not in ('scheduled', 'cancelled') then
          raise exception using errcode = 'P0001', message = 'Organisers may update or cancel scheduled activities only.';
        end if;
        -- Cancellation is a separate action. It cannot smuggle edits into a
        -- started activity, or change any fields except status/reason/timestamp.
        cancellation_only := new.status = 'cancelled' and
          (to_jsonb(new) - array['status', 'cancelled_reason', 'updated_at']) =
          (to_jsonb(old) - array['status', 'cancelled_reason', 'updated_at']);
        if new.status = 'cancelled' and not cancellation_only then
          raise exception using errcode = 'P0001', message = 'Cancel the activity separately from editing its details.';
        end if;
        -- UC #7-03: use the original start and current server clock, including
        -- requests that waited on locks. This also guards direct table updates.
        if cancellation_only and old.starts_at <= clock_timestamp() then
          raise exception using errcode = 'P0001', message = 'This activity has already started and cannot be cancelled.';
        end if;
        if not cancellation_only and (old.starts_at <= clock_timestamp() or new.starts_at <= clock_timestamp()) then
          raise exception using errcode = 'P0001', message = 'Activities cannot be edited after they start or moved into the past.';
        end if;
      end if;
    end if;
  end if;

  -- Required details for organiser-created activities. Do not rewrite legacy
  -- records: a cancellation-only action remains possible on incomplete records.
  if new.source = 'organiser' and new.status = 'scheduled' then
    if char_length(btrim(new.title)) not between 3 and 120 or new.title !~ '[^[:space:]]' or
       new.description !~ '[^[:space:]]' or new.category !~ '[^[:space:]]' or new.location_name !~ '[^[:space:]]' then
      raise exception using errcode = 'P0001', message = 'Name, description, category and location are required.';
    end if;
    if (new.lat is null) <> (new.lng is null) or
       (new.lat is not null and (not (new.lat between -90 and 90) or not (new.lng between -180 and 180))) then
      raise exception using errcode = 'P0001', message = 'Provide both valid latitude and longitude, or leave both blank.';
    end if;
  end if;
  if new.status = 'cancelled' and (new.cancelled_reason is null or new.cancelled_reason !~ '[^[:space:]]') then
    raise exception using errcode = 'P0001', message = 'A cancellation reason is required.';
  end if;
  if new.status <> 'cancelled' and new.cancelled_reason is not null then
    raise exception using errcode = 'P0001', message = 'Only cancelled activities may have a cancellation reason.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_activity_management() from public, anon, authenticated;
create trigger activities_management_guard before insert or update on public.activities
  for each row execute function public.guard_activity_management();

-- Capacity UPDATEs acquire the same row lock as set_activity_registration.
-- Reuse activities_capacity_guard: do not add competing guards or change Join/Leave.
commit;
