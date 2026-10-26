import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';
import type { CommunityLinkClient, Database } from '@communitylink/shared';
import { AppState } from 'react-native';
import { DEMO_MODE } from './runtime';

const supabaseUrl = DEMO_MODE ? 'http://127.0.0.1:1' : process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = DEMO_MODE
  ? 'demo-unused-key'
  : process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copy apps/mobile/.env.example to apps/mobile/.env and fill it in.',
  );
}

export const supabase: CommunityLinkClient = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      storage: localStorage,
      autoRefreshToken: !DEMO_MODE,
      persistSession: !DEMO_MODE,
      detectSessionInUrl: false,
    },
    ...(DEMO_MODE
      ? {
          global: {
            fetch: async () => {
              throw new Error('Supabase requests are disabled in demo mode.');
            },
          },
        }
      : {}),
  },
);

// Only refresh tokens while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (DEMO_MODE) return;
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
