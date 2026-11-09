-- Auth + role-based access helpers (P1)
-- Policies in the next migration call these helpers; P2/P3/P4 can call them
-- in their own policies and functions too.

-- ---------------------------------------------------------------------------
-- Create a profile row whenever someone signs up.
-- Pass display_name in sign-up metadata: supabase.auth.signUp({ options: { data: { display_name } } })
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Resident'), 50)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Role / status helpers. security definer so they can read profiles without
-- recursing through profiles' own RLS policies.
-- ---------------------------------------------------------------------------
create function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select status = 'active' from public.profiles where id = (select auth.uid())),
    false
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role = 'admin' and status = 'active' from public.profiles where id = (select auth.uid())),
    false
  );
$$;

-- Organisers and admins can both create activities.
create function public.is_organiser()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role in ('organiser', 'admin') and status = 'active' from public.profiles where id = (select auth.uid())),
    false
  );
$$;

create function public.is_blocked_between(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = user_a and blocked_id = user_b)
       or (blocker_id = user_b and blocked_id = user_a)
  );
$$;

create function public.are_connected(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.connections
    where status = 'accepted'
      and ((requester_id = user_a and addressee_id = user_b)
        or (requester_id = user_b and addressee_id = user_a))
  );
$$;

-- ---------------------------------------------------------------------------
-- Audit log writer. Not callable from the client: only other security definer
-- functions (e.g. set_user_role below, P3's moderation functions) use it.
-- ---------------------------------------------------------------------------
create function public.write_audit_log(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_details jsonb default '{}'
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), p_action, p_target_type, p_target_id, p_details);
$$;

revoke execute on function public.write_audit_log(text, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin-only role and status changes. Users cannot change their own role or
-- status directly (column grants in the next migration block it).
-- Client: supabase.rpc('set_user_role', { target_user, new_role })
-- ---------------------------------------------------------------------------
create function public.set_user_role(target_user uuid, new_role public.user_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_role public.user_role;
begin
  if not public.is_admin() then
    raise exception 'Only admins can change roles' using errcode = '42501';
  end if;
  if target_user = (select auth.uid()) and new_role <> 'admin' then
    raise exception 'Admins cannot remove their own admin role' using errcode = '42501';
  end if;

  select role into old_role from public.profiles where id = target_user for update;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  update public.profiles set role = new_role where id = target_user;
  perform public.write_audit_log('set_role', 'user', target_user::text,
    jsonb_build_object('from', old_role, 'to', new_role));
end;
$$;

-- Client: supabase.rpc('set_user_status', { target_user, new_status, reason })
create function public.set_user_status(
  target_user uuid,
  new_status public.account_status,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_status public.account_status;
begin
  if not public.is_admin() then
    raise exception 'Only admins can suspend or reinstate users' using errcode = '42501';
  end if;
  if target_user = (select auth.uid()) then
    raise exception 'Admins cannot change their own status' using errcode = '42501';
  end if;

  select status into old_status from public.profiles where id = target_user for update;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  update public.profiles
  set status = new_status,
      suspended_reason = case when new_status = 'suspended' then reason end
  where id = target_user;
  perform public.write_audit_log(
    case when new_status = 'suspended' then 'suspend_user' else 'reinstate_user' end,
    'user', target_user::text,
    jsonb_build_object('from', old_status, 'to', new_status, 'reason', reason));
end;
$$;

revoke execute on function public.set_user_role(uuid, public.user_role) from public, anon;
revoke execute on function public.set_user_status(uuid, public.account_status, text) from public, anon;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;
grant execute on function public.set_user_status(uuid, public.account_status, text) to authenticated;
