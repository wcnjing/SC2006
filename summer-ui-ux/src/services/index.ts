import { getMyProfile } from '@communitylink/shared';

import { supabase } from '@/lib/supabase';

import { mockActivities, setMockActivityUser } from './mock/mockActivities';
import { mockAuth, mockProfile } from './mock/mockBackend';
import { createSupabaseAuth } from './supabase/auth';
import { toSession } from './supabase/mapping';
import { ServiceError, type ActivityService, type AuthService, type ProfileService } from './types';

/**
 * Which backend the app talks to. With EXPO_PUBLIC_SUPABASE_URL and
 * EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY set (summer-ui-ux/.env), auth and
 * profiles use P1's real Supabase API. Without them, everything runs on the
 * in-device mock, so the shell works with no setup.
 *
 * Activities: still the mock until P2's API (`shyanne` branch) is merged.
 * In Supabase mode the mock follows the real logged-in user.
 */
const real = supabase ? createSupabaseAuth(supabase) : null;

export const authService: AuthService = real?.auth ?? mockAuth;
export const profileService: ProfileService = real?.profile ?? mockProfile;
export const activityService: ActivityService = mockActivities;

if (supabase) {
  const client = supabase;
  setMockActivityUser(async () => {
    const { data } = await client.auth.getSession();
    if (!data.session) throw new ServiceError('NOT_AUTHENTICATED');
    const s = await toSession(client, data.session, await getMyProfile(client));
    return { account: s.account, profile: s.profile };
  });
}

export * from './types';
