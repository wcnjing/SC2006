# P3: admin moderation

Active admins can list reports, review the current reported post/comment,
remove content or dismiss a report, and inspect the moderation audit log.
P1's auth, roles, tables and `write_audit_log()` helper are reused. The feature
components are separate from the routes and shared APIs so P5 can restyle them.

## Try it without Supabase

1. Run `npm run web:demo`. Choose Yining or Auntie Mei and create/report a post
   or comment as described in [P3 reports](p3-reports.md).
2. Choose **Switch demo resident**, then **Continue as Demo Admin**.
3. Open **Admin moderation** from the demo home or community feed. The queue
   starts with **Open** reports; use the status buttons to inspect outcomes.
4. Choose **Review report** to see the reporter's reason/details and current
   content, including a comment's parent post. Removed content remains visible
   here. Content deleted by its author is shown as unavailable.
5. Enter a **Moderation reason** (required, maximum 1,000 Unicode code points).
   The reason will be visible to the reporter and stored in the audit log.
6. Choose **Remove content** or **Dismiss report**, then confirm. **Keep
   reviewing** cancels without making changes.
7. Open **Moderation audit log** to see the decision, admin ID, target,
   timestamp, reason and report reference. Switch back to the reporter to see
   the outcome in **My reports**.

Demo Admin is a local fixture account, not a way to grant real admin access.
Existing browser data is preserved when audit storage is first added. **Reset
demo data** also resets decisions/audit entries. The same screens call Supabase
in normal mode; real database permissions require local Supabase/CI verification.

## Shared API and routes

Every shared function takes the typed Supabase client first.

| Function                                                                | Behaviour                                                                                                                                                 |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listModerationReports(client, { status?, limit?, cursor?, signal? }?)` | Admin queue with `{ reports, nextCursor }`; default status `open`, limit 20, maximum 50. Status can be `open`, `actioned`, `dismissed` or `all`.          |
| `getModerationReport(client, id, { signal? }?)`                         | `{ report, content }` or null for a missing report. Includes removed content and public author fields. Missing targets have null content.                 |
| `reviewContentReport(client, id, action, reason)`                       | Calls the audited database transaction; action is `remove` or `dismiss`. Returns the reviewed report.                                                     |
| `listModerationAudit(client, { limit?, cursor?, signal? }?)`            | Admin-only `{ entries, nextCursor }` for moderation decisions, ordered by unique audit ID. P1's `listAuditLog` remains available for the full system log. |

- `/admin/moderation`: queue and status filters.
- `/admin/moderation/[id]`: content review, reason and confirmation.
- `/admin/audit`: moderation decision history.

`AdminGuard` uses `can(profile, 'report:review')`; direct routes deny residents.
Queue/content/audit APIs additionally verify the current profile. These client
checks support the UI; database RLS and the RPC's own active-admin check enforce
access when callers bypass the app.

## Database behaviour

Apply `20261017130000_p3_moderation.sql` through P1's migration/PR workflow. It
adds `review_content_report(uuid, text, text)`, an admin-only `security definer`
function with an empty search path and server-derived actor identity. A matching
RPC signature is included in `database.types.ts`; P1 should regenerate types
after applying the migration. The shared project has not been changed by this work.

The function locks the admin profile and report, then commits the decision,
content change (if any) and `write_audit_log()` event in one transaction:

- **Remove:** marks a post/comment `is_removed`, sets its removal reason, and
  sets the selected report to `actioned` with reviewer, time and resolution note.
  It does not physically delete the content. Normal feeds/threads exclude it;
  admins can still inspect it through the review API.
- **Dismiss:** sets the report to `dismissed` with reviewer, time and resolution
  note, leaving content as it is. Reports with missing targets can be dismissed.
- Each successful decision records one `remove_content` or `dismiss_report`
  audit entry. Queue reads and opening a review are read-only operations.
- The selected report alone is resolved. If another report targets content
  already removed, **Resolve as already removed** resolves that report without
  overwriting the original removal reason; its audit entry has
  `content_changed: false`.
- Retrying the same admin/action/reason on a reviewed report returns the prior
  result without another audit entry. A different decision returns `40001`
  and requires refreshing; there is no reopen/override flow in this increment.
- Unsupported target types cannot be removed by this function. The queue can
  show them and admins can dismiss them with a reason.

The migration revokes direct report-review updates and drops their update
policy, requiring the audited RPC. Direct content moderation metadata writes
and direct audit inserts remain denied. An audit failure rolls back the whole
decision. The RPC's write permissions remain restricted even if UI checks are bypassed.

## Verification

- `npm test`: shared HTTP-contract tests, demo permissions/atomic persistence,
  duplicate/conflicting decisions, removed/missing targets, queue/audit pagination
  and stale filter responses, plus existing feature tests.
- `npm run test:web:demo --workspace apps/mobile`: full resident report → admin
  review → remove/dismiss → audit → reporter outcome; also checks direct-route
  denial, reason validation, confirmation cancel, deleted targets and reload.
- `npm run typecheck` and `npm run lint --workspace apps/mobile`.
- `npm run test:db`: requires local Supabase. Added cases exercise RPC/RLS
  permissions, real content/report/audit changes, concurrent retries/conflicting
  admins, protected columns and failure paths. These cases must pass in a local
  stack or CI before deploying the migration.

The screens follow the [Expo Router reference](https://docs.expo.dev/versions/v57.0.0/sdk/router/).
