# CommunityLink: app shell

React Native + Expo (SDK 57) + TypeScript, running on web, iOS and Android from one codebase.
Navigation uses Expo Router (file-based, `src/app/`). Backend: Supabase (wired up by P1; until then a mock backend runs on the device).

## Run it

```bash
npm install
npm run web        # opens in the browser (fastest for day-to-day work)
npm start          # QR code for Expo Go on a phone
npm run typecheck  # tsc --noEmit
npm run lint       # expo lint
```

### Demo accounts (mock backend)

Password for every account: `Password1`

| Phone    | Roles               | Use it to test                                                                                                          |
| -------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 91234567 | consumer            | normal user ("Mrs Tan"), Singpass-linked. Has joined, saved, past and rated activities, so every Week 9 screen has data |
| 92345678 | consumer, organiser | Organiser dashboard entry in Profile                                                                                    |
| 93456789 | consumer, admin     | Admin dashboard entry in Profile. No interests, so Home shows the "not personalised" fallback                           |
| 94567890 | suspended           | the "account suspended" error                                                                                           |

Mock Singpass: on Login, tap **Log in with singpass**. "Tan Mei Ling" logs in as the existing demo user. "Lim Wei Jie" is a new user, who goes to Complete Your Profile with the name prefilled.
To reset the mock data, clear site data in the browser (or reinstall the app).

Mock activities are generated around Tampines relative to **today**, so "upcoming" and "past" are always correct when you demo. Handy ones to open directly:

| URL                                              | Shows                                                                      |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| `/activity/a0000000-0000-4000-8000-000000000001` | Community Gardening (mockup 4.B), 26 reviews, Mrs Tan is going             |
| `/activity/a0000000-0000-4000-8000-000000000006` | Kopi & Chat: **full**, Join greyed out (UC JoinActivity exception)         |
| `/activity/a0000000-0000-4000-8000-000000000013` | Tai Chi: **cancelled** → "no longer available" (UC ViewActivity exception) |
| `/my-activities?tab=past`                        | Past tab: one unrated (Rate button), one already rated (stars)             |

## What's built (P5, Week 9)

| Deliverable (Plan.pdf)             | Where                                                                               | Covers                                                                                                                                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                               | `src/app/(app)/(tabs)/index.tsx`                                                    | FR 5.1.5 recommendations, FR 5.1.6 reason on every card, UC ViewRecommendations exception (no interests → distance + popularity, "Add interests" prompt), "Happening nearby" (3 km, next 7 days), pull to refresh |
| Discover (swipe + button fallback) | `src/app/(app)/(tabs)/discover.tsx`, `src/features/activities/SwipeDeck.tsx`        | FR 3.2.1–3.2.6, UC BrowseActivity: one card at a time, swipe right = save, left = skip, ✕ / ♥ buttons always on screen, ← / → keys on web, screen-reader actions, end-of-queue message, Reduce motion            |
| Activity detail                    | `src/app/(app)/activity/[id]/index.tsx`                                             | FR 3.1.2–3.1.7, FR 9.1.5 average + reviews, UC SaveActivity, UC JoinActivity (capacity, confirm before cancelling), UC ViewActivity exception, Report flag → P3's route                                           |
| My Activities                      | `src/app/(app)/my-activities.tsx`                                                   | Upcoming / Saved / Past (Dialog Map), Unsave, Rate → P2's rate screen when concluded and not yet rated (FR 9.1.3)                                                                                                 |
| Activity UI pieces                 | `src/features/activities/*`                                                         | `ActivityCard` (large/compact), `ActivityRow`, `ActivityTags`, `ActivityImage`, `Stars`, translated reason builder, SGT date formatting, metric distance                                                          |
| UI kit additions                   | `src/components/ui/ConfirmDialog.tsx`, `LoadingState.tsx`; `Screen` pull-to-refresh | Shown in the UI kit gallery                                                                                                                                                                                       |
| Activity API contract + mock       | `src/services/types.ts` (`ActivityService`), `src/services/mock/mockActivities.ts`  | Mirrors P2's `@communitylink/shared` (see below)                                                                                                                                                                  |
| Catalog aligned with P1            | `src/config/catalog.ts`                                                             | Category, accessibility and neighbourhood ids now equal P1's `INTERESTS`, `ACCESSIBILITY_NEEDS` and reference-data rows                                                                                           |

## What was built in Week 8 (P5)

