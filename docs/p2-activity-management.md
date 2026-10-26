# P2 organiser activity management

Implements FR 11.1.1–11.1.3, FR 11.2.1–11.2.3 and UC #7-01/#7-02/#7-03
using the detailed requirements supplied by P2. The original submitted Lab 2
use-case narratives and mockups are not present in this checkout, so no claim
is made that their unseen fields or alternative flows were verified.

## Schema and permission inspection

Reviewed the initial schema, grants/RLS and auth helpers in `supabase/migrations`,
the shared API contract/types, existing activity UI, and the user-confirmed applied
`docs/proposals/p2-save-join.sql`. All form fields exist in `public.activities`.
No live schema/RLS introspection was available through an administrative connector;
deployed policy parity still needs P1 verification. No live records or SQL were changed.

Existing INSERT RLS requires an own organiser activity and `is_organiser()` (which
also permits active admins). Existing UPDATE RLS checks ownership OR active admin,
but does not enforce organiser role/status, start time or mandatory reason.
The applied Save/Join SQL already provides `activities_capacity_guard`; capacity
changes lock the same activity row as `set_activity_registration` and cannot be
below the joined count. That function/trigger is reused unchanged.

## Delivered behaviour

- Active organisers with matching session/profile IDs see Create activity / My
  activities links in the listing and Manage this activity on their own details.
  Direct management routes are guarded too. The P2 organiser UI does not expose
  admin moderation; existing database admin permissions are retained.
- Create requires a 3–120-character name, description, category, venue/location,
  future start and end after start. Date/time is entered as YYYY-MM-DD HH:mm in
  Singapore time and persisted as UTC timestamps. Invalid calendar dates fail.
- The form also supports address, positive integer or unlimited capacity,
  non-negative SGD price, indoor/outdoor, accessibility features, tags and optional
  paired coordinates. Existing neighbourhood/source/external metadata is preserved
  during edits; ownership and generated fields are never accepted from form input.
- Edit requires an own scheduled organiser activity whose original and proposed
  start times are future. An exact joined-count check gives friendly capacity
  feedback; the database capacity trigger is authoritative for concurrent joins.
- Cancellation is a separate status/reason update with a mandatory nonblank reason
  and explicit confirmation. Under Lab 2 UC #7-03, organisers may cancel their own
  scheduled activities only before the original start time. The UI and API reject
  attempts at or after start; the proposed database trigger checks server time,
  including requests that wait on locks. Completed/cancelled
  activities cannot be managed. Cancellation cannot also edit other fields.
- All writes recheck authentication and profile permissions. Updates/cancellation
  filter by ownership, scheduled status and original version; stale forms and
  RLS-filtered zero-row changes produce an error rather than false success.
- Review then confirm, success/error messages and in-flight guards prevent duplicate
  clicks. Returning to a focused activity screen reloads its data. Manual refresh
  remains available. Creation/updates therefore use the existing listing/details/
  combined filter pipeline, and cancelled activities disappear from upcoming results.
- Cancellation never deletes participant rows or bookmarks; residents can still
  leave/unsave independently through the existing APIs. No Save/Join logic changed.

## Proposed database safeguard — not executed

`supabase/migrations/20261010160000_p2_activity_management.sql` is a proposed migration,
reviewed against the repository contract only; it is **not deployed or database-tested**.
P1/team approval and isolated PostgreSQL/Supabase verification are still required.

It adds a restrictive UPDATE policy requiring active organiser ownership/source,
with the existing active-admin exception, plus an INSERT/UPDATE trigger enforcing
required fields, future creation, pre-start edits, scheduled-only organiser state
changes, cancellation-only mutations and a mandatory reason. The actor profile is
locked against concurrent suspension/demotion. It preserves trusted admin/service
paths and does not implement P5 moderation. Database constraints continue to enforce
end-after-start, positive capacity and non-negative costs.

It checks that the already-applied capacity guard exists and is enabled; no duplicate
capacity trigger is added. Before approval, compare deployed helpers, grants/policies,
trigger/function ownership, trigger enabled states and legacy records with this file.
Do not auto-run migrations from this branch. The shared migration history still does
not contain the previously manually applied Save/Join proposal; P1 must reconcile
that history before a clean migration replay.

Required isolated/live verification after review (not claimed passed here): direct
REST writes by resident/suspended/demoted organisers, ownership violations, edits at
start-time boundaries, cancellation without reason, simultaneous last-seat joins
versus capacity reductions, concurrent account suspension, and stale-edit conflicts.
Normal READ COMMITTED serialization relies on the existing Join RPC/guard contract;
serialization/deadlock errors must be retried by reopening/refreshing, not hidden.
Until reviewed SQL is applied, existing deployed UPDATE RLS still has business-rule
gaps for callers bypassing the P2 API, despite client checks.

## P4 notification integration

No notification rows, notification delivery, trigger or RPC were added.
P4 should attach server-side AFTER UPDATE handling for committed activity detail
changes and the scheduled-to-cancelled transition. Existing fields provide activity
ID, title, organiser ID, updated_at, status/reason and old/new date/location values.
Joined recipients can be selected from `activity_participants` where status = joined;
saving alone does not register someone and should not imply attendance notifications.
P4 owns recipient policy, durable delivery, retries and deduplication (for example
activity ID + committed version + event kind). Do not send from the client; failed
or conflicting writes must not notify. Coordinate any participant cleanup separately
so notification recipients and resident Leave semantics are not lost.

## Preview and verification

Run `npm run web --workspace apps/mobile` with the existing Supabase configuration.
An existing active organiser can open Create activity or My activities from Upcoming
activities. Select an owned activity to edit or cancel, review details/reason and
confirm. No test users or records were created during development.

Automated tests use mocked clients/fixtures only: creation, validation, ownership,
role/status/session guards, started activities, joined-count bounds, stale changes,
server rejections, confirmation and duplicate clicks. Existing Save/Join and filter
suites are included. Typecheck, tests and Web export are run without database tests.
Live create/edit/cancel and database enforcement require the team's separate review
and authorised environment verification; they have not been claimed passed here.

Development checks passed: 218 mocked/isolated tests (80 app, 138 shared), root
TypeScript checks, Expo Web production export and changed-file ESLint. Full-app
Expo lint still fails on the two pre-existing P1 `InactivityGuard.tsx` errors
(`react-hooks/purity` and `react-hooks/immutability`); that unrelated file was not changed.
