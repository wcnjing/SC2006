# P3: posts and neighbourhood feed

This increment implements the Latest feed, post create/read/edit/delete,
comments and likes with P1's existing tables and authentication. P2 activities
and P4 notifications are not required to try it.

## Try it

### Local demo (no Supabase)

Run `npm run web:demo` from the repository root. Choose **Yining** or **Auntie
Mei**, open the community feed and try create/edit/delete. Open a post to
like/unlike it, add a comment, and edit/delete your own comments. Switch residents
to check separate likes and author controls. The same feature screens run against
a local service selected by `EXPO_PUBLIC_DEMO_MODE=true`.
Posts, comments, likes and the selected resident persist in this browser. Existing
demo posts are retained when comment/like storage is first added. Choose **Bedok** for an
empty feed; **Bishan** has enough samples to try pagination. Use **Switch demo
resident** to test author controls and **Reset demo data** to restore fixtures.

The launcher sets demo mode only for that process, so it does not change your
`.env` or normal backend configuration. Demo data uses its own storage key;
real Supabase requests and token refresh are disabled in this mode. Demo login
uses fixed fixture residents; it never asks for actual account credentials.

This proves the screens and local flows work. It does not validate the real
database, RLS policies or Supabase authentication. Use the real backend and
`npm run test:db` for those checks.

### Supabase

1. Run `npm ci` and configure `apps/mobile/.env` following the root README.
2. Run `npm run mobile`, or `npm run web --workspace apps/mobile` for a browser.
3. Log in, select **Open community feed**, choose a neighbourhood and create a
   post. Optionally attach one existing HTTPS image URL.
4. Open your post to edit or permanently delete it (requires confirmation).
   Like it and add a comment. Edit your comment or delete it with confirmation.
5. Log in as another resident: another author's posts/comments have no edit/delete
   controls. Each resident can like a post once; unlike removes only their own
   like. Switch neighbourhoods to see separate feeds.

Basic functionality uses the existing deployed schema. Additional database
protections require `20261017100000_p3_posts.sql` and
`20261017110000_p3_comments_likes.sql`. Apply migrations to a local Supabase stack,
or follow the P1 migration/PR workflow for the shared project.
This work does not deploy changes to the shared database.

## Shared API

Import from `@communitylink/shared`; every function takes the typed client first.

| Function                                                           | Behaviour                                                                  |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `listPosts(client, { neighbourhoodId, limit?, cursor?, signal? })` | `{ posts, nextCursor }`; default 20, maximum 50.                           |
| `getPost(client, id, { signal? })`                                 | Post with public author fields, or null if unavailable.                    |
| `createPost(client, { body, neighbourhoodId, imageUrl? })`         | Derives author from the current session.                                   |
| `updatePost(client, id, { body?, neighbourhoodId?, imageUrl? })`   | Only an own visible post; rejects empty patches.                           |
| `deletePost(client, id)`                                           | Permanently deletes an own visible post, cascading comments/likes.         |
| `listComments(client, postId, { limit?, cursor?, signal? }?)`      | `{ comments, nextCursor }`; latest 20, maximum 50, displayed oldest first. |
| `createComment(client, { postId, body, requestId? })`              | Derives author from the current session; optional UUID for safe retries.   |
| `updateComment(client, id, body)`                                  | Updates only an own visible comment's body.                                |
| `deleteComment(client, id)`                                        | Permanently deletes only an own visible comment.                           |
| `getPostLikeState(client, postId, { signal? }?)`                   | `{ likeCount, likedByMe }` for an available post.                          |
| `setPostLiked(client, postId, liked)`                              | Sets a desired boolean state and returns the refreshed count/state.        |

Bodies are trimmed, nonempty and limited to 2,000 Unicode code points. Images
use the existing single `image_url` field. Author fields are limited to `id`,
`display_name` and `avatar_url`. Normal feed/detail queries exclude removed
posts, even for their author or an admin. Moderation can use a separate query.

