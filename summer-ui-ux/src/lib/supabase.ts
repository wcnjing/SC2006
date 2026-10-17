import 'react-native-url-polyfill/auto';

import type { CommunityLinkClient, Database } from '@communitylink/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

/**
 * Supabase client, set up the same way as P1's apps/mobile/src/lib/supabase.ts.
 * Fill in summer-ui-ux/.env (copy .env.example). Without it the app runs on
 * the in-device mock backend, so the shell still works with no setup.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
/** Set EXPO_PUBLIC_BACKEND=mock to force the mock even when keys are present. */
const forceMock = process.env.EXPO_PUBLIC_BACKEND === 'mock';

export const supabase: CommunityLinkClient | null =
  url && key && !forceMock
    ? createClient<Database>(url, key, {
        auth: {
          // AsyncStorage needs `window` on web; during a static render there is none.
          storage:
            Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export const usingSupabase = supabase !== null;

if (supabase) {
  // Only refresh tokens while the app is in the foreground (as in apps/mobile).
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Xavier's Mockpass bridge (services/mockpass-auth on the `xavier` branch), e.g. http://127.0.0.1:3000 */
export const mockpassAuthUrl = process.env.EXPO_PUBLIC_MOCKPASS_AUTH_URL ?? null;
