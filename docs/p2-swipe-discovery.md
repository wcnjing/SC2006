# P2 → P5 activity swipe discovery contract

Scope: P2 activity records, read/write APIs and exclusions for FR 3.2.1–3.2.6 / UC #5-04 BrowseActivity. P5 (Summer) owns the screen, swipe gestures, button alternatives, confirmation/success/error presentation and deck animation. No P5 screen or teammate feature is changed here. The complete submitted Lab 2 narratives/data dictionary are not present in this checkout; this contract implements the supplied behaviours and maps Like/Save to bookmarks, not registration. Team review must confirm any additional unpublished wording.

## Database readiness — persistent Skip is blocked until review/adoption

Repository schema: `activity_participants` has one row per `(activity_id,user_id)` and enum `joined | saved | skipped`. `activity_bookmarks` is independent. Own participant rows and joined lists are RLS-readable; bookmark reads are own-user only. The applied Save/Join proposal revoked participant INSERT/UPDATE, including the column UPDATE(status) grant. Existing permissive participant write policies therefore do not grant a usable direct write route. No client writes to participants are added.

**Review-only proposed migration:** [proposals/p2-swipe-discovery.sql](proposals/p2-swipe-discovery.sql). It adds only `public.skip_activity(target_activity uuid) returns boolean`. Dependency: the existing schema/RLS/auth helpers and **applied `p2-save-join.sql`**, including independent bookmarks, direct participant write revocations and the activity-locking registration RPC. The TypeScript function signature is a proposed contract, not evidence the RPC exists on the shared database. No SQL or live data changes were executed here.

The RPC derives the resident from `auth.uid()`, verifies active resident role under a profile share lock, locks the activity in the same order as Join, and inserts only the own `skipped` participant row. Duplicate Skip is idempotent, including retries after cancellation/start. New Skip rejects missing, cancelled, completed or started activities. Full upcoming activities may be skipped or bookmarked; neither action takes a seat. Already joined activities reject Skip instead of cancelling/replacing the registration. Unexpected legacy `saved` rows reject Skip rather than lose the legacy save. No bookmark is read, deleted or changed by this function. Its fixed empty search path, qualified objects and explicit execution grants restrict the security-definer entry point to authenticated callers; it still validates role/status itself. Direct participant write grants remain revoked.

A later explicit Join may replace an existing `skipped` status with `joined` through the existing registration RPC; Leave then removes the joined row. **The existing single-row schema cannot retain independent lifelong Skip history alongside a joined registration.** The browsing session exclusion list prevents the card returning in that same session even after this transition. Outside that session, after Join/Leave and without restored session IDs, the activity can be discoverable again. No new history table or permanent dislike preference is invented.

Thus Skip is designed to be **persistent plus session-excluded**, once the RPC is adopted. Until then, Skip fails with `ApiError.code === 'skip_unavailable'`; there is no session-only fallback masquerading as a successful write. Existing persisted `skipped` rows can already be read/filtered. Save/Like use the already available bookmark API.

## Typed APIs (`@communitylink/shared`)

| API | Contract |
| --- | --- |
| `listSwipeActivities(client, options?)` | Active-resident-only batch of future scheduled activities, chronological by start then ID via existing `listActivities`. Excludes own `skipped`, `joined`, bookmarks and passed session IDs. Default 20, allowed integer limit 1–100. Empty array means no matches for these exclusions/filters at this read snapshot. |
| `skipActivity(client, activityId)` | Calls only `skip_activity` with the target UUID. Returns `Promise<void>` only after server `true` confirmation; otherwise throws. No user ID argument or direct participant write. |
| `likeActivity(client, activityId)` | Alias of existing `saveActivity`. Idempotent own bookmark insert with existing duplicate confirmation. Does not register or alter Skip. |
| `recordActivityInteraction(client, activityId, action)` | Typed `action: 'like' \| 'save' \| 'skip'`. Like/Save → bookmark; Skip → RPC. Invalid action/UUID is rejected. No Join action. |
| `createActivityDiscoverySession(client, restoredIds?)` | Recommended headless integration: binds to the current resident and returns `ActivityDiscoverySession`. Use once per browsing session; destroy on sign-out/resident change. No platform-specific API or storage dependency. |
| `discovery.load(options?)` | Applies database exclusions plus confirmed in-memory decisions and pending IDs; also filters late results so a successful concurrent action cannot revive a card. |
| `discovery.act(activityId, action)` | Coalesces concurrent identical actions per card (Like and Save are equivalent); rejects conflicting actions with `busy`. Confirmed success adds the ID to the session exclusions. Failure leaves it available and allows retry. |
| `discovery.excludedActivityIds` | Copy of confirmed session exclusion IDs, for P5 to optionally restore in a per-resident browsing session. Mutating the copy cannot alter internal state. |

Options: `{ filters?: ActivityFilters, excludedActivityIds?: readonly string[], limit?: number, signal?: AbortSignal }`. Existing keyword, category, location, inclusive Singapore calendar dates, all requested accessibility features, indoor/outdoor and straight-line radius filters are reused together. Invalid filters/limit produce validation errors, rather than a misleading empty result. All activity and exclusion pages are fetched until empty, so lower PostgREST row limits do not silently revive later skipped/bookmarked cards. Read errors fail the batch rather than return partially filtered results. This is a batch API over existing paginated reads, not a new cursor/RPC/schema or a personalised recommendation ranking. Full activities remain available to bookmark; details enforce Join capacity through the existing RPC.

