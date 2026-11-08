-- Image-only comments and messages (20261108040000–045000) dropped the old
-- "not blank" and length checks. Restore them while still allowing image-only
-- content. NOT VALID: existing rows are not re-checked, new writes are.
alter table public.comments drop constraint if exists comments_content_not_blank;
alter table public.comments add constraint comments_content_not_blank
  check (
    (coalesce(body, '') ~ '[^[:space:]]' or image_url is not null)
    and pg_catalog.char_length(coalesce(body, '')) <= 1000
  ) not valid;

-- btrim() only strips spaces, so a body such as ' \n\t ' slipped through.
create or replace function public.send_direct_message(
  p_recipient uuid,
  p_body text,
  p_request_id uuid default null,
  p_activity_id uuid default null,
  p_image_url text default null
)
returns setof public.messages language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_body text := nullif(pg_catalog.regexp_replace(p_body, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  v_image_url text := nullif(pg_catalog.btrim(p_image_url), '');
  v_row public.messages%rowtype;
  v_id uuid := coalesce(p_request_id, pg_catalog.gen_random_uuid());
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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    least(v_actor::text, p_recipient::text) || ':' || greatest(v_actor::text, p_recipient::text), 0));
  perform 1 from public.profiles where id in (v_actor, p_recipient) order by id for share;
  if not public.is_active_user()
    or not exists (select 1 from public.profiles where id = p_recipient and status = 'active')
    or not public.are_connected(v_actor, p_recipient)
    or public.is_blocked_between(v_actor, p_recipient) then
    raise exception 'Messaging is unavailable. You need an accepted, unblocked connection.' using errcode = '42501';
  end if;
  insert into public.messages (id, sender_id, recipient_id, body, activity_id, image_url, created_at)
    values (v_id, v_actor, p_recipient, v_body, p_activity_id, v_image_url, pg_catalog.clock_timestamp())
    on conflict (id) do nothing returning * into v_row;
  if not found then
    select * into v_row from public.messages where id = v_id;
    if not found or v_row.sender_id <> v_actor or v_row.recipient_id <> p_recipient
      or v_row.body is distinct from v_body or v_row.image_url is distinct from v_image_url then
      raise exception 'This message ID was already used. Refresh the conversation before starting a new message.' using errcode = '40001';
    end if;
  end if;
  return next v_row;
end;
$$;

grant execute on function public.send_direct_message(uuid, text, uuid, uuid, text) to authenticated;
