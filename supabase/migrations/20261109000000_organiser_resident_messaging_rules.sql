-- Organisers and residents are never friends with each other. They may message
-- each other only while the resident is registered ('joined') for an upcoming
-- (scheduled, not yet started) activity run by that organiser.

-- 1. Friendships are resident <-> resident only. send_connection_request
--    already checks this; the trigger also stops older pending requests
--    between an organiser and a resident from being accepted.
create or replace function public.enforce_resident_only_connections()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.profiles
    where id in (new.requester_id, new.addressee_id) and role <> 'resident'
  ) then
    raise exception 'Only residents can add friends.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists connections_residents_only on public.connections;
create trigger connections_residents_only
  before insert or update on public.connections
  for each row execute function public.enforce_resident_only_connections();

-- 2. The single rule for organiser <-> resident messaging. With p_activity null,
--    any qualifying activity counts (e.g. a reply opened from a notification).
create or replace function public.can_message_via_activity(
  p_organiser uuid, p_resident uuid, p_activity uuid default null
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.activities a
    join public.activity_participants ap on ap.activity_id = a.id
    join public.profiles o on o.id = a.organiser_id and o.role = 'organiser'
    join public.profiles r on r.id = ap.user_id and r.role = 'resident'
    where a.organiser_id = p_organiser
      and ap.user_id = p_resident
      and ap.status = 'joined'
      and a.source = 'organiser'
      and a.status = 'scheduled'
      and a.starts_at > pg_catalog.now()
      and (p_activity is null or a.id = p_activity)
  );
$$;

revoke execute on function public.can_message_via_activity(uuid, uuid, uuid) from public, anon;
grant execute on function public.can_message_via_activity(uuid, uuid, uuid) to authenticated;

-- 3. Sending.
create or replace function public.send_direct_message(
  p_recipient uuid,
  p_body text,
  p_request_id uuid default null,
  p_activity_id uuid default null,
  p_image_url text default null
)
returns setof public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_body text := nullif(pg_catalog.regexp_replace(p_body, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  v_image_url text := nullif(pg_catalog.btrim(p_image_url), '');
  v_row public.messages%rowtype;
  v_id uuid := coalesce(p_request_id, pg_catalog.gen_random_uuid());
  v_activity uuid := p_activity_id;
  v_actor_role public.user_role;
  v_recipient_role public.user_role;
  v_organiser uuid;
  v_resident uuid;
begin
  if v_actor is null then
    raise exception 'Sign in to send messages.' using errcode = '42501';
  end if;
  if p_recipient is null or p_recipient = v_actor then
    raise exception 'Choose another resident.' using errcode = '22023';
  end if;
  if v_body is null and v_image_url is null then
    raise exception 'Enter a message or attach an image.' using errcode = '22023';
  end if;
  if v_body is not null and pg_catalog.char_length(v_body) > 2000 then
    raise exception 'Messages must be 2000 characters or fewer.' using errcode = '22023';
  end if;
  if v_image_url is not null and v_image_url not like '%/storage/v1/object/public/chat-images/%' then
    raise exception 'Chat images must be uploaded to the chat-images bucket.' using errcode = '22023';
  end if;
  select role into v_actor_role from public.profiles where id = v_actor and status = 'active';
  select role into v_recipient_role from public.profiles where id = p_recipient and status = 'active';
  if v_actor_role is null or v_recipient_role is null or not public.is_active_user() then
    raise exception 'Messaging is unavailable.' using errcode = '42501';
  end if;
  if public.is_blocked_between(v_actor, p_recipient) then
    raise exception 'Messaging is unavailable.' using errcode = '42501';
  end if;

  if v_actor_role = 'resident' and v_recipient_role = 'resident' then
    if not public.are_connected(v_actor, p_recipient) then
      raise exception 'You can only message accepted friends.' using errcode = '42501';
    end if;
    v_activity := null;
  elsif (v_actor_role, v_recipient_role) in (('resident', 'organiser'), ('organiser', 'resident')) then
    v_organiser := case when v_actor_role = 'organiser' then v_actor else p_recipient end;
    v_resident := case when v_actor_role = 'resident' then v_actor else p_recipient end;
    if not public.can_message_via_activity(v_organiser, v_resident, p_activity_id) then
      raise exception 'Organisers and residents can message only while the resident is registered for an upcoming activity.'
        using errcode = '42501';
    end if;
    -- Tag the message with an activity so the read policy can authorise it.
    if v_activity is null then
      select a.id into v_activity
      from public.activities a
      join public.activity_participants ap on ap.activity_id = a.id
      where a.organiser_id = v_organiser and ap.user_id = v_resident and ap.status = 'joined'
        and a.source = 'organiser' and a.status = 'scheduled' and a.starts_at > pg_catalog.now()
      order by a.starts_at
      limit 1;
    end if;
  else
    raise exception 'Messaging is unavailable.' using errcode = '42501';
  end if;

  insert into public.messages (id, sender_id, recipient_id, body, activity_id, image_url, created_at)
    values (v_id, v_actor, p_recipient, v_body, v_activity, v_image_url, pg_catalog.clock_timestamp())
    on conflict (id) do nothing returning * into v_row;
  if not found then
    select * into v_row from public.messages where id = v_id;
    if not found or v_row.sender_id <> v_actor or v_row.recipient_id <> p_recipient
      or v_row.body is distinct from v_body or v_row.image_url is distinct from v_image_url then
      raise exception 'This message ID was already used. Refresh the conversation before starting a new message.'
        using errcode = '40001';
    end if;
  end if;
  return next v_row;
end;
$$;

grant execute on function public.send_direct_message(uuid, text, uuid, uuid, text) to authenticated;

-- 4. Conversation header: now also returns the other person's role so the app
--    can hide friend actions between organisers and residents.
drop function if exists public.get_direct_conversation(uuid, uuid);
create function public.get_direct_conversation(
  p_other_user uuid,
  p_activity_id uuid default null
)
returns table (
  id uuid, display_name text, avatar_url text, neighbourhood_id smallint,
  role public.user_role, connected boolean, blocked_by_me boolean, can_send boolean
)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_role public.user_role;
begin
  if v_actor is null then
    raise exception 'Sign in to view conversations.' using errcode = '42501';
  end if;
  select pr.role into v_actor_role from public.profiles pr where pr.id = v_actor;
  return query
    select p.id, p.display_name, p.avatar_url, p.neighbourhood_id, p.role,
      public.are_connected(v_actor, p.id)
        and not public.is_blocked_between(v_actor, p.id),
      exists (
        select 1 from public.blocks b
        where b.blocker_id = v_actor and b.blocked_id = p.id
      ),
      (
        (v_actor_role = 'resident' and p.role = 'resident' and public.are_connected(v_actor, p.id))
        or (v_actor_role = 'resident' and p.role = 'organiser'
          and public.can_message_via_activity(p.id, v_actor, p_activity_id))
        or (v_actor_role = 'organiser' and p.role = 'resident'
          and public.can_message_via_activity(v_actor, p.id, p_activity_id))
      )
      and public.is_active_user()
      and p.status = 'active'
      and not public.is_blocked_between(v_actor, p.id)
    from public.profiles p
    where p.id = p_other_user and p.role <> 'admin' and p.id <> v_actor;
end;
$$;

revoke execute on function public.get_direct_conversation(uuid, uuid) from public, anon;
grant execute on function public.get_direct_conversation(uuid, uuid) to authenticated;
