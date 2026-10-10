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

| Phone    | Roles               | Use it to test                           |
| -------- | ------------------- | ---------------------------------------- |
| 91234567 | consumer            | normal user ("Mrs Tan"), Singpass-linked |
| 92345678 | consumer, organiser | Organiser dashboard entry in Profile     |
| 93456789 | consumer, admin     | Admin dashboard entry in Profile         |
| 94567890 | suspended           | the "account suspended" error            |

Mock Singpass: on Login, tap **Log in with singpass**. "Tan Mei Ling" logs in as the existing demo user. "Lim Wei Jie" is a new user, who goes to Complete Your Profile with the name prefilled.
To reset the mock data, clear site data in the browser (or reinstall the app).

## What's built (P5, Week 8)

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

## Design decisions (where the Lab 2 mockups disagreed)

- **One selected-state colour.** The mockups mixed red and teal for selected chips, tabs and buttons. Everything uses brand red now, with a check icon so selection doesn't rely on colour alone (WCAG 1.4.1).
- **Primary red darkened** from `#F04438` to `#D92D20`, because white text on the mockup red fails WCAG AA contrast (3.6:1 → 4.8:1).
- **One header style.** Back arrow plus a dark, bold, left-aligned title on every pushed screen (the mockups also had centred red titles). Tab roots use the brand header (logo, bell, avatar).
- **Sign up takes only phone and password** (FR 1.1.1). The mockup's "Full name" and photo moved to Complete Your Profile as display name and avatar (FR 2.1.2–2.1.3).
- **Profile shows only data-model fields.** The "Bio" and "Favourite food" tiles aren't in the data dictionary or class diagram, so Profile shows neighbourhood, interests and accessibility preferences instead.
- **No "Forgot password?" link.** It's not in the FRs or use cases, so it was left out rather than shipped as a dead link.
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
  components/layout/   Screen, ScreenHeader, AppHeader, Section, Logo
  context/             AuthContext (session, roles, timeout), SettingsContext (i18n, text size)
  config/catalog.ts    categories / neighbourhoods / accessibility tags
  i18n/                strings
  services/            API contract + mock backend
  theme/tokens.ts      design tokens
  types/models.ts      entity types
```
