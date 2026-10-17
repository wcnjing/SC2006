-- Reports retain their target UUID after content deletion, preserving reporter history.
alter table public.reports add constraint reports_reason_not_blank
  check (reason ~ '[^[:space:]]') not valid;

-- Clients cannot forge review results or publication timestamps on insertion.
revoke insert on public.reports from authenticated;
grant insert (id, reporter_id, target_type, target_id, reason, details)
  on public.reports to authenticated;

drop policy "users file reports" on public.reports;
create policy "users file reports" on public.reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and public.is_active_user()
    and status = 'open'
    and case target_type
      when 'post' then exists (
        select 1 from public.posts p where p.id = reports.target_id and not p.is_removed
      )
      when 'comment' then exists (
        select 1 from public.comments c
        join public.posts p on p.id = c.post_id
        where c.id = reports.target_id and not c.is_removed and not p.is_removed
      )
      -- Preserve the existing policy for other report types; their feature owners
      -- will add target checks when those reporting flows are implemented.
      else true
    end
  );

-- Existing SELECT RLS allows only the reporter or an active admin. There is no
-- reporter UPDATE/DELETE policy: submitted reports remain reviewable by admins.
create index reports_reporter_history_idx on public.reports
  (reporter_id, created_at desc, id desc);