## Minimal P5 integration

```ts
import { createActivityDiscoverySession, ApiError } from '@communitylink/shared';

// Create in P5's screen/controller once the active resident is known.
const discovery = await createActivityDiscoverySession(supabase);
let cards = await discovery.load({ filters, limit: 20 });
const card = cards[0]; // Display exactly one card; P5 owns UI/gestures/buttons.

if (card) {
  try {
    await discovery.act(card.id, 'skip'); // left / Skip button
    // For right / Like / Save: await discovery.act(card.id, 'like');
    // Advance/remove the handled card only after confirmed success.
    cards = await discovery.load({ filters, limit: 20 });
  } catch (error) {
    // Keep the current card available for retry; show a readable message.
    const message = error instanceof Error ? error.message : 'Unable to record activity decision.';
    // P5 displays message; skip_unavailable specifically means team SQL adoption is pending.
    if (error instanceof ApiError && error.code === 'skip_unavailable') {
      // P5 may disable Skip and explain the dependency; do not report Skip success.
    }
  }
}
```

P5 must retain the session across deck reloads, navigation away/back and filter changes within the same browsing session; reset it for a new resident. Remove confirmed IDs from any already cached card queue, or reload using `discovery.load`. Disable alternative buttons/gestures while the current card action is pending. If a load becomes empty because an action completed during the fetch, reload after the action settles before declaring the deck exhausted. Discard responses when the screen/session is no longer current; the helper also rejects resident changes detected before/after async work.

Refresh normally reloads persisted bookmarks/skipped rows, so confirmed decisions stay excluded without browser storage. If P5 considers a web refresh part of the same browsing session even after Skip → Join → Leave, it can store `discovery.excludedActivityIds` in `sessionStorage` under a **resident-specific** key and pass those IDs as `restoredIds`. Clear on logout/session end; never share between residents. Storage is optional UI-owned session state, not Supabase persistence. No `window`/`sessionStorage` dependency is introduced in shared code.

Existing details routes `/activities/[id]` supply full details and independent Save/Unsave and Join/Leave. Skips affect only swipe browsing, not the normal listing or recommendations. No undo/unskip workflow is specified or added. Independently saving a previously skipped activity does not erase its skip; it remains visible in the normal listing/details. Unsave/Leave neither call Skip nor create bookmarks.

All writes rely on database permissions, not client role checks alone. Role/status validation in shared APIs provides early feedback. No arbitrary resident ID, service-role credential, registration status write or RLS bypass is exposed. The session helper also rejects reuse under a different logged-in resident.

## Review and live verification still required

Automated tests use mocks/fixtures only: combined filtering, upcoming/stale exclusions, pagination, own-user scoping, permissions, Like/Save reuse, duplicate confirmation, RPC arguments/missing prerequisite/server errors, session reloads, duplicate/conflicting clicks, retries and stale responses. They verify client contracts, **not execution or enforcement of the proposed SQL**.

Before team adoption, a database owner must compare deployed grants/RLS/functions with the prerequisite, review security-definer ownership/privileges and run isolated database tests. In particular verify:

- Anonymous, organiser, admin, suspended and missing-profile calls cannot Skip; callers cannot choose another resident.
- Skip persists `skipped`, consumes no seat and leaves bookmarks unchanged; repeated Skip is idempotent.
- Skip against an existing joined row fails and leaves registration/bookmark unchanged.
- Concurrent Join/Skip is serialized: if Join wins, Skip fails; if Skip wins, a later valid Join registers through the existing capacity check. No Skip removes a seat, and Join never loses capacity protection.
- Missing, cancelled, completed and started activities reject a new Skip; full upcoming activities may be skipped. Legacy saved rows are not overwritten.
- Direct participant INSERT/table UPDATE/column UPDATE(status) remain denied, and RPC execution is not granted to anon/PUBLIC.
- Reopening/refreshing under the same resident excludes persisted skips; cross-user decisions do not leak. Review the documented single-row Skip → Join → Leave behaviour.

After adoption, P5 must verify real swipe gestures and button alternatives, success/error presentation, async cancellation/stale deck behaviour, refresh/session restoration, empty deck UX and detail navigation. These were not live-tested here. No P5 UI, deployment, live records, test users, SQL executions or migrations were changed/run.

## Validation for this change

- `npm run typecheck`: passed for app and shared package.
- `npm test`: 363 tests passed (106 app, 257 shared), including 52 new swipe API/session tests. Database tests are deliberately excluded by the standard test script; no live database test was run.
- Expo Web export: passed, generated outside the repository; no deployment.
- Changed TypeScript files: passed ESLint using the repository Expo ESLint config, including the shared database contract and test file.
- No database safeguards or P5 UI scenarios are claimed live-tested.

## Migration integration review

The original Skip proposal now has an exact proposed history copy,
`20261010180000_p2_swipe_discovery.sql`. Do not execute both copies. The separate
`20261010190000_p2_integration_hardening.sql` proposal closes direct participant
DELETE/rating mutation grants and fixes post-lock time checks without changing RPC
signatures. Both require P1/team approval. See the [shared/fresh adoption runbook](p2-database-readiness.md);
no additional SQL has been applied by this review.
