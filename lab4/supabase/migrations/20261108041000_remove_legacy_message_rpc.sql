drop function if exists public.send_direct_message(uuid, text, uuid, uuid);

grant execute on function public.send_direct_message(uuid, text, uuid, uuid, text) to authenticated;
