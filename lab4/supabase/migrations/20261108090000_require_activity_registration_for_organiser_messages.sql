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
  v_recipient_role public.user_role;
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
  select role into v_recipient_role
  from public.profiles
  where id = p_recipient and status = 'active';
  if not public.is_active_user()
    or not exists (
      select 1 from public.profiles where id = v_actor and role = 'resident'
    )
    or v_recipient_role is null then
    raise exception 'Messaging is unavailable.' using errcode = '42501';
  end if;
  if v_recipient_role = 'organiser' then
    if p_activity_id is null
      or not exists (
        select 1
        from public.activities a
        join public.activity_participants ap on ap.activity_id = a.id
        where a.id = p_activity_id
          and a.organiser_id = p_recipient
          and a.source = 'organiser'
          and ap.user_id = v_actor
          and ap.status = 'joined'
      ) then
      raise exception 'You can message an organiser only after registering for their activity.'
        using errcode = '42501';
    end if;
  elsif v_recipient_role <> 'resident'
    or not public.are_connected(v_actor, p_recipient)
    or public.is_blocked_between(v_actor, p_recipient) then
    raise exception 'You can only message accepted friends.' using errcode = '42501';
  end if;
  insert into public.messages (id, sender_id, recipient_id, body, activity_id, image_url, created_at)
    values (v_id, v_actor, p_recipient, v_body, p_activity_id, v_image_url, pg_catalog.clock_timestamp())
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

drop policy if exists "participants read permitted messages" on public.messages;
create policy "participants read permitted messages" on public.messages
for select to authenticated
using (
  (select auth.uid()) in (sender_id, recipient_id)
  and not public.is_blocked_between(sender_id, recipient_id)
  and (
    public.are_connected(sender_id, recipient_id)
    or exists (
      select 1
      from public.activities a
      join public.activity_participants ap on ap.activity_id = a.id
      where a.id = messages.activity_id
        and a.organiser_id = case
          when a.organiser_id = sender_id then sender_id
          else recipient_id
        end
        and a.source = 'organiser'
        and ap.user_id = case
          when a.organiser_id = sender_id then recipient_id
          else sender_id
        end
        and ap.status = 'joined'
    )
  )
);

create or replace function public.get_direct_conversation(
  p_other_user uuid,
  p_activity_id uuid default null
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
            select 1
            from public.activities a
            join public.activity_participants ap on ap.activity_id = a.id
            where a.id = p_activity_id
              and a.organiser_id = p.id
              and a.source = 'organiser'
              and ap.user_id = v_actor
              and ap.status = 'joined'
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

grant execute on function public.send_direct_message(uuid, text, uuid, uuid, text) to authenticated;
