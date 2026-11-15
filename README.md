# CommunityLink

SC2006 Software Engineering. A cross-platform mobile app (Expo + Supabase) that helps Singapore residents find local activities, join them, and connect with their neighbours.
Repository: https://github.com/wcnjing/SC2006

## Subsystems

`main` holds the integrated app: every subsystem runs behind one UI kit and one shared API package.

| Subsystem                    | Features                                                                                                 | Notes                                                                                                                                                                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1: Accounts and platform    | Email/password auth, profiles, roles (RBAC), suspension, audit log, schema, RLS, CI                      | [API contract](docs/api.md), [user suspension](docs/user-suspension.md)                                                                                                                                                                                                  |
| P2: Activities               | Browse/search/filter, swipe discovery, recommendations, save/join, ratings, organiser create/edit/cancel | [filters](docs/p2-activity-filters.md), [discovery](docs/p2-swipe-discovery.md), [recommendations](docs/p2-recommendations.md), [management](docs/p2-activity-management.md), [ratings](docs/p2-activity-ratings.md), [my activities](docs/p2-resident-my-activities.md) |
| P3: Community and moderation | Neighbourhood feed, posts/comments/likes, friends, DMs, blocking, reports, admin moderation              | [posts](docs/p3-posts-feed.md), [connections](docs/p3-connections.md), [DMs and blocking](docs/p3-messaging-blocking.md), [reports](docs/p3-reports.md), [moderation](docs/p3-moderation.md)                                                                             |
| Singpass (Mockpass)          | Singpass login through local Mockpass, Singpass-verified profiles, organiser verification                | [organiser verification](docs/organiser-verification.md)                                                                                                                                                                                                                 |
| Maps and location            | Map tab, geocoding, OneMap planning areas, weather                                                       | [Google Maps](docs/google-maps-integration.md)                                                                                                                                                                                                                           |

## Build and run

Requires **Node 22 or later**. Run everything from the repository root.

The app runs against our hosted Supabase project, so there is no need for a local database or Docker

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the repository root with the hosted project's values (see [Environment variables](#environment-variables)).

3. Start each of these in its own terminal:

   ```bash
   npm run mockpass:server  # 1. Mockpass Singpass emulator on :5156
   npm run mockpass         # 2. CommunityLink Mockpass bridge on :3000
   npm run mobile           # 3. Expo dev server: scan the QR code with Expo Go, or press w for web
   ```

   To open the app straight in the browser, use `npm run web` instead of `npm run mobile`.

4. Log in with one of the test accounts on the hosted project, or tap **Log in with Singpass** to go through Mockpass.

   | Role      | Email                                                           |
   | --------- | --------------------------------------------------------------- |
   | admin     | `admin@test.com`                                                |
   | organiser | `organiser@test.com`, `organiser2@test.com`                     |
   | resident  | `resident@test.com`, `resident2@test.com`, `resident3@test.com` |

Otherwise, you can register/login normally with your own credentials.

To test on a phone with Expo Go, set the Mockpass bridge URLs to the computer's LAN IP instead of `localhost`. The phone and the computer must be on the same network.

### Environment variables

| Variable                                                   | Used by      | Purpose                                                                        |
| ---------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------ |
| `EXPO_PUBLIC_SUPABASE_URL`                                 | app          | Supabase project URL                                                           |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                     | app          | Publishable key (safe in the client)                                           |
| `EXPO_PUBLIC_MOCKPASS_AUTH_URL`                            | app          | Mockpass bridge URL                                                            |
| `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY`                      | app (web)    | Map tab and geocoding in the browser                                           |
| `GOOGLE_MAPS_API_KEY`                                      | app (native) | Native builds only                                                             |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY`                      | seed, bridge | Server-side access. **Please contact @Puniabor to get the secret key**    |
| `MOCKPASS_URL`, `MOCKPASS_AUTH_URL`, `MOBILE_REDIRECT_URI` | bridge       | See [services/mockpass-auth/.env.example](services/mockpass-auth/.env.example) |

## System design

### Architecture

```
┌──────────────────────────┐      ┌─────────────────────────────┐
│ apps/mobile (Expo)       │      │ services/mockpass-auth      │
│  screens  →  services/   │─────▶│  Express bridge ⇄ Mockpass  │
│            ├ supabase/   │      └──────────────┬──────────────┘
│            └ mock/       │                     │ secret key
└────────────┬─────────────┘                     ▼
             │ @communitylink/shared   ┌─────────────────────────┐
             └────────────────────────▶│ Supabase                │
               (typed API, RBAC,       │  Postgres + RLS, Auth,  │
                validation)            │  Storage, Realtime,     │
                                       │  Edge Functions         │
                                       └─────────────────────────┘
