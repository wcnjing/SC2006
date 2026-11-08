import { supabase } from '@/lib/supabase';

import { mockActivities } from './mock/mockActivities';
import { mockAuth, mockProfile } from './mock/mockBackend';
import { mockCommunity } from './mock/mockCommunity';
import { createSupabaseActivities } from './supabase/activities';
import { createSupabaseAuth } from './supabase/auth';
import { createSupabaseCommunity } from './supabase/community';
import type { ActivityService, AuthService, CommunityService, ProfileService } from './types';

/**
 * Which backend the app talks to. With EXPO_PUBLIC_SUPABASE_URL and
 * EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY set (repository-root .env), everything
 * uses the team's real API in @communitylink/shared: P1 auth and profiles,
 * P2 activities, P3 community. Without them, everything runs on the in-device
 * mock, so the shell works with no setup.
 */
const real = supabase ? createSupabaseAuth(supabase) : null;

export const authService: AuthService = real?.auth ?? mockAuth;
export const profileService: ProfileService = real?.profile ?? mockProfile;
export const activityService: ActivityService = supabase
  ? createSupabaseActivities(supabase)
  : mockActivities;
export const communityService: CommunityService = supabase
  ? createSupabaseCommunity(supabase)
  : mockCommunity;

export * from './types';
