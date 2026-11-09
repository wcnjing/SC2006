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
  elsif new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform public.create_notification(
      new.requester_id,
      'friend_request_accepted',
      pg_catalog.jsonb_build_object(
        'title', 'Friend request accepted',
        'body', 'Your friend request was accepted.',
        'friend_id', new.addressee_id,
        'route', '/friend-requests'
      ),
      'friend-request-accepted:' || new.requester_id::text || ':' || new.addressee_id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists connections_notify_addressee on public.connections;
create trigger connections_notify_addressee
after insert or update of status on public.connections
for each row execute function public.notify_connection_request();