| Deliverable (Plan.pdf) | Where                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Design system / UI kit | `src/theme/tokens.ts`, `src/components/ui/*`. Live gallery: Profile → Settings → _UI kit gallery_ (`/dev/ui-kit`) |
| 5-tab navigation       | `src/app/(app)/(tabs)/_layout.tsx`: Home · Discover · Map · Community · Profile                                   |
| Login / Sign up        | `src/app/(auth)/login.tsx`, `register.tsx` (FR 1.1, 1.2)                                                          |
| Singpass (mock)        | `src/app/(auth)/singpass.tsx` (FR 1.3; Plan cut-list #1: keep the mock)                                           |
| Profile setup          | `src/app/onboarding.tsx` (UC CreateProfile, FR 2.1)                                                               |
| Profile + Edit profile | `src/app/(app)/(tabs)/profile.tsx`, `edit-profile.tsx` (FR 2.2)                                                   |
| Settings               | `src/app/(app)/settings.tsx`: language, text size, reduce motion                                                  |
| Role-based routing     | `organiser/_layout.tsx`, `admin/_layout.tsx` redirect users without the role                                      |
| Session timeout        | `src/context/AuthContext.tsx`: logs out after 30 min of inactivity (NFR Session Management)                       |
| i18n scaffolding       | `src/i18n/`: English complete; 中文 / Melayu / தமிழ் fall back to English per key                                 |
| Placeholder screens    | Every Dialog Map screen has a real route with its owner and FRs listed on it                                      |

## For P2, P3 and P4: building your screens

1. Find your placeholder route (e.g. `src/app/(app)/post/create.tsx`). **Keep the file path** (it's the URL), and replace the body.
2. Build with the kit:

   ```tsx
   import { Screen, ScreenHeader, Button, TextField, Card, Tag, Banner } from '@/components/ui';
   import { useT } from '@/context/SettingsContext';

   export default function CreatePostScreen() {
     const t = useT();
     return (
       <Screen header={<ScreenHeader title={t('post.createTitle')} />} footer={<Button label={t('post.submit')} onPress={...} />}>
         ...
       </Screen>
     );
   }
   ```

3. Rules (these keep the app consistent and get it through the Week 10 WCAG pass):
   - **No hard-coded colours, font sizes or strings.** Use `colors`/`spacing` from `@/theme/tokens`, `<AppText variant=…>`, and `t('key')` with the key added to `src/i18n/en.ts`.
   - **Every icon-only button needs a `label`** (it's required on `IconButton`).
   - **Every gesture needs a button alternative** (FR 3.2.6). See the ✕ / ♥ pattern in the UI kit gallery.
   - Tab roots use `<Screen inTabs header={<AppHeader />}>`; every other screen uses `<ScreenHeader title=… />` (back arrow + dark title).
   - Navigate with `router.push('/activity/123')` from `expo-router`. Route names match the Dialog Map.
4. Categories, neighbourhoods and accessibility tags come from `src/config/catalog.ts` (NFR Maintainability), so don't duplicate them.

## Where this sits in the repo

This folder is a **standalone** Expo app (own `package.json` and lockfile), kept separate from `apps/mobile` so nothing P1 built is affected. It is not part of the npm workspaces, so the root `npm install`, `npm run typecheck` and CI ignore it. Run it from here: `cd summer-ui-ux && npm install && npm run web`.

Integration to-do (P1 + Summer): `apps/mobile` and `@communitylink/shared` already have real Supabase auth, which logs in with **email** and password. The Lab 2 requirements (FR 1.1, 1.2) say **phone number** and password, and this shell's login and sign-up forms follow the requirements. Agree which one the team ships. Either way the change stays inside `src/services/` and the two form screens.

## For P1: swapping in Supabase

Screens only talk to the interfaces in `src/services/types.ts` (`AuthService`, `ProfileService`).
Write `src/services/supabase/*.ts` implementing them, then change the two lines in `src/services/index.ts`.
Shared types in `src/types/models.ts` mirror the Lab 2 class diagram. Replace them with your canonical types, keeping the names.
The client-side route guards are for user experience only. Real access control must come from Supabase row-level security.

## For P2 (Shyanne): plugging in the real activity API

`ActivityService` in `src/services/types.ts` is a 1:1 wrapper over the functions on the `shyanne` branch, and the types in `src/types/models.ts` (`Activity`, `ActivityRecommendation`, `MyActivityCollections`, …) are copies of the shared ones, snake_case included. A Supabase implementation is mostly one-liners:

| `ActivityService`             | `@communitylink/shared`                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `getRecommendations(o)`       | `getActivityRecommendations(supabase, o)`                                           |
| `listActivities(f)`           | `filterActivities(await listActivities(supabase), f)`                               |
| `getActivity(id)`             | `getActivity(supabase, id)`                                                         |
| `getOrganiserName(a)`         | `getActivityOrganiserName(supabase, a)`                                             |
| `getParticipation(id)`        | `getMyActivityParticipation(supabase, id)`                                          |
| `save` / `unsave`             | `saveActivity` / `unsaveActivity`                                                   |
| `join` / `leave`              | `joinActivity` / `leaveActivity`                                                    |
| `listRatings(id)`             | `listActivityRatings(supabase, id)` (+ reviewer `display_name` for the review list) |
| `listMine()`                  | `listMyActivityCollections(supabase)`                                               |
| `createDiscoverySession(ids)` | `createActivityDiscoverySession(supabase, ids)`                                     |

Map `ApiError.code` to `ServiceError` codes (`not_found` → `NOT_FOUND`, full → `ACTIVITY_FULL`, `skip_unavailable` → `SKIP_UNAVAILABLE`, `busy` → `BUSY`, `timeout` → `TIMEOUT`) so the screens show the right message. Notes:

- **Profile fields.** The shell's `UserProfile` is camelCase and its neighbourhood is a slug. When P1's profile API lands, convert with `findNeighbourhood(id).dbId` (`src/config/catalog.ts`); interest and accessibility ids already match.
- **Reasons.** The UI builds its own translated reason from the recommendation (`features/activities/reasons.ts`), because the API's `reasons` are English sentences. Same inputs, same logic.
- **Images.** The `activities` table has no image column, so the photo comes from the category (`CATEGORY_IMAGES`). If an `image_url` column is added later, use it in `ActivityImage` first.
- **Skip.** If the skip RPC isn't adopted yet, `act(id, 'skip')` throws and Discover puts the card back with an error. Adopt the RPC before the demo.

## Design decisions (where the Lab 2 mockups disagreed)

- **One selected-state colour.** The mockups mixed red and teal for selected chips, tabs and buttons. Everything uses brand red now, with a check icon so selection doesn't rely on colour alone (WCAG 1.4.1).
- **Primary red darkened** from `#F04438` to `#D92D20`, because white text on the mockup red fails WCAG AA contrast (3.6:1 → 4.8:1).
- **One header style.** Back arrow plus a dark, bold, left-aligned title on every pushed screen (the mockups also had centred red titles). Tab roots use the brand header (logo, bell, avatar).
- **Sign up takes only phone and password** (FR 1.1.1). The mockup's "Full name" and photo moved to Complete Your Profile as display name and avatar (FR 2.1.2–2.1.3).
- **Profile shows only data-model fields.** The "Bio" and "Favourite food" tiles aren't in the data dictionary or class diagram, so Profile shows neighbourhood, interests and accessibility preferences instead.
- **No "Forgot password?" link.** It's not in the FRs or use cases, so it was left out rather than shipped as a dead link.
- **Discover buttons are always visible.** The mockup puts ✕ / ♥ over the bottom of the card, where they scroll off on smaller phones and at larger text sizes. They now sit in a sticky bar above the tab bar, with text labels, so the button alternative (FR 3.2.6) is never hidden. Swiping right **saves** (as the mockup annotation says, it then appears in My activities → Saved); it never registers you.
- **Discover header.** The mockup gave Discover a back arrow and a centred red title. It is a tab root, so it uses the brand header like Home, with a "1 of 10" counter.
- **Save / Join footer on Activity detail.** The mockup's Save and teal "Join Activity" buttons are kept at the bottom but made sticky, in the shared button styles (outline + brand red). Once joined, Join becomes "Cancel my spot", and a confirmation dialog appears before cancelling (UC JoinActivity). Full activities show a greyed "Full" button plus an explanation.
- **Rating entry point.** The mockup's "Click here to leave ratings" on the star count is replaced by a "Rate this activity" button that only appears once you joined and the activity has ended (UC RateActivity preconditions, Dialog Map `tapRate [activityConcluded]`). The star count is display-only.
- **One rating colour.** Stars use a dark amber (`colors.star`) that keeps 3:1 contrast on white; the mockup's light yellow did not.
- **My activities tabs** use the shared `SegmentedTabs` (not the mockup's teal pills), and each row has a real "View details" button plus Unsave / Rate where relevant.
- **Times are Singapore time** everywhere, whatever the phone's timezone, and distances are metric (UC ViewRecommendations).
- **Grey wireframe dashboards** (Organiser/Admin) will be built with the same kit components (`ListRow tile`, `Card`, `Button`), so they match the rest of the app.

## Folder map

```
src/
  app/                 routes (Expo Router)
    (auth)/            guest-only: login, register, singpass
    onboarding.tsx     logged in, no profile yet
    (app)/             logged in + profile done
      (tabs)/          5-tab spine
      organiser/ admin/  role-gated
      …                pushed screens (placeholders for P2–P4)
  components/ui/       UI kit
  features/activities/ activity cards, swipe deck, formatting, recommendation reasons
  components/layout/   Screen, ScreenHeader, AppHeader, Section, Logo
  context/             AuthContext (session, roles, timeout), SettingsContext (i18n, text size)
  config/catalog.ts    categories / neighbourhoods / accessibility tags
  i18n/                strings
  services/            API contract + mock backend
  theme/tokens.ts      design tokens
  types/models.ts      entity types
```
