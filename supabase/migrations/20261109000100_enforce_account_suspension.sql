-- Restrictive policies compose with every existing permissive policy. A valid
-- Auth token must not let a suspended account continue writing through the API.
do $$
declare
  target record;
begin
  for target in
    select n.nspname, c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p') and c.relrowsecurity
      and (n.nspname = 'public' or (n.nspname = 'storage' and c.relname = 'objects'))
  loop
    execute format(
      'create policy suspension_insert_guard on %I.%I as restrictive for insert to authenticated with check ((select public.is_active_user()))',
      target.nspname, target.relname);
    execute format(
      'create policy suspension_update_guard on %I.%I as restrictive for update to authenticated using ((select public.is_active_user())) with check ((select public.is_active_user()))',
      target.nspname, target.relname);
    execute format(
      'create policy suspension_delete_guard on %I.%I as restrictive for delete to authenticated using ((select public.is_active_user()))',
      target.nspname, target.relname);
  end loop;
end;
$$;

-- Keep the caller's own profile readable so login and session checks can explain
-- suspension, but prevent suspended sessions from browsing application data.
do $$
declare
  target record;
begin
  for target in
    select c.relname from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and c.relrowsecurity and c.relname not in ('profiles', 'neighbourhoods')
  loop
    execute format(
      'create policy suspension_read_guard on public.%I as restrictive for select to authenticated using ((select public.is_active_user()))',
      target.relname);
  end loop;
end;
$$;

create policy suspension_read_guard on public.profiles
  as restrictive for select to authenticated
  using (id = (select auth.uid()) or (select public.is_active_user()));
