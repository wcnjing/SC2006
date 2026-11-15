# CommunityLink

CommunityLink is a mobile app for people in Singapore who want to find things to do nearby and get to know their neighbours. You can browse local activities and sign up for them, post in your neighbourhood's feed, add friends and message them.

Built using Expo (React Native) and Supabase. It runs on Android, iOS and in the browser.

Repo: https://github.com/wcnjing/SC2006

## What's in the app

CommunityLink currently contains these features: 

- **Accounts (P1):** sign-up and login, profiles, the three user roles (resident, organiser, admin), account suspension and an audit log of admin actions. P1 also set up the database schema, the row-level security rules and CI.
- **Activities (P2):** browsing, searching and filtering activities, a swipe deck for discovering new ones, personalised recommendations, saving and joining, and rating an activity after attending. Organisers can create, edit and cancel their own activities.
- **Community (P3):** a feed for each neighbourhood with posts, comments and likes, friend requests, direct messages, blocking, reporting, and the admin moderation tools.
- **Singpass, maps and notifications (P4):** Singpass login through a local Mockpass server, organiser verification, OneMap planning areas, the map tab and in-app notifications.
- **Design (P5):** the design system and UI kit, screen layouts, accessibility, and a button for every swipe gesture so nobody has to swipe.

The app also has English, Chinese, Malay and Tamil translations.

## Running the application

### **Node 22 or newer** is required. 

