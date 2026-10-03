# CommunityLink

SC2006 group project. A community app for Singapore residents to discover local activities, join them, and connect with neighbours.

**Stack:** Expo (React Native) + TypeScript, Supabase (Postgres, Auth, row-level security).

```
apps/mobile/         Expo app
packages/shared/     Shared TypeScript: DB types, API functions, validation, RBAC
supabase/migrations/ Database schema + RLS policies (source of truth for the DB)
scripts/seed.mjs     Test accounts, activities, posts
docs/                API contract and team conventions
```

## Getting started (everyone)

1. Install Node 22+ and clone the repo, then install dependencies:

   ```bash
   npm install
   ```

2. Create `apps/mobile/.env` from `apps/mobile/.env.example`. The URL and publishable key are pinned in the group chat. Both are safe to use in the app.

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

## Using the shared package

Import everything from `@communitylink/shared`. API functions take the Supabase client as their first argument:

```ts
import { getMyProfile, updateMyProfile, can, type Activity } from '@communitylink/shared';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';

const { profile, signOut } = useAuth(); // current user, inside components
if (can(profile, 'activity:create')) {
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
| `npm run db:types`  | Regenerate `database.types.ts` from the linked project     |
| `npm run format`    | Prettier                                                   |

## Team workflow

- Branch from `main`: `feat/<area>-<thing>`, e.g. `feat/discovery-search`.
- Small PRs, merged to `main` every 2–3 days. Don't save everything for Week 10.
- CI must pass, and one teammate must approve.
- Never commit `.env` files, the database password, or the **secret** key.
