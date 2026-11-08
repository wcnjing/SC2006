# CommunityLink

SC2006 group project. A community app for Singapore residents to discover local activities, join them, and connect with neighbours.

**Stack:** Expo (React Native) + TypeScript, Supabase (Postgres, Auth, row-level security).

```
apps/mobile/         The CommunityLink app (all screens; see its README)
packages/shared/     Shared TypeScript: DB types, API functions, validation, RBAC
services/mockpass/   Local Mockpass server
services/mockpass-auth/ CommunityLink Mockpass authentication bridge
supabase/migrations/ Database schema + RLS policies (source of truth for the DB)
scripts/seed.mjs     Test accounts, activities, posts
docs/                API contract and team conventions
```

## Getting started (everyone)

1. Install Node 22+ and clone the repo, then install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` in the repository root from `apps/mobile/.env.example`. The URL and publishable key are pinned in the group chat. Both are safe to use in the app.

3. Start the app and open it in Expo Go (scan the QR code) or a simulator:

   ```bash
   npm run mobile
   ```

4. Log in with a test account (password in the group chat):

   | Role      | Email                                                           |
   | --------- | --------------------------------------------------------------- |
   | admin     | `admin@test.com`                                                |
   | organiser | `organiser@test.com`, `organiser2@test.com`                     |
   | resident  | `resident@test.com`, `resident2@test.com`, `resident3@test.com` |

## Try posts in the browser without Supabase

From the repository root:

```bash
npm run web:demo
```

This starts the app in the browser on its built-in mock backend, so no Supabase
project or `.env` is needed. Log in with `mrstan@test.com`, `resident@test.com`,
`organiser@test.com`, `admin@test.com` or `suspended@test.com` (password
`Password1`; see `apps/mobile/README.md`). Real database/RLS behaviour still
needs Supabase: normal `npm run mobile` / `npm run web --workspace apps/mobile`
use Supabase whenever the `.env` keys are set.
See [P3 posts and feed](docs/p3-posts-feed.md) for details.
See [P3 reports](docs/p3-reports.md) for reporting APIs, screens and database protections.
See [P3 admin moderation](docs/p3-moderation.md) for the review and audit workflow.
See [P3 connections](docs/p3-connections.md) for friend requests and database rules.
See [P3 DMs and blocking](docs/p3-messaging-blocking.md) for private messages and block controls.

## Using the shared package

Import everything from `@communitylink/shared`. API functions take the Supabase client as their first argument:

```ts
import { getMyProfile, updateMyProfile, can, type Activity } from '@communitylink/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const { session, hasRole } = useAuth(); // current user, inside components
if (hasRole('organiser')) {
  /* show the button */
}

const { data, error } = await supabase.from('activities').select('*'); // fully typed
```

See [docs/api.md](docs/api.md) for the tables, what each role can do, and the RPC functions.

## Database changes

The shared Supabase project is managed by **P1**. To change the schema:

1. Create a new migration file:

   ```bash
   supabase migration new add_something
   ```

2. Write the SQL. **Never edit a migration that is already on `main`.** Add a new one instead.
3. Enable RLS and add policies for any new table. CI fails if the migration doesn't apply.
4. Open a PR. After it merges, P1 runs `supabase db push` and `npm run db:types`, then commits the updated types.

Optional local sandbox (needs Docker): `supabase start`, then `supabase db reset` reapplies all migrations and `npm run test:db` runs the RLS tests.

## Scripts

| Command             | What it does                                               |
| ------------------- | ---------------------------------------------------------- |
| `npm run mobile`    | Start the Expo dev server                                  |
| `npm run typecheck` | TypeScript across all packages                             |
| `npm test`          | Unit tests                                                 |
| `npm run test:db`   | Auth/RBAC/RLS integration tests (local Supabase only)      |
| `npm run seed`      | Seed test data into the project in `.env` (safe to re-run) |
| `npm run mockpass`  | Start the local Mockpass authentication bridge             |
| `npm run db:types`  | Regenerate `database.types.ts` from the linked project     |
| `npm run format`    | Prettier                                                   |

## Team workflow

- Branch from `main`: `feat/<area>-<thing>`, e.g. `feat/discovery-search`.
- Small PRs, merged to `main` every 2–3 days. Don't save everything for Week 10.
- CI must pass, and one teammate must approve.
- Never commit `.env` files, the database password, or the **secret** key.

## Mockpass login (local development)

Mockpass runs separately from the Expo app. Start it with the login page and
direct ID tokens enabled:

```powershell
cd services/mockpass
$env:SHOW_LOGIN_PAGE = "true"
$env:SINGPASS_CLIENT_PROFILE = "direct"
npm start
```

In another terminal, start the CommunityLink bridge:

```powershell
npm run mockpass
```

The bridge reads `SUPABASE_URL` and `SUPABASE_SECRET_KEY` from the root `.env`.
Set `MOCKPASS_AUTH_URL` there and
`EXPO_PUBLIC_MOCKPASS_AUTH_URL` in the same `.env` to the computer's
LAN IPv4 address when testing with Expo Go on a phone. The phone and computer
must be on the same network.

The mobile login screen then provides **Log in with Mockpass**. The bridge
handles the Mockpass token exchange and creates or reuses a local Supabase
account whose profile is marked as Singpass-verified. Never expose the
Supabase secret key or Mockpass signing keys to the mobile app.
