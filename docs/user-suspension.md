# Account suspension

Open **Admin dashboard → Manage users** while signed in as an administrator.
Search by display name or user ID and filter by Active or Suspended.
Select **Suspend account**, enter a reason, then confirm. Suspended accounts
show their reason and a **Reinstate account** action with a confirmation prompt.
Administrators cannot change their own status.

The screen uses the existing UI kit and `adminService`. With Supabase configured,
the service reads profiles and calls the existing `set_user_status` RPC through
`setUserStatus`. That function enforces administrator permissions, updates the
profile, and records the change in the database audit log. Apply migration
`20261109000100_enforce_account_suspension.sql` before using this feature.

Authentication rejects suspended accounts when loading their session profile.
Existing sessions recheck account status every 30 seconds and on foreground,
then leave the app when suspension is confirmed. Network errors do not sign users
out. Restrictive database policies immediately block authenticated writes,
including Storage uploads, and application reads except the user's own profile
and public neighbourhood reference data. Auth tokens are not revoked, and public
image URLs remain public. Existing security-definer RPCs enforce active status
separately from RLS.

In demo mode, status and suspension reasons persist in the mock account store.
Login rejects suspended accounts, and reinstatement allows login again. Mock
changes do not write a database audit log.

Validation:

```powershell
npm run test:admin
npm run typecheck
npm run lint --workspace apps/mobile
```

For a manual demo, run `npm run web:demo`, sign in with `admin@test.com` /
`Password1`, suspend `Resident Rachel`, sign out, and verify that
`resident@test.com` / `Password1` is rejected. Sign back in as admin and reinstate
Rachel, then verify resident login succeeds. Use the team's seeded password
instead when testing against Supabase.