```

- **Boundary/control/entity:** screens in `apps/mobile/src/app` are boundaries. They call a backend-agnostic service interface (`src/services/types.ts`), which has two implementations: Supabase and an in-memory mock. Entity types and business rules live in `packages/shared`.
- **The database is the API.** Clients query tables directly through the typed client, and row-level security enforces who may read or write each row. Rules that must not be bypassed, such as capacity-checked joins, moderation and suspension, run in Postgres functions called with `supabase.rpc(...)`.
- **Secrets stay server-side.** The app holds only the publishable key. Only the Mockpass bridge and the seed script use the Supabase secret key.

### Roles

| Role      | Can                                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| Resident  | Discover, save, join, skip and rate activities; post and comment; add friends; DM; block; report               |
| Organiser | Everything a resident can, plus create, edit and cancel their own activities, and message registered residents |
| Admin     | Review reports, remove content, suspend users, verify organisers; every action is written to the audit log     |

### Data model

The core tables are `profiles`, `neighbourhoods`, `activities`, `activity_participants`, `activity_ratings`, `posts`, `comments`, `post_likes`, `connections`, `messages`, `blocks`, `reports`, `notifications` and `audit_log`. The schema lives in [supabase/migrations/](supabase/migrations/) (37 migrations, applied in order). The generated types are in `packages/shared/src/database.types.ts`, and per-table rules are in [docs/api.md](docs/api.md).

### External services

| Service                 | Use                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------ |
| Singpass (via Mockpass) | Identity login and verified profiles                                                 |
| Google Maps             | Map tab and geocoding                                                                |
| OneMap                  | Planning-area data, synced monthly by an Edge Function; token refreshed every 2 days |

### Internationalisation

The UI is available in English, Chinese, Malay and Tamil (`apps/mobile/src/i18n`).

## Verification

```bash
npm run typecheck     # TypeScript across all workspaces
npm test              # shared package unit tests
npm run test:admin    # app admin/suspension tests
npm run test:db       # RLS integration tests (needs `npx supabase start`)
npm run format:check  # Prettier
```

| Suite                                                                                                       | Files / tests |
| ----------------------------------------------------------------------------------------------------------- | ------------- |
| Accounts: session, RBAC, validation                                                                         | 3 / 11        |
| Activities: listing, filters, discovery, recommendations, participation, my activities, management, ratings | 8 / 275       |
| P2 migration readiness                                                                                      | 1 / 25        |
| Community: posts, interactions, connections, messaging                                                      | 4 / 44        |
| Moderation: reports, moderation                                                                             | 2 / 25        |
| App: admin, account-status check                                                                            | 2 / 6         |
| Database RLS integration (`rls.db.test.ts`)                                                                 | 1 / 51        |

All 386 unit tests passed locally on 2026-11-15. The RLS suite runs in CI against a fresh local Supabase stack. [CI](.github/workflows/ci.yml) runs on every pull request and every push to `main`. It checks formatting, typechecks, runs the unit tests, applies every migration from scratch and then runs the RLS tests, so a broken migration fails before it reaches the shared project.

## Design and documentation evidence

- [API contract: tables, role permissions, RPC functions](docs/api.md)
- [Local start guide](docs/start.md) and [Supabase CLI setup](docs/supabaseCLI.md)
- [App shell README: screens, demo data, feature map](apps/mobile/README.md)
- P2 review records: [completion audit](docs/p2-completion-audit.md), [database readiness](docs/p2-database-readiness.md), [UI refresh](docs/p2-ui-refresh.md), [save/join proposal](docs/proposals/p2-save-join.md)
- Safety features: [account reporting](docs/account-reporting.md), [user suspension](docs/user-suspension.md), [organiser verification](docs/organiser-verification.md)
- <!-- TODO: link use-case model, class/sequence diagrams and lab reports when added -->

## Development workflow

- Branch from `main` as `feat/<area>-<thing>`. Keep PRs small and link the functional requirement (for example FR 3.2) using the [PR template](.github/pull_request_template.md).
- CI must pass, and one teammate must approve.
- Schema changes always go in a **new** migration with RLS policies. Never edit a migration that is already on `main`. After the PR merges, P1 runs `supabase db push` and `npm run db:types`.
- Never commit `.env`, the database password or the Supabase secret key.

## Repository layout

```
apps/mobile/              Expo app: screens, UI kit, Supabase and mock backends
packages/shared/          Shared TypeScript: DB types, API functions, validation, RBAC, tests
services/mockpass-auth/   Mockpass launcher and CommunityLink authentication bridge
supabase/migrations/      Schema and RLS policies (source of truth for the database)
supabase/functions/       Edge Functions (OneMap planning-area sync)
scripts/seed.mjs          Test data seeding
docs/                     API contract, feature notes and setup guides
```

## Team and submission

<!-- TODO: fill in names and roles -->

| Member             | Role                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------ |
| Ng Wen Jing        | P1: accounts, auth, profiles, database schema/RLS, CI                                |
| Shyanne Tan Yan Ru | P2: activities, discovery, recommendations, ratings, organiser tools                 |
| Yuan Yining        | P3: community feed, connections, messaging, reports, moderation                      |
| Xavier Kee         | P4: Singpass/Mockpass integration, OneMap API Integration, Notification Engine       |
| Summer Sinfuego    | P5: Design system, UI/UX screens, accessibility, button alternatives to gestures, QA |
