-- Restrictive guard also protects direct API inserts, independently of the UI.
create policy "admin accounts cannot be reported" on public.reports
  as restrictive for insert to authenticated
  with check (
    target_type <> 'user' or exists (
      select 1 from public.profiles p
      where p.id = reports.target_id and p.role <> 'admin'
    )
  );
