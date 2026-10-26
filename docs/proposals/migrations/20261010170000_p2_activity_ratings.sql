-- PROPOSED / TEAM REVIEW ONLY. Not executed against the shared project.
-- Existing INSERT RLS already requires own joined registration and ends_at < now().
-- Add the missing resident role and non-cancelled checks without changing fields,
-- SELECT permissions, uniqueness, or existing UPDATE/DELETE workflows.
begin;
create policy "P2 active residents rate concluded activities" on public.activity_ratings
  as restrictive for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_user()
    and public.current_user_role() = 'resident'
    and exists (
      select 1 from public.activities a
      join public.activity_participants p on p.activity_id = a.id
      where a.id = activity_ratings.activity_id
        and p.user_id = (select auth.uid()) and p.status = 'joined'
        and a.status <> 'cancelled' and a.ends_at < now()
    )
  );
commit;
