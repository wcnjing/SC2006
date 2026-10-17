# P3: reports

Residents can report a visible post or comment with a reason, then view their
own reports at `/reports`. The feature uses P1's existing `reports` table and
auth session. The screen components live outside `src/app` so P5 can replace
the controls/layout while retaining the shared API and behaviour.

## Try it without Supabase

1. Run `npm run web:demo` from the root and choose a resident.
2. Open the community feed, then any post. Choose **Report post**, or use
   **Report comment** under a comment.
3. Enter a reason (required, maximum 100 Unicode code points) and optional
   details (maximum 1,000). Submit the form.
4. Choose **My reports** after submission or from the community feed. Each
   entry shows the content type, submission time, reason/details and status.
5. Switch residents. Each resident has a separate report history. Reloading
   preserves reports; deleting the target post/comment preserves its reports.

The demo is local fixture storage, not proof of real database permissions.
Existing demo posts, comments, likes and sessions survive the storage upgrade.
**Reset demo data** also clears reports. Demo reports start as **Open**; real
review outcomes come from the future admin moderation flow.

## Shared API

Import from `@communitylink/shared`; the typed Supabase client is the first argument.

| Function                                                                       | Behaviour                                                                                                                              |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `submitReport(client, { targetType, targetId, reason, details?, requestId? })` | Submits a post/comment report and returns `SubmittedReport`. Reporter identity comes from the session; status defaults to `open`.      |
| `listMyReports(client, { limit?, cursor?, signal? }?)`                         | Returns `{ reports, nextCursor }`, newest first; default 20, maximum 50. Always filters by the current reporter, including for admins. |
| `validateReportContent(reason, details?)`                                      | Returns a validation message or null; API and form use the same limits.                                                                |

Reason and details are trimmed; blank optional details become null. The form
retains its request UUID across failure, cancel and retry. Repeating that UUID
with the same data returns the existing report, even after the target was
deleted or the report was reviewed. Reusing it with changed data returns a
conflict: submitted reports are immutable to the reporter. A concurrent retry
also recovers the existing row. Separate, deliberate submissions are separate
reports; there is no one-report-per-target limit.

`SubmittedReport` excludes the reviewer's identity. Status is `open`, `actioned`
or `dismissed`. History can display a resolution note if an admin adds one, and
does not fetch the original content: a report remains readable when its target
is blocked, removed or deleted. Reporting alone does not hide/remove content.

## Database migration

`20261017120000_p3_reports.sql`:

- Rejects whitespace-only reasons while preserving old rows (`NOT VALID`).
- Restricts inserts to the report ID, reporter, target, reason and details.
  Clients cannot supply review metadata or publication timestamps.
- Requires an active signed-in reporter and a visible, nonremoved post/comment.
  Comment reports also require a visible, nonremoved parent post. Database RLS
  enforces block visibility and rejects fabricated target IDs.
- Adds an index for stable personal-history pagination by timestamp and ID.

Existing RLS lets reporters read only their own reports and lets active admins
review all reports. Reporters cannot edit/delete submissions. Other report
target types retain their existing policy; this increment exposes only posts
and comments. No enum, table-column or generated-type changes are needed.

Apply the migration locally or through P1's migration/PR workflow before relying
on the additional protections. This increment does not deploy it to the shared
project. Admin queue/removal/audit and notification delivery remain separate work.

## Verification

- `npm test`: API HTTP-contract, demo persistence/privacy, form failure/retry and
  stale history-request tests, plus the existing post/comment/like tests.
- `npm run test:web:demo --workspace apps/mobile`: actual browser submission for
  both target types, validation/cancel, reload, resident privacy and history
  after target deletion, plus the existing browser flows.
- `npm run typecheck` and `npm run lint --workspace apps/mobile`.
- `npm run test:db`: local Supabase only. Covers real report privacy, target
  visibility, suspended sessions, insert metadata, immutability, review outcomes
  and timestamp-tied pagination. Requires Docker and a running local stack.

Routes follow [Expo Router navigation](https://docs.expo.dev/router/basics/navigation/).
