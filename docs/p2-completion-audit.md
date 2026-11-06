# P2 completion audit

Audit of the private `p2-Activity` branch before team integration. No Supabase
requests, data changes, test-user creation, SQL execution, migrations, seeding,
deployment or merge were performed. Tests use mocked clients and Web rendering.

## Evidence and limits

The user confirmed live success for listing, search, category/location filters,
details, simultaneous Save/Join, independent Unsave/Leave and refresh persistence.
Those live scenarios were accepted as reported; no basic manual/live retest was
performed. The existing automated suite was run as requested for regressions.

Reviewed sources: `README.md`, `docs/api.md`, `docs/proposals/p2-save-join.md`, the
original SQL proposal, migrations, generated types, P2 APIs/screens/tests, and the
P1 auth contract used by P2. No formal use-case specification, screen mockups,
wireframes or Figma references were found among tracked repository files. The
only tracked image assets are app icons/splash resources. Visual conformity and
external requirements therefore cannot be certified from this repository.

## Edge-case results

| Scenario                                     | Automated / code-review evidence                                                                                                                                                                                                                                              | Live result                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Full capacity                                | UI blocks at/above capacity; one remaining seat stays eligible. Mock RPC rejection propagates without success or fallback writes and refreshes state. SQL review finds activity-row lock, joined-only count, capacity comparison and revoked direct insert/update privileges. | Not tested in this audit.                                                                       |
| Two residents competing for last seat        | SQL lock/count/insert sequence reviewed; registration is always routed through the RPC, never a client insert.                                                                                                                                                                | Concurrent PostgreSQL transactions NOT exercised. Mocks do not prove atomicity.                 |
| Cancelled/completed/past/start boundary      | Eligibility helper and Web tests block new Join. A stale eligible snapshot receiving RPC rejection reports an error without success. SQL checks scheduled status and `starts_at <= now()`.                                                                                    | Not tested in this audit.                                                                       |
| Organiser/admin/suspended                    | All five P2 participation APIs reject before bookmark/registration requests in mocked tests; Web controls unavailable. SQL RPC checks active resident and bookmark insert/delete RLS does likewise.                                                                           | Live denial/direct API bypass NOT tested.                                                       |
| Unauthenticated                              | API tests reject before table requests; P2 panel now requires a matching authenticated session as well as a resident profile. Mock server authentication errors are surfaced. SQL uses `auth.uid()` and removes anonymous/public RPC execution.                               | Live denial NOT tested.                                                                         |
| Identity transition                          | Missing session or mismatched session/profile hides controls; matched identity scopes the keyed panel.                                                                                                                                                                        | Rapid account-switch timing NOT exercised live.                                                 |
| Existing joined activity becomes unavailable | Leave remains enabled for full/cancelled/completed/past activities and never touches bookmarks.                                                                                                                                                                               | Basic independent Leave was already user-confirmed; these edge variants were not retested live. |
| Concurrent serialization error               | API preserves `40001`, does not claim success or fall back to unsafe participant writes.                                                                                                                                                                                      | Not induced in a database.                                                                      |

SQL review references the user-reported applied proposal, not an independently
retrieved deployed function/policy definition. Privileged service-role operations
remain outside the resident-client security contract.

## Fixes

1. **P2 identity guard:** profile-only gating could display a prior resident's
   actions while session/profile identities were missing or mismatched. P2 now
   requires `session.user.id === profile.id` and active resident role. No P1 auth
   code was changed; API/RLS remain the security boundary.
2. **Incomplete list/filter data:** the list API previously read only one server
   page. It now fetches pages in start-time/ID order with a fixed cutoff until an
   empty page, respecting even a server cap below the requested page size. Later
   page errors reject the load rather than showing a partial successful list.
   Pagination is not a transaction snapshot: concurrent list edits can still
   change results between pages; this is not registration-capacity enforcement.
3. **Stale P2 documentation:** corrected bookmarks, resident-only Save/Join
   permissions and registration RPC usage in `docs/api.md`. The original SQL
   review artifact was left unchanged.
4. **Regression coverage:** expanded all-action role denials, server-side rejection
   and no-success checks after stale eligible snapshots, capacity boundaries,
   matching sessions, and pagination/error coverage.

## Requirements comparison

| Repository requirement / workflow                                  | Assessment                                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| README: activity discovery                                         | Delivered listing/details/search/filter slice. Basic live success accepted from user.                                                                                                                                             |
| Independent bookmarks and registrations (applied P2 SQL and guide) | Implemented with separate table and RPC; basic live success accepted. Edge database enforcement awaits live verification above.                                                                                                   |
| API contract: capacity enforcement                                 | Implemented SQL contract and client wiring; code-reviewed and mocked error/UI tests pass. Last-seat concurrency is not certified live.                                                                                            |
| API contract: recommendation query/RPC                             | Not implemented; beyond the previously authorized discovery/save/join feature slice. No algorithm or acceptance criteria supplied here.                                                                                           |
| API contract: dataset import with source/external_id               | Not implemented as a production import pipeline. Types/fields and seed fixtures are not a dataset importer.                                                                                                                       |
| Ratings and skip workflows                                         | Schema/legacy enum exist; shared P2 APIs/screens do not implement these workflows. Earlier scope explicitly deferred ratings/recommendations. Direct participant writes are revoked; skip needs a reviewed API if later required. |
| Use-case / mockup conformity                                       | No formal files available in checkout. Must be checked against the team's external specifications before claiming full P2 completion.                                                                                             |

This audit completes validation of the delivered discovery/save/join slice at the
application/mock-test level. It does NOT certify the entire broader P2 module.
Do not mark recommendations, import, ratings or skip as completed requirements.

## Team integration gap

`activity_bookmarks`, `set_activity_registration` and their safeguards are present
in the reported applied SQL and TypeScript contract, but absent from the checked-in
`supabase/migrations/` history. A fresh database built from those migrations alone
will not support this P2 code. P1/P2 must reconcile the already-applied changes
with the team's migration history before reproducible integration. Do not blindly
rerun the original proposal: it contains CREATE statements and legacy data moves.
No migration was created or applied as part of this audit.

## Validation

- `npm run typecheck`: passed.
- `npm test`: 125 tests passed (45 mobile/Web, 80 shared).
- Expo Web export: passed.
- ESLint on changed P2 app/test files: passed.
- Full Expo lint: two existing errors in P1 `InactivityGuard.tsx` (purity and
  self-reference/immutability), left unchanged under the unrelated-code restriction.

## Remaining targeted live verification

In an explicitly approved test environment, using existing authorised accounts:

1. Fill the final seat and try another registration; then coordinate two residents
   joining the last seat concurrently. Verify exactly one new registration succeeds
   and only joined rows consume capacity. Check a repeated successful join uses no
   additional seat. Include unlimited capacity and capacity-reduction safeguards.
2. Attempt new joins for cancelled, completed and already-started activities,
   including an organiser cancelling after another resident loaded eligible details.
3. Attempt Save and Join as organiser/admin/suspended/unauthenticated identities,
   including direct PostgREST/RPC calls that bypass the UI. They must be rejected;
   check direct participant INSERT/UPDATE are denied too.
4. Confirm deployed grants, bookmark policies and RPC definition match the reviewed
   contract, reconcile migration history, and compare the final screens/workflows
   against any externally held use cases/mockups.

No outcome for these unexecuted live checks is claimed here. The approved basic
live cases do not need repeating unless an integration change invalidates them.
