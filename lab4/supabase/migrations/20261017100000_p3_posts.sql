-- P3: posts/feed hardening. No table/type changes; existing clients keep working.
-- NOT VALID preserves legacy rows while enforcing nonblank content on new writes.
alter table public.posts add constraint posts_body_not_blank
  check (body ~ '[^[:space:]]') not valid;

-- Publication timestamps and moderation metadata are database-owned.
revoke insert on public.posts from authenticated;
grant insert (id, author_id, neighbourhood_id, body, image_url, activity_id)
  on public.posts to authenticated;

drop policy "authors update own posts" on public.posts;
create policy "authors update own posts" on public.posts
  for update to authenticated
  using (author_id = (select auth.uid()) and public.is_active_user() and not is_removed)
  with check (author_id = (select auth.uid()) and public.is_active_user() and not is_removed);

-- Preserve moderated content as evidence; ordinary author deletion is permanent.
drop policy "authors delete own posts" on public.posts;
create policy "authors delete own posts" on public.posts
  for delete to authenticated
  using (author_id = (select auth.uid()) and public.is_active_user() and not is_removed);

-- Match the feed's stable ordering, including posts with the same timestamp.
create index posts_visible_feed_idx on public.posts
  (neighbourhood_id, created_at desc, id desc) where not is_removed;
