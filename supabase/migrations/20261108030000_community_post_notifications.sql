create or replace function public.notify_new_community_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient record;
begin
  if new.is_removed then
    return new;
  end if;

  for v_recipient in
    select p.id
    from public.profiles p
    where p.id <> new.author_id
      and p.status = 'active'
      and p.role = 'resident'
      and p.neighbourhood_id is not distinct from new.neighbourhood_id
  loop
    perform public.create_notification(
      v_recipient.id,
      'community_post',
      pg_catalog.jsonb_build_object(
        'title', 'New community post',
        'body', pg_catalog.left(new.body, 120),
        'post_id', new.id,
        'route', '/post/' || new.id
      ),
      'community-post:' || new.id::text
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists posts_notify_neighbourhood on public.posts;
create trigger posts_notify_neighbourhood
after insert on public.posts
for each row execute function public.notify_new_community_post();

create or replace function public.notify_post_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient record;
begin
  if new.is_removed then
    return new;
  end if;

  for v_recipient in
    select distinct recipient_id
    from (
      select p.author_id as recipient_id
      from public.posts p
      where p.id = new.post_id
        and p.author_id <> new.author_id
        and not p.is_removed
      union
      select l.user_id
      from public.post_likes l
      where l.post_id = new.post_id
        and l.user_id <> new.author_id
      union
      select c.author_id
      from public.comments c
      where c.post_id = new.post_id
        and c.author_id <> new.author_id
        and not c.is_removed
    ) recipients
    join public.profiles p on p.id = recipient_id
    where p.status = 'active'
  loop
    perform public.create_notification(
      v_recipient.recipient_id,
      'community_post_reply',
      pg_catalog.jsonb_build_object(
        'title', 'New reply on a community post',
        'body', pg_catalog.left(new.body, 120),
        'post_id', new.post_id,
        'comment_id', new.id,
        'route', '/post/' || new.post_id
      ),
      'community-post-comment:' || new.id::text || ':' || v_recipient.recipient_id::text
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists comments_notify_post_followers on public.comments;
create trigger comments_notify_post_followers
after insert on public.comments
for each row execute function public.notify_post_comment();
