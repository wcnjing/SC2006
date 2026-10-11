# Resident My Activities API (P2 → P5)

Import from `@communitylink/shared`. Every function takes only the existing typed
Supabase client. The resident ID comes from authentication; callers cannot request
another resident's collection. An active resident account is required. Existing
RLS remains enforced. No database or UI changes are required.

| Function                            | Return value                                                              |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `listMyActivityCollections(client)` | `Promise<MyActivityCollections>` with `saved`, `joined`, `history` arrays |
| `listMySavedActivities(client)`     | `Promise<MyActivityCard[]>` for Saved                                     |
| `listMyJoinedActivities(client)`    | `Promise<MyActivityCard[]>` for Joined                                    |
| `listMyActivityHistory(client)`     | `Promise<MyActivityCard[]>` for History                                   |

A `MyActivityCard` is `{ activity: Activity, saved: boolean, joined: boolean }`.
The full existing activity record provides card details and its details-route ID.
No profile/private account data is fetched. `joined` means a retained registration,
not attendance or successful completion. An activity can be in Saved and Joined.

- **Saved:** all own bookmarks, including past, completed and cancelled activities.
- **Joined:** own `joined` registrations with scheduled status and `starts_at > now`.
  Cancelled/completed activities are excluded. No end-time or capacity exclusion
  is applied to an existing registration.
- **History:** retained own `joined` registrations with `starts_at <= now`, including
  ongoing, completed and past cancelled activities. Show their actual status.
  Future cancelled registrations are not upcoming Joined or past History, but
  remain in Saved if bookmarked. Do not imply that their registration was deleted.
- Saved/Joined sort by start ascending, then ID; History by start descending,
  then ID. The exact start belongs to History, not Joined. A single call captures
  one client-clock boundary. These are read snapshots, not atomic cross-table
  transactions; refetch after Save/Unsave/Join/Leave or when refreshing/focusing.

```ts
const collections = await listMyActivityCollections(supabase);
// Connect collections.saved / .joined / .history to Summer's three tabs.
// Open details with card.activity.id; reuse existing Save/Join APIs for actions.
```

Prefer the combined API when loading all three tabs: individual helpers each
load both own relationship collections to provide accurate saved/joined flags.
Queries use activity foreign-key joins and paginate to exhaustion, including
server caps below 500 rows. Inaccessible/deleted activity relations are omitted.
Empty arrays are successful empty results. Authentication, permission and server
errors reject the promise: P5 should show loading, an error and retry separately
from empty states. Do not substitute an empty array on an error.

## Ratings and existing history limitation

For a History card, use `getMyActivityRatingEligibility(client, card.activity.id)`
and `activityRatingUnavailableReason(eligibility, Date.now())` before offering
rating submission. This reuses the joined/non-cancelled/strict `ends_at < now`
rule and checks an existing rating. History membership alone does not mean the
activity has concluded or can still be rated. Existing `listMyConcludedActivities`
remains unchanged for the review screen's concluded, non-cancelled collection.

Leave deletes the current joined participant row. This schema cannot reconstruct
lifelong attendance or registrations removed by Leave, nor cancelled/left history
with no retained joined record. These APIs deliberately do not invent that data.
If the team wants such an audit history, P1/team must approve a separate persistence
design; it is outside this change. No proposed migration is added.

## Verification

Automated fixtures cover independent saved/joined states, all date boundaries,
cancelled/concluded entries, eligibility reuse, access control, pagination and
errors. Still verify deployed RLS and foreign-key joins with an authorised active
resident and existing bookmarked/joined upcoming and past records, plus another
resident's isolation. No live database reads/writes or seeds were used here.
P5 owns the three-tab UI and its loading/error/empty-state integration.