Run every command from the repo root.

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Make a `.env` file in the repo root and fill in the variables listed under [Environment variables](#environment-variables).

3. Open three terminals and run one command in each:

   ```bash
   npm run mockpass:server   # Mockpass (fake Singpass) on port 5156
   npm run mockpass          # our login bridge on port 3000
   npm run mobile            # Expo; scan the QR code with Expo Go
   ```

   If you'd rather use the browser, run `npm run web` instead of `npm run mobile`.

4. Log in. You can register your own account, tap **Log in with Singpass**, or use one of our test accounts:

   - admin: `admin@test.com`
   - organiser: `organiser@test.com`, `organiser2@test.com`
   - resident: `resident@test.com`, `resident2@test.com`, `resident3@test.com`

To use Expo Go on a phone, connect the phone to the same Wi-Fi as your computer. Then, in `.env`, change `localhost` in the Mockpass URLs to your computer's local IP address.

### Environment variables

| Variable                                                   | What it's for                                                                                   |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`                                 | Our Supabase project URL                                                                        |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                     | Supabase publishable key (fine to have in the app)                                              |
| `EXPO_PUBLIC_MOCKPASS_AUTH_URL`                            | Where the app can reach the login bridge                                                        |
| `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY`                      | Google Maps in the browser                                                                      |
| `GOOGLE_MAPS_API_KEY`                                      | Google Maps on native builds (not needed for Expo Go)                                           |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY`                      | Used by the login bridge. Message @Puniabor for the secret key                                  |
| `MOCKPASS_URL`, `MOCKPASS_AUTH_URL`, `MOBILE_REDIRECT_URI` | Bridge settings, see [services/mockpass-auth/.env.example](services/mockpass-auth/.env.example) |

## How it works

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

The screens in `apps/mobile/src/app` are the boundary classes. They don't talk to Supabase directly. Instead, they call a service interface (`src/services/types.ts`). That interface has two implementations, one for Supabase and an in-memory mock we used while building the screens. The shared types, validation and role checks live in `packages/shared`, so the app and the tests use the same code.

We don't have a separate backend server. The app queries the database itself, and Postgres row-level security decides what each user can read or change. A resident can't edit someone else's post, for example, even if they call the API by hand. Some rules have to be checked atomically, such as joining an activity that's almost full, suspending a user, or removing a reported post. Those run as Postgres functions that the app calls through `supabase.rpc(...)`.

The app only ever has the publishable key. The secret key is used by the Mockpass login bridge, which needs it to create accounts for Singpass users, and by our seed script.

### Roles

- **Residents** can find, save, join, skip and rate activities, post and comment, add friends, send messages, block people and report things.
- **Organisers** can do all of that, and also create, edit and cancel their own activities and message the residents who signed up.
- **Admins** review reports, remove posts, suspend users and verify organisers. Every admin action is recorded in the audit log.

### Database

The main tables are `profiles`, `neighbourhoods`, `activities`, `activity_participants`, `activity_ratings`, `posts`, `comments`, `post_likes`, `connections`, `messages`, `blocks`, `reports`, `notifications` and `audit_log`. The whole schema is built up by the 37 migrations in [supabase/migrations/](supabase/migrations/). [docs/api.md](docs/api.md) explains what each table is for and who can access it.

### Outside services

- **Singpass**, through Mockpass, for login and verified profiles.
- **Google Maps** for the map tab and for turning addresses into coordinates.
- **OneMap** for Singapore's planning areas. A Supabase Edge Function syncs them once a month, and a GitHub Action refreshes the OneMap token every two days because it expires.

## Testing

```bash
npm run typecheck     # TypeScript, all packages
npm test              # unit tests for the shared package
npm run test:admin    # app tests for admin and suspension
npm run test:db       # row-level security tests (needs a local Supabase: npx supabase start)
npm run format:check  # Prettier
```

When we last ran them on 15 Nov 2026, all 386 unit tests passed. Here's roughly how they're spread across the app:

| Area                                                                                    | Test files | Tests |
| --------------------------------------------------------------------------------------- | ---------- | ----- |
| Accounts (session, roles, validation)                                                   | 3          | 11    |
| Activities (listing, filters, discovery, recommendations, joining, management, ratings) | 8          | 275   |
| P2 migration checks                                                                     | 1          | 25    |
| Community (posts, likes and comments, friends, messages)                                | 4          | 44    |
| Reports and moderation                                                                  | 2          | 25    |
| App (admin screens, suspended-account check)                                            | 2          | 6     |
| Row-level security against a real database                                              | 1          | 51    |

GitHub Actions runs everything on every pull request and every push to `main`. It also builds the database from scratch using every migration, so if a migration is broken, CI catches it before it gets anywhere near the shared project.

## Other docs

- [docs/api.md](docs/api.md): tables, what each role can do, and the RPC functions
- [apps/mobile/README.md](apps/mobile/README.md): more detail on the app's screens and its mock data
- [docs/start.md](docs/start.md) and [docs/supabaseCLI.md](docs/supabaseCLI.md): running Supabase locally
- Activities: [filters](docs/p2-activity-filters.md), [swipe discovery](docs/p2-swipe-discovery.md), [recommendations](docs/p2-recommendations.md), [management](docs/p2-activity-management.md), [ratings](docs/p2-activity-ratings.md), [my activities](docs/p2-resident-my-activities.md)
- Community: [posts and feed](docs/p3-posts-feed.md), [connections](docs/p3-connections.md), [messages and blocking](docs/p3-messaging-blocking.md), [reports](docs/p3-reports.md), [moderation](docs/p3-moderation.md)
- Safety: [account reporting](docs/account-reporting.md), [user suspension](docs/user-suspension.md), [organiser verification](docs/organiser-verification.md)
- P2 review notes: [completion audit](docs/p2-completion-audit.md), [database readiness](docs/p2-database-readiness.md), [UI refresh](docs/p2-ui-refresh.md)
- [Google Maps setup](docs/google-maps-integration.md)

<!-- TODO: link use-case model, class/sequence diagrams and lab reports when added -->

## How we worked

- Everyone branched off `main` with a name like `feat/discovery-search`, kept pull requests small, and noted which functional requirement each PR covered (for example FR 3.2).
- A PR could only be merged once CI passed and another team member approved it.
- Database changes always went into a new migration with its RLS policies. We never edited a migration that was already on `main`. After a merge, P1 pushed the change to the hosted project and regenerated the types.
- Nobody commits `.env` files or keys.

## Folder layout

```
apps/mobile/              the Expo app
packages/shared/          shared types, API functions, validation, role checks, and their tests
services/mockpass-auth/   starts Mockpass and runs our Singpass login bridge
supabase/migrations/      database schema and RLS policies
supabase/functions/       Edge Function that syncs OneMap planning areas
scripts/seed.mjs          creates the test accounts and sample data
docs/                     extra documentation
```

## Team

| Member             | Part | What they did                                                            |
| ------------------ | ---- | ------------------------------------------------------------------------ |
| Ng Wen Jing        | P1   | Accounts, auth, profiles, database schema and RLS, CI                    |
| Shyanne Tan Yan Ru | P2   | Activities, discovery, recommendations, ratings, organiser tools         |
| Yuan Yining        | P3   | Community feed, friends, messaging, reports, moderation                  |
| Xavier Kee         | P4   | Singpass/Mockpass login, OneMap integration, notifications               |
| Summer Sinfuego    | P5   | Design system, UI/UX, accessibility, button alternatives to gestures, QA |
