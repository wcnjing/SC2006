alter table public.messages add constraint messages_body_not_blank
  check (body is null or body ~ '[^[:space:]]') not valid;

revoke insert on public.messages from authenticated;
drop policy "send messages to connections" on public.messages;
drop policy "see own messages" on public.messages;
create policy "participants read connected unblocked messages" on public.messages
  for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id)
    and public.are_connected(sender_id, recipient_id)
    and not public.is_blocked_between(sender_id, recipient_id));
-- Preserve the foundation's separate admin policy for reported-message review.

revoke insert, delete on public.blocks from authenticated;
drop policy "users block others" on public.blocks;
drop policy "users unblock" on public.blocks;

create function public.set_user_block(p_target_user uuid, p_blocked boolean)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'Sign in to manage blocked users.' using errcode = '42501';
  end if;
  if p_target_user is null or p_target_user = v_actor or p_blocked is null then
    raise exception 'Choose another resident.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    least(v_actor::text, p_target_user::text) || ':' || greatest(v_actor::text, p_target_user::text), 0));
  perform 1 from public.profiles where id in (v_actor, p_target_user) order by id for share;
  if not public.is_active_user() then
    raise exception 'Only active users can manage blocked users.' using errcode = '42501';
  end if;
  if p_blocked then
    if not exists (select 1 from public.profiles where id = p_target_user) then
      raise exception 'Resident not found.' using errcode = 'P0002';
    end if;
    insert into public.blocks (blocker_id, blocked_id, created_at)
      values (v_actor, p_target_user, pg_catalog.clock_timestamp()) on conflict do nothing;
    -- The existing trigger also removes the connection on insertion. Repeating
    -- a block still cleans up any inconsistent relationship created externally.
    delete from public.connections
      where (requester_id = v_actor and addressee_id = p_target_user)
        or (requester_id = p_target_user and addressee_id = v_actor);
  else
    delete from public.blocks where blocker_id = v_actor and blocked_id = p_target_user;
  end if;
  return p_blocked;
end;
$$;

create function public.send_direct_message(p_recipient uuid, p_body text, p_request_id uuid default null)
returns setof public.messages language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_body text := pg_catalog.btrim(p_body);
  v_row public.messages%rowtype;
  v_id uuid := coalesce(p_request_id, pg_catalog.gen_random_uuid());
begin
  if v_actor is null then
    raise exception 'Sign in to send messages.' using errcode = '42501';
  end if;
  if p_recipient is null or p_recipient = v_actor then
    raise exception 'Choose another resident.' using errcode = '22023';
  end if;
  if v_body is null or v_body !~ '[^[:space:]]' or pg_catalog.char_length(v_body) > 2000 then
    raise exception 'Enter a message of 1 to 2000 characters.' using errcode = '22023';
  end if;
  -- Serialize with connection changes and blocking, including block insertion.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    least(v_actor::text, p_recipient::text) || ':' || greatest(v_actor::text, p_recipient::text), 0));
  perform 1 from public.profiles where id in (v_actor, p_recipient) order by id for share;
  if not public.is_active_user()
    or not exists (select 1 from public.profiles where id = p_recipient and status = 'active')
    or not public.are_connected(v_actor, p_recipient)
    or public.is_blocked_between(v_actor, p_recipient) then
    raise exception 'Messaging is unavailable. You need an accepted, unblocked connection.' using errcode = '42501';
  end if;
  insert into public.messages (id, sender_id, recipient_id, body, created_at)
    values (v_id, v_actor, p_recipient, v_body, pg_catalog.clock_timestamp())
    on conflict (id) do nothing returning * into v_row;
  if not found then
    select * into v_row from public.messages where id = v_id;
    if not found or v_row.sender_id <> v_actor or v_row.recipient_id <> p_recipient
      or v_row.body is distinct from v_body or v_row.shared_post_id is not null then
      raise exception 'This message ID was already used. Refresh the conversation before starting a new message.' using errcode = '40001';
    end if;
  end if;
  return next v_row;
end;
$$;

create function public.get_direct_conversation(p_other_user uuid)
returns table (
  id uuid, display_name text, avatar_url text, neighbourhood_id smallint,
  connected boolean, blocked_by_me boolean, can_send boolean
)
language plpgsql security invoker set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to view conversations.' using errcode = '42501';
  end if;
  if p_other_user is null or p_other_user = (select auth.uid()) then
    raise exception 'Choose another resident.' using errcode = '22023';
  end if;
  return query select p.id, p.display_name, p.avatar_url, p.neighbourhood_id,
    (public.are_connected((select auth.uid()), p.id) and not public.is_blocked_between((select auth.uid()), p.id)),
    exists (select 1 from public.blocks b where b.blocker_id = (select auth.uid()) and b.blocked_id = p.id),
    (public.is_active_user() and p.status = 'active' and public.are_connected((select auth.uid()), p.id)
      and not public.is_blocked_between((select auth.uid()), p.id))
    from public.profiles p where p.id = p_other_user;
end;
$$;

revoke execute on function public.set_user_block(uuid, boolean) from public, anon;
revoke execute on function public.send_direct_message(uuid, text, uuid) from public, anon;
revoke execute on function public.get_direct_conversation(uuid) from public, anon;
grant execute on function public.set_user_block(uuid, boolean) to authenticated;
grant execute on function public.send_direct_message(uuid, text, uuid) to authenticated;
grant execute on function public.get_direct_conversation(uuid) to authenticated;

create index messages_thread_cursor_idx on public.messages
  (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc, id desc);
create index blocks_owner_history_idx on public.blocks (blocker_id, created_at desc, blocked_id desc);
