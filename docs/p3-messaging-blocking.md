# P3: direct messages and blocking

Accepted connections can send/list private text messages. Residents can block or
unblock another user and view their own blocked-users list. P1's existing
messages/blocks tables and auth session are reused. Feature screens remain
separate from the shared APIs for P5 to restyle.

## Try it without Supabase

1. Run `npm run web:demo`. Use **Connections** to send a request from Yining to
   Auntie Mei, switch residents and accept it.
2. Choose **Message** beside a friend, or open **Messages** from the home/feed
   and choose **Open conversation**. Send a message, then switch residents to
   read it and reply. **Refresh messages** retrieves new messages/permissions.
3. Choose **Block user** from a conversation or a Connections card and confirm.
   The connection disappears for both residents and messages/requests become
   unavailable. Normal blocked posts/comments are hidden too.
4. Open **Blocked users** from Connections/Messages, or reopen the conversation,
   to unblock with confirmation. Only the blocker can remove their own block.
5. Unblocking does not restore a request or friendship. Send/accept a new request
   before chatting again. Previous messages remain stored and become readable
   again after reconnection.

Demo messages and blocks persist after reload. Existing demo posts, reports,
audit entries and friendships survive the storage upgrade. **Reset demo data**
clears local messages/blocks too. Demo Admin has no general access to residents'
private chats or block lists. The demo exercises local flows; real RPC/RLS and
database concurrency still require local Supabase/CI tests.

## Shared API and routes

Every function takes the typed Supabase client first.

| Function                                                            | Behaviour                                                                                                                                |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `getDirectConversation(client, userId, { signal? }?)`               | Public peer profile and `connected`, `blockedByMe`, `canSend` flags, or null for a missing peer. Does not reveal who blocked the caller. |
| `sendDirectMessage(client, { recipientId, body, requestId? })`      | Sends trimmed, nonblank text (maximum 2,000 Unicode code points). Sender, times and receipt metadata come from the server.               |
| `listDirectMessages(client, userId, { limit?, cursor?, signal? }?)` | `{ messages, nextCursor }`; newest page displayed chronologically, default 20, maximum 50. Older pages use timestamp/ID cursors.         |
| `blockUser(client, userId)`                                         | Creates the caller's block and removes any connection in one transaction. Repeating it is safe.                                          |
| `unblockUser(client, userId)`                                       | Deletes only the caller's block; repeating it is safe. Does not restore a relationship.                                                  |
| `listBlockedUsers(client, { limit?, cursor?, signal? }?)`           | `{ users, nextCursor }`, scoped to the caller, with public peer fields. Default 20, maximum 50.                                          |

- `/messages`: accepted contacts that can be opened as conversations.
- `/messages/[id]`: chronological thread, composer, block/unblock controls.
- `/blocked-users`: private block history and unblock controls.

The composer retains its request UUID and draft across failed sends. Retrying
the same ID and content returns the existing message without creating a second
row. A retry with different text/recipient conflicts instead of modifying a sent
message; refresh first, then choose **Start a new message** for a new draft.
The thread cancels/ignores stale pages after changing peers or losing access,
and prevents an earlier refresh from overwriting a newly sent message.

Refresh/focus reloads messages and permission state. Live subscriptions, push
notifications, attachments, post sharing, message editing/deletion and read
receipts are outside this increment.

## Database migration

Apply `20261018100000_p3_messages_blocks.sql` through P1's migration/PR workflow.
The shared project has not been changed by this work. RPC signatures are added
to `database.types.ts`; P1 should regenerate types after applying migrations.

- `send_direct_message` derives the sender from auth, validates content and
  active accounts, then requires an accepted, unblocked connection. It uses
  the same pair lock as connection actions and blocking, so a send cannot bypass
  a concurrent block. Retry IDs are bound to the sender, recipient and body.
- Direct message inserts are revoked. Clients cannot forge senders, timestamps,
  read receipts or shared-post metadata through the text-message API.
- Participant message reads require an accepted, unblocked connection. Blocking
  hides retained messages from both participants, and unblocking alone does not
  re-enable reads. The foundation's separate policy for admins reviewing a
  specifically reported message is preserved; normal chat APIs scope reads to
  the current participant pair.
- `set_user_block` derives the blocker from auth and requires an active actor.
  Blocking a suspended peer is allowed. It creates/deletes only the caller's
  block and removes the connection atomically when blocking. Existing connection
  cleanup triggers are retained. Direct block inserts/deletes are revoked.
- Reciprocal blocks remain independent: unblocking someone does not remove a
  block they placed on you. Suspension prevents sending/block management while
  normal read permissions follow P1's account policy.
- The nonblank message constraint is `NOT VALID` to preserve old rows. No message
  history is physically deleted by blocking. Stable thread/block pagination
  indexes are added.

P1's existing post/comment RLS already handles block visibility; the local demo
now mirrors those normal author/admin visibility rules as well.

## Verification

- `npm test`: message/block API contracts, duplicate retries, private history,
  reciprocal blocks, persistence, invalid/suspended writes and stale thread reads.
- `npm run test:web:demo --workspace apps/mobile`: two-way messaging, validation,
  reload, cancel/confirm block, outsider privacy, removal from friend/message
  lists, unblocking and reconnection with retained history; also blocking a
  pending requester from Connections.
- `npm run typecheck` and `npm run lint --workspace apps/mobile`.
- `npm run test:db`: requires local Supabase. Added cases exercise real RPC/RLS
  permissions, duplicate/concurrent sends, a send racing a block, reciprocal
  blocks, protected insert metadata and tied-timestamp pagination. Existing tests
  now use the block/message RPCs where direct writes are no longer allowed.

Routes follow the [Expo Router reference](https://docs.expo.dev/versions/v57.0.0/sdk/router/).
