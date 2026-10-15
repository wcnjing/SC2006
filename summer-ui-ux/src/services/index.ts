import { mockActivities } from './mock/mockActivities';
import { mockAuth, mockProfile } from './mock/mockBackend';
import type { ActivityService, AuthService, ProfileService } from './types';

/**
 * The service implementations the app uses. Swap these for the Supabase
 * versions once P1's auth/profile API and P2's activity API are merged.
 */
export const authService: AuthService = mockAuth;
export const profileService: ProfileService = mockProfile;
export const activityService: ActivityService = mockActivities;

export * from './types';
