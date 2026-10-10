import { mockAuth, mockProfile } from './mock/mockBackend';
import type { AuthService, ProfileService } from './types';

/**
 * The service implementations the app uses. Swap these for the Supabase
 * versions once P1's auth and profile API are merged.
 */
export const authService: AuthService = mockAuth;
export const profileService: ProfileService = mockProfile;

export * from './types';
