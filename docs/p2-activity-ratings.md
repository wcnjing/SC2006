# P2 activity ratings and reviews

Implements the supplied FR 9.1.1–9.1.5 / UC #5-07 RateActivity requirements.
The checkout does not contain the original submitted Lab 2 narratives/mockups or
an editing/deletion requirement, so neither workflow is exposed or added to the API.

## Existing database contract inspected

- `activity_ratings`: `(activity_id, user_id)` primary key; required integer `rating`
  constrained to 1–5; nullable `comment` constrained to 1,000 characters; `created_at`.
- SELECT is granted through RLS to signed-in users, not anonymous visitors.
- INSERT requires own user ID, active account, a current `joined` participant row and
  `activities.ends_at < now()`. It does not require the resident role or reject
  cancelled activities. No table or column was invented.
- Existing own-row UPDATE/DELETE grants/policies remain in place; the feature does
  not call them or infer that they represent submitted editing/deletion requirements.
  Any lifecycle change to those permissions needs a separate team decision.
- Inspection used repository schema/types, RLS definitions and the shared API contract.
  Deployed RLS parity has not been independently inspected or verified. No live data
  was read/written, and no SQL or migration was executed.

## Implemented

Activity details now display all existing reviews, stars, dates and optional feedback,
plus a one-decimal average and count. Rating pages are read until empty with stable
ordering, so a low server row cap cannot silently truncate the average. A page failure
shows an error rather than a partial average. Empty ratings are shown as No ratings yet.
Reviews are rendered as escaped text; no HTML interpretation or extra profile data is used.

All signed-in users can read reviews under the existing policy. An active resident with
a matching session/profile sees eligibility feedback and a 1–5-star selector once:

1. The resident still has a participant row with `status = joined`.
2. The activity end timestamp is strictly before now, matching existing RLS. Both
   scheduled-but-ended and completed activities qualify; the completed flag alone
   cannot allow an early rating. Cancelled activities do not qualify.
3. There is no existing own rating.

A Joined activities to review link gives residents access to concluded joined activities,
which are absent from the upcoming listing. It uses the existing participant/activity FK,
filters current joined ownership and end time, and excludes cancellation. Both unrated
and already-rated activities are included so residents can reopen reviews.

Submission validates integer stars and optional feedback (trimmed, 1,000 Unicode code
points, matching PostgreSQL char_length), rechecks auth/profile/activity/participation,
and performs an INSERT only. The database primary key is the atomic duplicate guard;
a duplicate error never overwrites an existing rating. In-flight clicks are guarded,
controls disable while submitting, success/error messages are clear, and eligibility/
reviews refresh after writes or conflicting server errors. Saved/Joined state is not changed.

Existing ratings suppress the form after refresh/reopening, even if the resident has
since left. No edit/delete UI, API, database type change, dependency or notification
workflow was added. Other P2 functionality remains covered by the existing tests.

## Data limits and pending SQL review

`supabase/migrations/20261010170000_p2_activity_ratings.sql` is **proposed and unexecuted**.
It adds a restrictive INSERT policy requiring an active resident and a non-cancelled
ended activity while retaining joined/ownership checks. Existing SELECT, UPDATE,
DELETE and uniqueness constraints remain unchanged. It has been inspected against
repository definitions, not executed or verified against PostgreSQL/deployed policies.
P1/team review and isolated verification are required before application.

Until that review/application, callers bypassing the P2 API may still exploit the
missing resident/non-cancelled checks in the original INSERT policy. Existing UPDATE/
DELETE permissions are not constrained by this proposal, and one-row uniqueness does
not establish an immutable lifetime submission history if clients use those permissions.

The schema has no attendance/registration history once Leave deletes a joined row.
A resident who left before rating cannot prove prior attendance and cannot rate under
existing RLS. Historical attendance eligibility would need additional team-approved
data/API support; this implementation does not pretend a bookmark proves attendance.

Paged reads are not a transactional snapshot across simultaneous external edits, so
live values are refreshed on focus/explicit refresh. A database aggregate/summary API
may be appropriate for very large review volumes, but no new RPC is assumed here.

## Preview and live verification

Run `npm run web --workspace apps/mobile`. With an existing active resident, open
Joined activities to review from Upcoming activities, then select a concluded activity.
Alternatively open `/activities/<existing-activity-uuid>` directly. Joined residents
can select stars, optionally enter feedback, and submit. Other signed-in users can
read the same details/reviews. No test users or records were created during development.

Automated tests use mocked clients and isolated fixtures only, covering eligibility,
end-time boundaries, roles/session ownership, duplicates, feedback validation, public
read permissions, pagination/average accuracy, server failures, escaped text, UI states,
duplicate clicks and persisted own ratings. Live submission/persistence, deployed RLS,
concurrent duplicate requests, timing at the end boundary and policy proposal execution
still require separate authorised verification. No live scenario is claimed passed here.

Development validation passed: all 277 mocked/isolated tests (99 app, 178 shared),
root TypeScript checks, Expo Web production export and changed-file ESLint.
Full-app Expo lint still reports the two pre-existing P1 `InactivityGuard.tsx`
errors (`react-hooks/purity`, `react-hooks/immutability`); that file was not changed.

## Subsequent migration readiness review

The original rating INSERT proposal remains unchanged and unexecuted. A separate
`20261010190000_p2_integration_hardening.sql` now proposes revoking direct rating
UPDATE/DELETE (including column UPDATE privileges), closing the lifecycle bypass
identified above. This is review-only and requires P1/team confirmation of the
submitted no-edit/delete workflow; current deployed permissions are not claimed
changed. See [P2 database readiness](p2-database-readiness.md) for ordering and gates.
