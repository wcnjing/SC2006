-- Approval grants organiser permissions only to an active resident account.
create function public.verify_organiser(target_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
    for share;
  if not found or target_user = (select auth.uid()) then
    raise exception 'Only active administrators can approve other accounts' using errcode = '42501';
  end if;
  perform 1 from public.profiles
    where id = target_user and role = 'resident' and status = 'active'
    for update;
  if not found then
    raise exception 'Choose an active resident account' using errcode = '42501';
  end if;
  update public.profiles set role = 'organiser' where id = target_user;
  perform public.write_audit_log('verify_organiser', 'user', target_user::text,
    jsonb_build_object('from', 'resident', 'to', 'organiser'));
end;
$$;
revoke execute on function public.verify_organiser(uuid) from public, anon;
grant execute on function public.verify_organiser(uuid) to authenticated;
