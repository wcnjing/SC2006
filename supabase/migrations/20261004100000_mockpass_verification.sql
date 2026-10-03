-- Allow the Mockpass bridge to mark only the signed-in user's profile.
create function public.mark_singpass_verified(target_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set singpass_verified = true
  where id = target_user
    and id = (select auth.uid());
$$;

revoke execute on function public.mark_singpass_verified(uuid) from public, anon;
grant execute on function public.mark_singpass_verified(uuid) to authenticated, service_role;
