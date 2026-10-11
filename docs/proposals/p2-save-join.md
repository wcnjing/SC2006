# P2 save/join implementation and test guide

The user confirmed that `p2-save-join.sql` was applied to Supabase. That SQL file
is retained as the original review artifact; this task did not execute it or
perform any Supabase data writes, seeding, migrations, or deployment.
TypeScript types were updated from the applied SQL contract, without running
schema-generation commands against the live database.

## Implemented behavior

- Save/Unsave exclusively insert/delete the authenticated resident's
  `activity_bookmarks` row. Repeated saves confirm an existing own bookmark after
  a unique-key conflict; deletes are idempotent. No upsert/update privilege is needed.
- Join/Leave exclusively call `set_activity_registration(target_activity,
  should_join)`. The RPC obtains the resident from `auth.uid()`, checks active
  resident eligibility, serializes joins with an activity-row lock, enforces
  scheduled/future status and capacity, and makes repeated joins idempotent.
- The same resident can save and join an activity simultaneously. Unsave does
  not call registration APIs; Leave does not touch bookmarks.
- Details reload own bookmark and participant status, the latest activity row,
  and an exact joined count on opening, refreshing, or after each action.
- The count is only UI guidance; the RPC is the final capacity/status authority
  if another resident joins or an organiser changes the activity after loading.
- Joining cancelled/completed/past or visibly full activities is disabled;
  existing registrations can still be left. Saving remains independent of joining.
- A clock check updates past-activity guidance while the details page remains open.
- Loading/error states disable actions. Active-resident checks, current-user
  predicates, RLS and the RPC secure access. Duplicate in-flight clicks are ignored,
  and account/activity switches discard the prior UI state.
- Successful actions show confirmation and reload persisted states. RPC/auth/RLS
  errors appear as errors and trigger a state reload, never an optimistic success.

## Checks run without database mutation

```bash
npm run typecheck
npm test
npm exec --workspace apps/mobile -- expo export --platform web
```

Unit/API tests mock Supabase. Web-rendering tests cover eligibility, independent
states, action dispatch, duplicate clicks and retries. No live write or concurrent
transaction tests were run, in accordance with the task's constraints.

## Manual preview

Configure the existing Supabase environment variables and run:

```bash
npm run web --workspace apps/mobile
```

Sign in with an active resident account, open an activity's details, and exercise
these scenarios yourself in an approved test environment:

1. Save, refresh/reopen: Saved Yes / Joined No.
2. Join the saved activity, refresh: Saved Yes / Joined Yes.
3. Unsave while joined: Saved No / Joined Yes.
4. Save again, then Leave: Saved Yes / Joined No.
5. Leave and Unsave, refresh or sign out/in: both No.
6. Compare a second resident's state; it must be independent.
7. Cancelled/completed/past and full activities block new Join but retain Save;
   an existing joined resident can Leave regardless of those conditions.
8. Double-click an action, simulate request failure, and retry: no duplicate
   registrations, bookmark loss, or false success messages.
9. Organiser/admin/suspended/signed-out accounts cannot use resident actions.
10. Where approved, test two residents concurrently joining the last seat. One
    succeeds and the other receives the RPC's full-activity error. Repeated joining
    must not consume another seat; an unlimited-capacity activity accepts joins.

The live RPC/RLS/concurrency behavior depends on the applied SQL contract. It has
not been independently verified by this implementation task because those tests
would modify Supabase data. Do not rerun the retained SQL proposal.

## Migration history adoption (proposed)

See [P2 database readiness review](../p2-database-readiness.md). The new proposed
`20261010150000_p2_save_join_baseline.sql` retains this original SQL byte-for-byte
below a review header. A fresh database applies it before management; the already
manually updated shared database must not replay it. P1 must verify full catalog
parity before approving metadata-only registration of that migration version.
