-- FR 8.4.3 / UC ReportActivity: residents report activities; admins review them in
-- the same queue as posts and comments. "Remove" cancels the activity.

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
      when 'activity' then exists (
        select 1 from public.activities a
        where a.id = reports.target_id and a.status <> 'cancelled'
      )
      when 'user' then reports.target_id <> (select auth.uid()) and exists (
        select 1 from public.profiles p where p.id = reports.target_id
      )
      else false
    end
  );

create or replace function public.review_content_report(
  p_report_id uuid,
  p_action text,
  p_reason text
)
returns setof public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.reports%rowtype;
  v_reason text := pg_catalog.btrim(p_reason);
  v_removed boolean;
  v_status public.report_status;
begin
  -- Hold the role/status row until commit so a concurrent suspension/demotion
  -- cannot race the permission check. Caller identity always comes from auth.
  perform 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
    for share;
  if not found then
    raise exception 'Only active admins can moderate reports.' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('remove', 'dismiss') then
    raise exception 'Choose remove or dismiss.' using errcode = '22023';
  end if;
  if v_reason is null or v_reason !~ '[^[:space:]]' or pg_catalog.char_length(v_reason) > 1000 then
    raise exception 'Enter a moderation reason of 1 to 1000 characters.' using errcode = '22023';
  end if;
  v_status := case when p_action = 'remove' then 'actioned'::public.report_status
    else 'dismissed'::public.report_status end;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'Report not found.' using errcode = 'P0002';
  end if;
  if v_report.status <> 'open' then
    -- Recover a lost response, without duplicating an audit event or changing
    -- a prior decision. A different admin/action/reason must refresh instead.
    if v_report.status = v_status and v_report.reviewed_by = (select auth.uid())
      and v_report.resolution_note = v_reason then
      return next v_report;
      return;
    end if;
    raise exception 'This report was already reviewed. Refresh before continuing.' using errcode = '40001';
  end if;

  if p_action = 'remove' then
    if v_report.target_type = 'post' then
      select is_removed into v_removed from public.posts where id = v_report.target_id for update;
      if not found then
        raise exception 'The reported post was deleted. Dismiss the report with a reason.' using errcode = 'P0002';
      end if;
      if not v_removed then
        update public.posts set is_removed = true, removed_reason = v_reason where id = v_report.target_id;
      end if;
    elsif v_report.target_type = 'comment' then
      select is_removed into v_removed from public.comments where id = v_report.target_id for update;
      if not found then
        raise exception 'The reported comment was deleted. Dismiss the report with a reason.' using errcode = 'P0002';
      end if;
      if not v_removed then
        update public.comments set is_removed = true, removed_reason = v_reason where id = v_report.target_id;
      end if;
    elsif v_report.target_type = 'activity' then
      -- Removing a reported activity cancels it, so joiners see why (FR 8.4.3, 12.1.2).
      select status = 'cancelled' into v_removed from public.activities
        where id = v_report.target_id for update;
      if not found then
        raise exception 'The reported activity was deleted. Dismiss the report with a reason.' using errcode = 'P0002';
      end if;
      if not v_removed then
        update public.activities set status = 'cancelled', cancelled_reason = v_reason
          where id = v_report.target_id;
      end if;
    elsif v_report.target_type = 'user' then
      select status = 'suspended' into v_removed from public.profiles
        where id = v_report.target_id for update;
      if not found then
        raise exception 'Account no longer exists. Dismiss this report.' using errcode = 'P0002';
      end if;
      perform public.set_user_status(v_report.target_id, 'suspended', v_reason);
    else
      raise exception 'Unsupported report target.' using errcode = '22023';
    end if;
  end if;

  update public.reports set status = v_status, reviewed_by = (select auth.uid()),
    reviewed_at = pg_catalog.now(), resolution_note = v_reason
    where id = v_report.id returning * into v_report;

  perform public.write_audit_log(
    case when p_action = 'remove' then 'remove_content' else 'dismiss_report' end,
    case when p_action = 'remove' then v_report.target_type::text else 'report' end,
    case when p_action = 'remove' then v_report.target_id::text else v_report.id::text end,
    pg_catalog.jsonb_build_object('report_id', v_report.id, 'reason', v_reason,
      'target_type', v_report.target_type, 'target_id', v_report.target_id,
      'from', 'open', 'to', v_status,
      'content_changed', p_action = 'remove' and not coalesce(v_removed, false))
  );
  return next v_report;
end;
$$;

