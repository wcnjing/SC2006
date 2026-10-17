-- P3 comments and likes. Additive migration; no generated type changes required.
alter table public.comments add constraint comments_body_not_blank
  check (body ~ '[^[:space:]]') not valid;

revoke insert on public.comments from authenticated;
grant insert (id, post_id, author_id, body) on public.comments to authenticated;
revoke insert on public.post_likes from authenticated;
grant insert (post_id, user_id) on public.post_likes to authenticated;

drop policy "authors update own comments" on public.comments;
create policy "authors update own comments" on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()) and public.is_active_user() and not is_removed
    and exists (select 1 from public.posts p where p.id = comments.post_id and not p.is_removed))
  with check (author_id = (select auth.uid()) and public.is_active_user() and not is_removed
    and exists (select 1 from public.posts p where p.id = comments.post_id and not p.is_removed));

drop policy "authors delete own comments" on public.comments;
create policy "authors delete own comments" on public.comments
  for delete to authenticated
  using (author_id = (select auth.uid()) and public.is_active_user() and not is_removed
    and exists (select 1 from public.posts p where p.id = comments.post_id and not p.is_removed));

drop policy "likes readable by signed-in users" on public.post_likes;
create policy "likes on visible posts" on public.post_likes
  for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_likes.post_id and not p.is_removed));

drop policy "users like visible posts" on public.post_likes;
create policy "users like visible posts" on public.post_likes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_user()
    and exists (select 1 from public.posts p where p.id = post_likes.post_id and not p.is_removed));

drop policy "users unlike" on public.post_likes;
create policy "users unlike" on public.post_likes
  for delete to authenticated using (user_id = (select auth.uid()) and public.is_active_user());

create index comments_visible_thread_idx on public.comments
  (post_id, created_at desc, id desc) where not is_removed;
