# CommunityLink API contract

The "API" is the Supabase database itself. Clients query tables directly with the typed client, and **row-level security (RLS) enforces the rules**. Server logic that must not be bypassed lives in Postgres functions called with `supabase.rpc(...)`.

Types for every table: `packages/shared/src/database.types.ts`, with friendly aliases in `packages/shared/src/types.ts` (`Profile`, `Activity`, `Post`, …).

## Tables and owners

| Table                   | Owner | Notes                                                                              |
| ----------------------- | ----- | ---------------------------------------------------------------------------------- |
| `neighbourhoods`        | P1    | Reference data (23 HDB towns with lat/lng). Readable without logging in.           |
| `profiles`              | P1    | One per user, created automatically on sign-up. `role`, `status` are admin-only.   |
| `activities`            | P2    | `source` = `organiser` or `dataset`. Organisers cancel via `status`, never delete. |
| `activity_participants` | P2    | One row per user per activity: `joined` / `saved` / `skipped` (swipe left).        |
| `activity_ratings`      | P2    | Only allowed after joining an activity whose `ends_at` has passed.                 |
| `posts`, `comments`     | P3    | `neighbourhood_id` = which community feed. `is_removed` is admin-only.             |
| `post_likes`            | P3    |                                                                                    |
| `connections`           | P3    | `requester_id` → `addressee_id`, `pending` → `accepted`. One per pair.             |
| `messages`              | P3    | DMs. Only between accepted connections that haven't blocked each other.            |
| `blocks`                | P3    | Hides posts/comments both ways and stops DMs and requests.                         |
| `reports`               | P3    | `target_type` + `target_id`. Admins review.                                        |
| `audit_log`             | P1    | Admin actions. Written only by `write_audit_log()` inside other functions.         |
| `notifications`         | P4    | Clients can read and mark read. Inserted only by functions (P4's `notify()`).      |

## Who can do what (enforced by RLS)

| Action                               | Resident | Organiser | Admin |
| ------------------------------------ | :------: | :-------: | :---: |
| Read profiles, activities, posts     |    ✅    |    ✅     |  ✅   |
| Edit own profile (not role/status)   |    ✅    |    ✅     |  ✅   |
| Join / save / skip / rate activities |    ✅    |    ✅     |  ✅   |
| Create activities                    |          |    ✅     |  ✅   |
| Update/cancel an activity            |          | own only  |  any  |
| Delete an activity                   |          |           |  ✅   |
| Post, comment, like, connect, DM     |    ✅    |    ✅     |  ✅   |
| See removed posts                    | own only | own only  |  ✅   |
| Review reports, read audit log       |          |           |  ✅   |
| Change roles, suspend users          |          |           |  ✅   |

**Suspended** users can still read, but every insert fails and the app signs them out.

The same table exists in TypeScript as `can(profile, permission)` in `packages/shared/src/rbac.ts`, for hiding UI. Keep the two in sync.

## Auth (P1) — `packages/shared/src/api/auth.ts`

| Function                                           | Notes                                                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `signUp(client, { email, password, displayName })` | Validates input (password: 8+ chars, a letter and a number). Profile row created by trigger. |
| `signIn(client, { email, password })`              | Friendly error messages (`ApiError.message`).                                                |
| `signOut(client)`                                  |                                                                                              |
| `requireUserId(client)`                            | Current user's id, or throws `ApiError('unauthenticated')`.                                  |

In the app, use `useAuth()` from `apps/mobile/src/auth/AuthProvider.tsx`: `{ session, profile, loading, signIn, signUp, signOut, refreshProfile, signedOutReason }`.

**Session timeout (FR 1.2):** `<InactivityGuard>` signs the user out after 30 minutes without a touch, including time spent in the background.

## Profile (P1) — `packages/shared/src/api/profile.ts`

- `getMyProfile(client)`, `getProfile(client, userId)`
- `updateMyProfile(client, patch)`: only the columns in `ProfileUpdate`
- `completeOnboarding(client, { neighbourhoodId, interests, accessibilityNeeds, preferredLanguage })` sets `onboarded = true`
- `listNeighbourhoods(client)`

Allowed values for interests, accessibility needs and languages: `INTERESTS`, `ACCESSIBILITY_NEEDS`, `LANGUAGES` in `constants.ts`.

## Admin (P1) — `packages/shared/src/api/admin.ts`

| Function                                         | RPC               | Audited |
| ------------------------------------------------ | ----------------- | :-----: |
| `setUserRole(client, userId, role)`              | `set_user_role`   |   ✅    |
| `setUserStatus(client, userId, status, reason?)` | `set_user_status` |   ✅    |
| `listAuditLog(client, { limit, before })`        | (table read)      |         |

## SQL helpers you can use in your own policies and functions

| Function                                                          | Returns                                               |
| ----------------------------------------------------------------- | ----------------------------------------------------- |
| `public.is_admin()`                                               | current user is an active admin                       |
| `public.is_organiser()`                                           | active organiser **or** admin                         |
| `public.is_active_user()`                                         | current user is not suspended                         |
| `public.current_user_role()`                                      | `user_role`                                           |
| `public.is_blocked_between(a, b)`                                 | either user blocked the other                         |
| `public.are_connected(a, b)`                                      | accepted connection exists                            |
| `public.write_audit_log(action, target_type, target_id, details)` | only callable from other `security definer` functions |

## Protected columns and the function pattern

Clients can only `UPDATE` the columns granted in `*_rls_policies.sql`. To change a protected column (for example `posts.is_removed` for moderation), write a `security definer` function that checks `is_admin()`, makes the change, and calls `write_audit_log`. `set_user_status` in `*_auth_rbac.sql` is the template to copy.

## Open items for each owner

- **P2:** enforce `capacity` when joining (trigger or RPC). Add the recommendation query/RPC. Add dataset import with `source = 'dataset'` and `external_id`.
- **P3:** `admin_remove_content(target_type, target_id, reason)` function, following the pattern above. When blocking, delete any connection between the two users (trigger on `blocks`). Report → admin queue screens.
- **P4:** `notify(user_id, type, payload)` as a `security definer` function, called from triggers (activity changed/cancelled, connection request, new DM) so clients can't spam notifications.
- **P1:** real Singpass (Week 10) sets `profiles.singpass_verified`.

## Errors

API functions throw `ApiError` with a readable `message` and an optional `code`:

- `'42501'`: permission denied (RLS or a role check)
- `'23505'`: duplicate
- `'validation'`: client-side validation failed
- `'unauthenticated'`: not logged in
