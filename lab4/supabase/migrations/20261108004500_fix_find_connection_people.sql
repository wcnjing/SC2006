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
