-- Grants + row-level security (P1)
--
-- Two layers:
--   1. Column grants decide WHICH columns a signed-in user may write
--      (e.g. nobody can update their own profiles.role or posts.is_removed).
--   2. RLS policies decide WHICH rows they may read/write.
-- Admin-only writes to protected columns go through security definer
-- functions (see set_user_role / set_user_status).

-- ---------------------------------------------------------------------------
-- Grants: start from nothing for anon, explicit for authenticated
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select on public.neighbourhoods to anon;

grant select, insert, delete on all tables in schema public to authenticated;
revoke update on all tables in schema public from authenticated;

-- Writable columns per table. Anything not listed here is read-only to clients.
grant update (display_name, avatar_url, bio, neighbourhood_id, interests,
              accessibility_needs, preferred_language, onboarded)
  on public.profiles to authenticated;
grant update (title, description, category, tags, neighbourhood_id, location_name,
              address, lat, lng, starts_at, ends_at, capacity, is_outdoor, cost_cents,
              accessibility_features, status, cancelled_reason)
  on public.activities to authenticated;
grant update (status) on public.activity_participants to authenticated;
grant update (rating, comment) on public.activity_ratings to authenticated;
grant update (body, image_url, neighbourhood_id) on public.posts to authenticated;
grant update (body) on public.comments to authenticated;
grant update (status, responded_at) on public.connections to authenticated;
grant update (read_at) on public.messages to authenticated;
grant update (status, reviewed_by, reviewed_at, resolution_note) on public.reports to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Rows that only the database creates.
revoke insert, delete on public.profiles from authenticated;      -- handle_new_user / auth cascade
revoke insert, delete on public.neighbourhoods from authenticated;
revoke insert, delete on public.audit_log from authenticated;     -- write_audit_log only
revoke insert on public.notifications from authenticated;          -- P4's notify() function

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.neighbourhoods enable row level security;
alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.activity_participants enable row level security;
alter table public.activity_ratings enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.connections enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.audit_log enable row level security;
alter table public.notifications enable row level security;

-- ---------------------------------------------------------------------------
-- neighbourhoods: public reference data
-- ---------------------------------------------------------------------------
create policy "neighbourhoods are public" on public.neighbourhoods
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);

create policy "users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------
create policy "activities readable by signed-in users" on public.activities
  for select to authenticated using (true);

create policy "organisers create own activities" on public.activities
  for insert to authenticated
  with check (organiser_id = (select auth.uid()) and source = 'organiser' and public.is_organiser());

create policy "organiser or admin updates activity" on public.activities
  for update to authenticated
  using (organiser_id = (select auth.uid()) or public.is_admin())
  with check (organiser_id = (select auth.uid()) or public.is_admin());

create policy "admins delete activities" on public.activities
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- activity_participants: own rows of any status; everyone sees who joined
-- ---------------------------------------------------------------------------
create policy "see own participation and joined lists" on public.activity_participants
  for select to authenticated
  using (user_id = (select auth.uid()) or status = 'joined');

create policy "users record own participation" on public.activity_participants
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_user());

create policy "users update own participation" on public.activity_participants
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "users delete own participation" on public.activity_participants
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- activity_ratings: only after joining an activity that has ended
-- ---------------------------------------------------------------------------
create policy "ratings readable by signed-in users" on public.activity_ratings
  for select to authenticated using (true);

create policy "participants rate ended activities" on public.activity_ratings
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_user()
    and exists (
      select 1
      from public.activity_participants p
      join public.activities a on a.id = p.activity_id
      where p.activity_id = activity_ratings.activity_id
        and p.user_id = (select auth.uid())
        and p.status = 'joined'
        and a.ends_at < now()
    )
  );

create policy "users update own rating" on public.activity_ratings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "users delete own rating" on public.activity_ratings
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- posts: hidden if removed or if either side blocked the other
-- ---------------------------------------------------------------------------
create policy "visible posts" on public.posts
  for select to authenticated
  using (
    author_id = (select auth.uid())
    or public.is_admin()
    or (not is_removed and not public.is_blocked_between(author_id, (select auth.uid())))
  );

create policy "users create own posts" on public.posts
  for insert to authenticated
  with check (author_id = (select auth.uid()) and public.is_active_user() and not is_removed);

create policy "authors update own posts" on public.posts
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "authors delete own posts" on public.posts
  for delete to authenticated using (author_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- comments: visible when the parent post is visible to you
-- ---------------------------------------------------------------------------
create policy "visible comments" on public.comments
  for select to authenticated
  using (
    author_id = (select auth.uid())
    or public.is_admin()
    or (
      not is_removed
      and not public.is_blocked_between(author_id, (select auth.uid()))
      and exists (select 1 from public.posts p where p.id = comments.post_id)
    )
  );

create policy "users comment on visible posts" on public.comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_active_user()
    and not is_removed
    and exists (select 1 from public.posts p where p.id = comments.post_id and not p.is_removed)
  );

create policy "authors update own comments" on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "authors delete own comments" on public.comments
  for delete to authenticated using (author_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- post_likes
-- ---------------------------------------------------------------------------
create policy "likes readable by signed-in users" on public.post_likes
  for select to authenticated using (true);

create policy "users like visible posts" on public.post_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_user()
    and exists (select 1 from public.posts p where p.id = post_likes.post_id)
  );

create policy "users unlike" on public.post_likes
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- connections: requester creates, addressee accepts, either side removes
-- ---------------------------------------------------------------------------
create policy "see own connections" on public.connections
  for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create policy "send connection request" on public.connections
  for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'pending'
    and public.is_active_user()
    and not public.is_blocked_between(requester_id, addressee_id)
  );

create policy "addressee responds to request" on public.connections
  for update to authenticated
  using (addressee_id = (select auth.uid()))
  with check (addressee_id = (select auth.uid()));

create policy "either side removes connection" on public.connections
  for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- ---------------------------------------------------------------------------
-- messages: DMs only between accepted connections who haven't blocked each other
-- ---------------------------------------------------------------------------
create policy "see own messages" on public.messages
  for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));

create policy "admins see reported messages" on public.messages
  for select to authenticated
  using (
    public.is_admin()
    and exists (
      select 1 from public.reports r
      where r.target_type = 'message' and r.target_id = messages.id
    )
  );

create policy "send messages to connections" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_active_user()
    and public.are_connected(sender_id, recipient_id)
    and not public.is_blocked_between(sender_id, recipient_id)
  );

create policy "recipient marks messages read" on public.messages
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- blocks: private to the blocker
-- ---------------------------------------------------------------------------
create policy "see own blocks" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));

create policy "users block others" on public.blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));

create policy "users unblock" on public.blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- reports: reporter sees own; admins see and review all
-- ---------------------------------------------------------------------------
create policy "users file reports" on public.reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open' and public.is_active_user());

create policy "reporter or admin reads reports" on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_admin());

create policy "admins review reports" on public.reports
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- audit_log: admins read; writes only via write_audit_log()
-- ---------------------------------------------------------------------------
create policy "admins read audit log" on public.audit_log
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- notifications: own only
-- ---------------------------------------------------------------------------
create policy "see own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

create policy "mark own notifications read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "delete own notifications" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));
