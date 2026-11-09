# Reporting an account

Open another user's profile and select **Report account**. Choose a reason,
optionally add details, and submit. Administrator accounts cannot be reported.
The report appears in **My reports** and
**Admin dashboard → Reported accounts**. Users cannot report their own account.

Admins review the profile and report, then either dismiss it or suspend the
account with a reason. Real database review atomically records the report
outcome, account suspension and audit entries. Existing account reinstatement
remains available in **Manage users**.

Demo reports persist in the mock community store. For real Supabase, apply
`20261109020000_user_account_reports.sql` after the suspension migrations.
This uses the existing `user` report target enum, adds target visibility and
self-report checks, and extends the audited moderation RPC.
Also apply `20261109030000_prevent_admin_account_reports.sql` to enforce the
administrator exclusion for direct API inserts.

Database integration tests require a local Supabase stack. Run
`npm run test:db` after applying migrations locally.
