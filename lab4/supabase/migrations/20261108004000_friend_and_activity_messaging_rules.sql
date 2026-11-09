drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable without exposing admins" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin() or role <> 'admin');

create or replace function public.send_connection_request(p_target_user uuid)
returns setof public.connections
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_row public.connections%rowtype;
begin
  if v_actor is null then
    raise exception 'Sign in to send a connection request.' using errcode = '42501';
  end if;
  if p_target_user is null or p_target_user = v_actor then
    raise exception 'Choose another resident.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    least(v_actor::text, p_target_user::text) || ':' ||
    greatest(v_actor::text, p_target_user::text), 0));
  perform 1 from public.profiles where id in (v_actor, p_target_user) order by id for share;
  if not public.is_active_user()
    or not exists (select 1 from public.profiles where id = v_actor and role = 'resident')
    or not exists (select 1 from public.profiles where id = p_target_user and status = 'active' and role = 'resident') then
    raise exception 'Only residents can add friends.' using errcode = '42501';
  end if;
  if public.is_blocked_between(v_actor, p_target_user) then
    raise exception 'This connection request is unavailable.' using errcode = '42501';
  end if;
  select * into v_row from public.connections
    where (requester_id = v_actor and addressee_id = p_target_user)
       or (requester_id = p_target_user and addressee_id = v_actor)
    for update;
  if not found then
    insert into public.connections (requester_id, addressee_id, created_at)
      values (v_actor, p_target_user, pg_catalog.clock_timestamp())
      returning * into v_row;
  end if;
  return next v_row;
end;
$$;

create or replace function public.find_connection_people(
  p_query text default '', p_limit integer default 21, p_after uuid default null
)
returns table (
  id uuid, display_name text, avatar_url text, neighbourhood_id smallint,
  requester_id uuid, addressee_id uuid, connection_status public.connection_status,
  connection_created_at timestamptz, responded_at timestamptz
)
language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.is_active_user() then
    raise exception 'Only active users can find people.' using errcode = '42501';
  end if;
  if p_query is null or pg_catalog.char_length(p_query) > 50
    or p_limit is null or p_limit < 1 or p_limit > 51 then
    raise exception 'Invalid people search.' using errcode = '22023';
  end if;
  return query
    select p.id, p.display_name, p.avatar_url, p.neighbourhood_id,
      c.requester_id, c.addressee_id, c.status, c.created_at, c.responded_at
    from public.profiles p
    left join public.connections c
      on ((c.requester_id = (select auth.uid()) and c.addressee_id = p.id)
        or (c.addressee_id = (select auth.uid()) and c.requester_id = p.id))
    where p.id <> (select auth.uid())
      and p.status = 'active'
      and p.role = 'resident'
      and not public.is_blocked_between((select auth.uid()), p.id)
      and (p_after is null or p.id > p_after)
      and pg_catalog.strpos(
        pg_catalog.lower(p.display_name),
        pg_catalog.lower(pg_catalog.btrim(p_query))
      ) > 0
    order by p.id
    limit p_limit;
end;
$$;

alter table public.messages add column if not exists activity_id uuid
  references public.activities (id) on delete set null;

drop function if exists public.send_direct_message(uuid, text, uuid);
create function public.send_direct_message(
  p_recipient uuid, p_body text, p_request_id uuid default null, p_activity_id uuid default null
)
returns setof public.messages
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_body text := pg_catalog.btrim(p_body);
  v_row public.messages%rowtype;
  v_id uuid := coalesce(p_request_id, pg_catalog.gen_random_uuid());
  v_actor_role public.user_role;
  v_recipient_role public.user_role;
begin
  if v_actor is null then raise exception 'Sign in to send messages.' using errcode = '42501'; end if;
  if p_recipient is null or p_recipient = v_actor then
    raise exception 'Choose another resident.' using errcode = '22023';
  end if;
  if v_body is null or v_body !~ '[^[:space:]]' or pg_catalog.char_length(v_body) > 2000 then
    raise exception 'Enter a message of 1 to 2000 characters.' using errcode = '22023';
  end if;
  select role into v_actor_role from public.profiles where id = v_actor;
  select role into v_recipient_role from public.profiles where id = p_recipient and status = 'active';
  if v_actor_role <> 'resident' then
    raise exception 'Only residents can send messages.' using errcode = '42501';
  end if;
  if p_activity_id is not null then
    if v_recipient_role <> 'organiser'
      or not exists (
        select 1 from public.activities
        where id = p_activity_id and organiser_id = p_recipient and source = 'organiser'
      ) then
      raise exception 'Messages to organisers must start from an activity.' using errcode = '42501';
    end if;
  elsif v_recipient_role <> 'resident'
    or not public.are_connected(v_actor, p_recipient)
    or public.is_blocked_between(v_actor, p_recipient) then
    raise exception 'You can only message accepted friends.' using errcode = '42501';
  end if;
  insert into public.messages (id, sender_id, recipient_id, body, activity_id, created_at)
    values (v_id, v_actor, p_recipient, v_body, p_activity_id, pg_catalog.clock_timestamp())
    on conflict (id) do nothing returning * into v_row;
  if not found then
    select * into v_row from public.messages where id = v_id;
  end if;
  return next v_row;
end;
$$;

drop policy if exists "participants read connected unblocked messages" on public.messages;
create policy "participants read permitted messages" on public.messages
  for select to authenticated
  using (
    (select auth.uid()) in (sender_id, recipient_id)
    and not public.is_blocked_between(sender_id, recipient_id)
    and (
      public.are_connected(sender_id, recipient_id)
      or exists (
        select 1 from public.activities a
        where a.id = messages.activity_id
          and a.organiser_id = case
            when a.organiser_id = sender_id then sender_id
            else recipient_id
          end
          and a.source = 'organiser'
      )
    )
  );

grant execute on function public.send_direct_message(uuid, text, uuid, uuid) to authenticated;

drop function if exists public.get_direct_conversation(uuid);
create function public.get_direct_conversation(
  p_other_user uuid, p_activity_id uuid default null
)
returns table (
  id uuid, display_name text, avatar_url text, neighbourhood_id smallint,
  connected boolean, blocked_by_me boolean, can_send boolean
)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'Sign in to view conversations.' using errcode = '42501';
  end if;
  return query
    select p.id, p.display_name, p.avatar_url, p.neighbourhood_id,
      public.are_connected(v_actor, p.id)
        and not public.is_blocked_between(v_actor, p.id),
      exists (
        select 1 from public.blocks b
        where b.blocker_id = v_actor and b.blocked_id = p.id
      ),
      (
        (p.role = 'resident' and public.are_connected(v_actor, p.id))
        or (
          p.role = 'organiser'
          and p_activity_id is not null
          and exists (
            select 1 from public.activities a
            where a.id = p_activity_id and a.organiser_id = p.id
              and a.source = 'organiser'
          )
        )
      )
      and public.is_active_user()
      and p.status = 'active'
      and not public.is_blocked_between(v_actor, p.id)
    from public.profiles p
    where p.id = p_other_user
      and p.role <> 'admin'
      and p.id <> v_actor;
end;
$$;

revoke execute on function public.get_direct_conversation(uuid, uuid) from public, anon;
grant execute on function public.get_direct_conversation(uuid, uuid) to authenticated;
