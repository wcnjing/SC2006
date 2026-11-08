# Google Maps integration templates

The repository contains two Expo apps. Each app has its own environment template
and dynamic Expo config template. The `summer-ui-ux` scripts explicitly load the
repository root `.env` file (`SC2006/.env`), so you do not need a second
`summer-ui-ux/.env` file:

- `apps/mobile/.env.example`
- `apps/mobile/app.config.google-maps.example.ts`
- `summer-ui-ux/.env.example`
- `summer-ui-ux/app.config.google-maps.example.ts`

## Setup

1. In Google Cloud Console, create or select a project. For the web demo,
   enable Maps Embed API and create a browser API key. For native builds,
   enable Maps SDK for Android and Maps SDK for iOS.
2. Restrict the native key to the Android package and iOS bundle identifier used
   by the app. Do not commit the real key.
3. Add the relevant variables to the repository root `.env` file and set
   `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY` for the web demo. The web key must be
   allowed to use Maps Embed API. The
   `summer-ui-ux` scripts load this root file automatically.
4. Copy the matching `app.config.google-maps.example.ts` to `app.config.ts`.
   The dynamic config preserves the existing `app.json` settings and adds the
   `react-native-maps` config plugin.
5. Install the native map package from the relevant app directory:

   ```powershell
   npx expo install react-native-maps
   ```

6. Use a development build after installing the native package. Expo Go can be
   used for basic testing, but a production/development binary needs the native
   key configured by the template:

   ```powershell
   npx expo run:android
   npx expo run:ios
   ```

The optional `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY` is for a separate Google Maps
JavaScript implementation on web. Restrict it by HTTP referrer and keep it
separate from the native key. `GOOGLE_MAPS_API_KEY` is read at build time; it
must not be treated as a server secret, but it should still be restricted in
Google Cloud Console.

## OneMap planning areas

The onboarding selector reads synced rows from `public.neighbourhoods`. The
OneMap identifier is stored in `neighbourhoods.onemap_id`, while the existing
numeric `neighbourhoods.id` remains the internal foreign key used by profiles
and activities.

Apply the migration, deploy
`supabase/functions/sync-planning-areas/index.ts`, and set the Edge Function
secret:

```powershell
supabase secrets set ONEMAP_TOKEN=your_onemap_token
```

The function also receives `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` from Supabase. OneMap access tokens expire after
two days, so the repository workflow
`.github/workflows/refresh-onemap-token.yml` refreshes the token and updates
the `ONEMAP_TOKEN` Edge Function secret through the Supabase Management API.

Configure these GitHub Actions repository secrets before enabling the scheduled
workflow:

- `ONEMAP_EMAIL`: the email registered with OneMap.
- `ONEMAP_PASSWORD`: the OneMap password.
- `SUPABASE_ACCESS_TOKEN`: a Supabase personal access token with permission to
  manage project secrets.
- `SUPABASE_PROJECT_REF`: the Supabase project reference only, such as
  `abcdefghijklmnop` (not the full URL). The workflow also accepts a full
  `https://<project-ref>.supabase.co` value.
- `SUPABASE_SERVICE_ROLE_KEY`: the project service-role key, used only by the
  monthly planning-area sync workflow.

The workflow refreshes `ONEMAP_TOKEN` every two days. A separate workflow,
`.github/workflows/sync-planning-areas.yml`, invokes
`sync-planning-areas` on the first day of every month. Run both workflows
manually once after adding the secrets to verify the setup. Do not put
`ONEMAP_EMAIL`, `ONEMAP_PASSWORD`, `ONEMAP_TOKEN`, `SUPABASE_ACCESS_TOKEN`, or
the service-role key in the client `.env`.
