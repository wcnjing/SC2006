alter table public.notifications add column if not exists dedupe_key text;

create unique index if not exists notifications_user_dedupe_idx
  on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_payload jsonb,
  p_dedupe_key text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_type is null or p_payload is null then
    raise exception 'Notification fields are required.' using errcode = '22023';
  end if;

  insert into public.notifications (user_id, type, payload, dedupe_key)
    values (p_user_id, p_type, p_payload, p_dedupe_key)
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.create_notification(
    new.recipient_id,
    'direct_message',
    pg_catalog.jsonb_build_object(
      'title', 'New message',
      'body', pg_catalog.left(coalesce(new.body, 'You received a new message.'), 120),
      'message_id', new.id,
      'sender_id', new.sender_id,
      'route', '/messages/' || new.sender_id
    ),
    'message:' || new.id::text
  );
  return new;
end;
$$;

drop trigger if exists messages_notify_recipient on public.messages;
create trigger messages_notify_recipient
after insert on public.messages
for each row execute function public.notify_new_message();

create or replace function public.notify_connection_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' then
    perform public.create_notification(
      new.addressee_id,
      'friend_request',
      pg_catalog.jsonb_build_object(
        'title', 'New friend request',
        'body', 'Someone wants to connect with you.',
        'requester_id', new.requester_id,
        'route', '/friend-requests'
      ),
      'friend-request:' || new.requester_id::text || ':' || new.addressee_id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists connections_notify_addressee on public.connections;
create trigger connections_notify_addressee
after insert on public.connections
for each row execute function public.notify_connection_request();

create or replace function public.notify_activity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body text;
  v_participant record;
begin
  if new.status is distinct from old.status and new.status = 'cancelled' then
    v_body := 'This activity was cancelled.';
  elsif new.title is distinct from old.title
    or new.location_name is distinct from old.location_name
    or new.address is distinct from old.address
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at then
    v_body := 'An activity you joined has changed.';
  else
    return new;
  end if;

  for v_participant in
    select user_id
    from public.activity_participants
    where activity_id = new.id and status = 'joined'
  loop
    perform public.create_notification(
      v_participant.user_id,
      'activity_changed',
      pg_catalog.jsonb_build_object(
        'title', case when new.status = 'cancelled' then 'Activity cancelled' else 'Activity updated' end,
        'body', v_body,
        'activity_id', new.id,
        'route', '/activity/' || new.id
      ),
      'activity-change:' || new.id::text || ':' || new.updated_at::text
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists activities_notify_participants on public.activities;
create trigger activities_notify_participants
after update on public.activities
for each row execute function public.notify_activity_change();

create or replace function public.create_activity_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notifications (user_id, type, payload, dedupe_key)
    select p.user_id,
      'activity_reminder',
      pg_catalog.jsonb_build_object(
        'title', 'Activity reminder',
        'body', a.title || ' starts within 24 hours.',
        'activity_id', a.id,
        'route', '/activity/' || a.id
      ),
      'activity-reminder:' || a.id::text || ':24h'
    from public.activity_participants p
    join public.activities a on a.id = p.activity_id
    where p.status = 'joined'
      and a.status = 'scheduled'
      and a.starts_at > pg_catalog.now()
      and a.starts_at <= pg_catalog.now() + interval '24 hours'
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.create_notification(uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_activity_reminders() to authenticated;
