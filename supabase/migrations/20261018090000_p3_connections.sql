-- Only the request RPCs may change relationship state or server timestamps.
revoke insert, delete on public.connections from authenticated;
revoke update (status, responded_at) on public.connections from authenticated;
drop policy "send connection request" on public.connections;
drop policy "addressee responds to request" on public.connections;
drop policy "either side removes connection" on public.connections;
drop policy "see own connections" on public.connections;
create policy "see own unblocked connections" on public.connections
  for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id)
    and not public.is_blocked_between(requester_id, addressee_id));

create function public.send_connection_request(p_target_user uuid)
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
  -- Shared by both request directions and by block insertion, even when no
  -- connection row exists yet. This prevents crossed sends/block races.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    least(v_actor::text, p_target_user::text) || ':' || greatest(v_actor::text, p_target_user::text), 0));
  perform 1 from public.profiles where id in (v_actor, p_target_user) order by id for share;
  if not public.is_active_user() then
    raise exception 'Only active users can send requests.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_target_user and status = 'active') then
    raise exception 'This resident is unavailable for requests.' using errcode = 'P0002';
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
      values (v_actor, p_target_user, pg_catalog.clock_timestamp()) returning * into v_row;
  end if;
  -- A reverse pending request remains incoming; sending never auto-accepts it.
  return next v_row;
end;
$$;

create function public.manage_connection_request(
  p_requester uuid, p_addressee uuid, p_created_at timestamptz, p_action text
)
returns setof public.connections
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_row public.connections%rowtype;
begin
  if v_actor is null then
    raise exception 'Sign in to manage connection requests.' using errcode = '42501';
  end if;
  if p_requester is null or p_addressee is null or p_requester = p_addressee
    or p_created_at is null or p_action is null or p_action not in ('accept', 'reject', 'cancel') then
    raise exception 'Invalid connection request action.' using errcode = '22023';
  end if;
  if (p_action = 'cancel' and v_actor <> p_requester)
    or (p_action in ('accept', 'reject') and v_actor <> p_addressee) then
    raise exception 'You cannot perform this request action.' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    least(p_requester::text, p_addressee::text) || ':' || greatest(p_requester::text, p_addressee::text), 0));
  perform 1 from public.profiles where id in (p_requester, p_addressee) order by id for share;
  if not public.is_active_user() then
    raise exception 'Only active users can manage requests.' using errcode = '42501';
  end if;
  select * into v_row from public.connections
    where requester_id = p_requester and addressee_id = p_addressee for update;
  if not found then
    if p_action = 'accept' then
      raise exception 'This request is no longer available.' using errcode = 'P0002';
    end if;
    return; -- Repeating reject/cancel after deletion succeeds without a write.
  end if;
  if v_row.created_at <> p_created_at then
    raise exception 'This request changed. Refresh before continuing.' using errcode = '40001';
  end if;
  if p_action = 'accept' then
    if public.is_blocked_between(p_requester, p_addressee)
      or not exists (select 1 from public.profiles where id = p_requester and status = 'active') then
      raise exception 'This connection request is unavailable.' using errcode = '42501';
    end if;
    if v_row.status = 'pending' then
      update public.connections set status = 'accepted', responded_at = pg_catalog.clock_timestamp()
        where requester_id = p_requester and addressee_id = p_addressee returning * into v_row;
    end if;
    return next v_row;
    return;
  end if;
  if v_row.status <> 'pending' then
    raise exception 'This request was already accepted. Refresh before continuing.' using errcode = '40001';
  end if;
  delete from public.connections where requester_id = p_requester and addressee_id = p_addressee;
  return next v_row;
end;
$$;

-- Directory results contain public profile fields and only the caller's own
-- relationship. A single query avoids fetching private profiles or N+1 lookups.
create function public.find_connection_people(p_query text default '', p_limit integer default 21, p_after uuid default null)
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
  if p_query is null or pg_catalog.char_length(p_query) > 50 or p_limit is null or p_limit < 1 or p_limit > 51 then
    raise exception 'Invalid people search.' using errcode = '22023';
  end if;
  return query select p.id, p.display_name, p.avatar_url, p.neighbourhood_id,
    c.requester_id, c.addressee_id, c.status, c.created_at, c.responded_at
    from public.profiles p left join public.connections c
      on ((c.requester_id = (select auth.uid()) and c.addressee_id = p.id)
        or (c.addressee_id = (select auth.uid()) and c.requester_id = p.id))
    where p.id <> (select auth.uid()) and p.status = 'active'
      and not public.is_blocked_between((select auth.uid()), p.id)
      and (p_after is null or p.id > p_after)
      and pg_catalog.strpos(pg_catalog.lower(p.display_name), pg_catalog.lower(pg_catalog.btrim(p_query))) > 0
    order by p.id limit p_limit;
end;
$$;

create function public.lock_block_connection_pair()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    least(new.blocker_id::text, new.blocked_id::text) || ':' || greatest(new.blocker_id::text, new.blocked_id::text), 0));
  return new;
end;
$$;
create function public.remove_blocked_connection()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.connections
    where (requester_id = new.blocker_id and addressee_id = new.blocked_id)
      or (requester_id = new.blocked_id and addressee_id = new.blocker_id);
  return new;
end;
$$;
create trigger blocks_lock_connection_pair before insert on public.blocks
  for each row execute function public.lock_block_connection_pair();
create trigger blocks_remove_connection after insert on public.blocks
  for each row execute function public.remove_blocked_connection();

-- Clean up relationships created before these triggers existed.
delete from public.connections c where public.is_blocked_between(c.requester_id, c.addressee_id);

revoke execute on function public.send_connection_request(uuid) from public, anon;
revoke execute on function public.manage_connection_request(uuid, uuid, timestamptz, text) from public, anon;
revoke execute on function public.find_connection_people(text, integer, uuid) from public, anon;
revoke execute on function public.lock_block_connection_pair() from public, anon, authenticated;
revoke execute on function public.remove_blocked_connection() from public, anon, authenticated;
grant execute on function public.send_connection_request(uuid) to authenticated;
grant execute on function public.manage_connection_request(uuid, uuid, timestamptz, text) to authenticated;
grant execute on function public.find_connection_people(text, integer, uuid) to authenticated;

create index connections_requester_history_idx on public.connections (requester_id, status, created_at desc);
