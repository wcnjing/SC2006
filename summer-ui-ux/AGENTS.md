This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## CommunityLink project conventions (read before writing screens)

- Build every screen with the UI kit: `import { Screen, ScreenHeader, Button, ... } from '@/components/ui'`. Do not create new one-off buttons, inputs or headers. Extend the kit in `src/components/ui/` instead.
- No hard-coded colours, font sizes or user-facing strings. Use `colors` / `spacing` / `radii` from `@/theme/tokens`, `<AppText variant="...">` for text, and `t('key')` (from `useT()`) with new keys added to `src/i18n/en.ts`.
- Accessibility (WCAG 2.1 AA is a project NFR): every icon-only control needs a `label`; touch targets are at least `MIN_TOUCH` (48); every gesture (e.g. swipe) must have an equivalent button.
- Tab-root screens: `<Screen inTabs header={<AppHeader />}>`. All other screens: `<Screen header={<ScreenHeader title={...} />}>`.
- Placeholder routes in `src/app/(app)/` are named after the Dialog Map. Keep the file path and replace the body.
- Data access goes through `src/services` interfaces only. Never call Supabase directly from a screen.
- Categories, neighbourhoods and accessibility tags come from `src/config/catalog.ts`.
- Run `npm run typecheck` and `npm run lint` before committing.
