# Organiser approval

Sign in as an administrator and open **Admin dashboard → Verify organisers**.
Search by display name or ID, review the person's identity, and select
**Approve as organiser**. Confirm to grant the organiser role. The user must
sign in again to load organiser access. Existing organisers count as approved.
Suspended accounts and administrator accounts cannot be approved.

This uses the existing role model: there is no separate application queue or
document upload. Review identity outside the app before granting access.

Demo mode persists approval in the local mock account store. For real Supabase,
apply `20261109010000_verify_organiser.sql`. Its restricted RPC checks the active
administrator and active resident target, locks the relevant rows, and writes
an audit entry atomically. Mock approvals do not write database audit entries.

Run `npm run test:admin` and `npm run typecheck`. The local database suite
(`npm run test:db`) also checks permissions, suspension, repeat approvals,
self-approval and audit recording; it requires a running local Supabase stack.