The feed orders by `(created_at DESC, id DESC)`. Pass `nextCursor` unchanged to
get older posts, preserving timestamp precision. Refresh retrieves new posts;
returning to the screen refreshes automatically. Stale requests are cancelled
and ignored. Failed requests retain the draft or already loaded posts.
The editor passes an optional `requestId` UUID to `createPost`, retaining it for
the draft's lifetime. Retrying after a lost response returns the existing post,
or updates that same post if the draft was edited meanwhile.

Comments are trimmed, nonempty and limited to 1,000 Unicode code points. The
comment composer retains its request UUID across failed sends, so a retry cannot
create a duplicate. Comments use the same timestamp/ID cursor as posts: the
latest page is shown chronologically and **Load older comments** prepends older
pages. Refresh and screen focus reload the latest page. Public author fields
match posts; removed comments and comments under unavailable posts are excluded.

Likes use the existing `(post_id, user_id)` primary key. Duplicate likes are
ignored; unlike deletes only the current user's row. The API reads the server
state after writing, and the UI disables repeated taps while a request is
pending. Counts refresh when the post screen is revisited; live subscriptions
and comment/like notifications are not part of this increment.

## Database changes

The post migration prevents blank bodies and client-supplied moderation metadata
or publication timestamps. It prevents suspended authors from editing/deleting,
and preserves removed posts from author edits/deletion.

The comment/like migration adds a nonblank comment constraint and an index for
comment pagination. It restricts comment inserts to identity, parent, author and
body fields, and like inserts to the post/user pair. Comment updates/deletes
require an active author and a visible, nonremoved parent. Like reads/inserts
require a visible, nonremoved parent; unlike requires the active current user.
Existing RLS enforces authorship and block visibility. Nonblank constraints use
`NOT VALID`, preserving legacy rows while checking new writes. No generated type
changes are needed. Apply the migrations before relying on these protections.

## Branch integration

- **P1 / Xavier:** reuse `AuthProvider`, `useAuth`, the Supabase client and shared
  types. The small inactivity-guard change initializes its timestamp in the
  existing effect and names its recursive callback to satisfy the new linter.
- **P2 / Shyanne:** Router entry/layout conventions match her branch. When merging,
  retain both activity and post routes, and both home-screen entry links.
- **P5 / Summer:** `src/theme/tokens.ts` is copied from her branch. URLs match her
  placeholders: `/community`, `/post/create`, `/post/[id]`, `/post/[id]/edit`.
  Feature components live outside `src/app`, so her routes can re-export them
  after integration. Centralized English copy and temporary controls in
  `communityUi.tsx` can be replaced by her UI kit/`useT()`. The feature uses real
  shared auth, not her separate mock backend.

Remaining FR 7 work: categories, announcement permissions/filtering, device image
upload and multiple images need agreed schema/storage additions.
[Post/comment reports and personal history](p3-reports.md) are implemented in
the next increment. [Admin moderation and audit](p3-moderation.md) are also
implemented. [Connections and friend requests](p3-connections.md) are implemented
as well. Messaging and blocking screens remain separate P3 work.

## Verification

- `npm run typecheck`
- `npm test`: shared HTTP-contract tests and mobile request/editor/demo tests.
- `npm run lint --workspace apps/mobile`
- `npm run format:check`
- `npm run test:db`: requires a running local Supabase stack. Added cases cover
  actual ownership, pagination, block visibility, protected metadata, removed
  posts, suspended authors, comment cascades and idempotent likes. These checks
  refuse nonlocal database URLs.

- `npm run test:web:demo --workspace apps/mobile`: launches Chrome and checks
  actual UI create/reload/edit/delete, ownership controls, pagination and empty
  feeds, comment validation/edit/delete, separate resident likes and persistence
  after reload. It starts a demo server if port 8081 is free, or reuses a running demo
  server. Stop a normal Supabase-mode server on that port first. Chrome is used
  by default; set `PLAYWRIGHT_CHANNEL=msedge` to use Edge. Test screenshots and
  traces are saved under the ignored `apps/mobile/test-results/` directory.

Router setup follows the [Expo installation guide](https://docs.expo.dev/router/installation/).
