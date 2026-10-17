# P3: connections (friend requests)

Residents can send requests, list incoming/outgoing requests, accept/reject an
incoming request and cancel an outgoing request. Accepting makes both residents
friends. P1's existing `connections` table, auth session and pair-uniqueness index
are reused. The screen is separate from the APIs for P5 to restyle.

## Try it without Supabase

1. Run `npm run web:demo` and choose **Yining**.
2. Open **Connections** from the home screen or community feed. In **Find
   people**, choose **Send request** under Auntie Mei.
3. Open **Sent requests**. You can cancel a pending request with confirmation.
4. Use **Switch demo resident**, choose **Auntie Mei**, then open **Connections**
   and **Incoming requests**. Accept the request, or reject it with confirmation.
5. After acceptance, each resident sees the other under **Friends**. Refresh or
   revisit the screen to see changes made by another resident.

The directory supports literal, case-insensitive name searches (maximum 50
characters) and pagination. It excludes the current user, suspended users and
blocked pairs. Lists show public profile fields only; another resident, including
Demo Admin, cannot view someone else's relationship lists. The directory includes
only the caller's relationship with each result, fetched in the same query.

Demo data persists across reloads. Existing posts, reports and moderation audit
entries survive the storage upgrade. **Reset demo data** also clears connections.
The local demo exercises the screens; it does not prove real database security.

## Shared API and state transitions

Every shared function takes the typed Supabase client first.

| Function                                                              | Behaviour                                                                                                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sendConnectionRequest(client, targetUserId)`                         | Sends a pending request. Returns an existing pending/accepted relationship for repeated or crossed sends; never auto-accepts an incoming request.             |
| `listConnections(client, { view?, limit?, cursor?, signal? }?)`       | `{ connections, nextCursor }`; view is `incoming`, `outgoing`, `friends` or `all`. Default limit 20, maximum 50. Includes public profiles for both endpoints. |
| `findConnectionPeople(client, { query?, limit?, cursor?, signal? }?)` | `{ people, nextCursor }`; each result has `{ profile, connection }`, with a nullable relationship belonging to the caller.                                    |
| `connectionRequestRef(connection)`                                    | Returns `{ requesterId, addresseeId, createdAt }` for an action on that exact request.                                                                        |
| `acceptConnectionRequest(client, ref)`                                | Recipient only; returns the accepted connection and server response time.                                                                                     |
| `rejectConnectionRequest(client, ref)`                                | Recipient only; deletes a pending request.                                                                                                                    |
| `cancelConnectionRequest(client, ref)`                                | Sender only; deletes a pending request.                                                                                                                       |

Requests use the existing `pending` and `accepted` states. Reject/cancel remove
the pending row, so another request may be sent later. There is no rejected or
cancelled history row. Accepted friendships cannot be deleted by these actions;
unfriend, messaging, blocking screens and notifications are separate work.

The action reference includes the original server timestamp at full precision.
A stale reject/cancel cannot delete a replacement request; an action against a
different request generation returns `40001`. Repeating an acceptance retains
the original response time. Repeating reject/cancel after deletion succeeds.
The UI locks repeated taps, retains readable action errors, and ignores stale
list/action responses after changing tabs, searches or accounts.

## Database migration

Apply `20261018090000_p3_connections.sql` through P1's migration/PR workflow.
This work does not deploy it to the shared project. RPC signatures are included
in `database.types.ts`; P1 should regenerate types after applying the migration.

- `send_connection_request` derives the sender from auth, checks active users,
  rejects self/missing/blocked targets and generates timestamps on the server.
- `manage_connection_request` verifies the actor, request direction, original
  timestamp and state. Accept requires an active requester and no block.
- Both functions serialize operations on the same unordered user pair, so
  crossed sends and accept/cancel races cannot create duplicate friendships.
- Direct connection inserts, updates and deletes are revoked. RLS reads allow
  only participants in unblocked relationships, including for admins.
- `find_connection_people` runs with the caller's permissions and returns only
  public fields plus their own relationship. Query/limit/cursor arguments are
  validated; `%` and `_` in names/searches are literal characters.
- Block insert triggers use the same pair lock and delete either pending or
  accepted connections. Existing blocked relationships are cleaned up when the
  migration runs. Unblocking does not restore a request or friendship.

The block triggers support the foundation's existing blocks table; no blocking
screen is added here. Suspended actors cannot write requests. Lists can remain
readable as permitted by P1's read policies.

## Verification

- `npm test`: API contracts, actor restrictions, crossed requests, request
  generations, persistence/privacy, filtering/pagination, and late list responses.
- `npm run test:web:demo --workspace apps/mobile`: send → cancel → resend →
  reject → resend → accept, both friend lists, search, reload and outsider privacy.
- `npm run typecheck` and `npm run lint --workspace apps/mobile`.
- `npm run test:db`: local Supabase only. Added integration cases cover real
  RPC/RLS permissions, crossed requests, stale actions, blocking cleanup and
  races, suspended users, and timestamp-tied pagination. Apply all migrations
  and run this suite in a local stack or CI before deploying.

The `/connections` route follows the [Expo Router reference](https://docs.expo.dev/versions/v57.0.0/sdk/router/).
