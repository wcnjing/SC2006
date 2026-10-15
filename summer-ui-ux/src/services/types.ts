import type { TranslationKey } from '@/i18n/en';
import type {
  Activity,
  ActivityDiscoveryAction,
  ActivityFilters,
  ActivityParticipation,
  ActivityRating,
  ActivityRecommendations,
  MyActivityCollections,
  ProfileInput,
  Session,
  SingpassIdentity,
  UserProfile,
} from '@/types/models';

/**
 * API contract the frontend shell depends on.
 *
 * The mock implementation in ./mock is used until P1's Supabase auth and
 * profile API land. To switch, write a `supabase` implementation of these
 * interfaces and export it from ./index.ts. No screen code needs to change.
 */

export type ServiceErrorCode =
  | 'PHONE_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_SUSPENDED'
  | 'SINGPASS_FAILED'
  | 'NOT_AUTHENTICATED'
  | 'NETWORK'
  // Activities (map from P2's ApiError.code: not_found, full / conflict, skip_unavailable, busy, timeout)
  | 'NOT_FOUND'
  | 'ACTIVITY_FULL'
  | 'ACTIVITY_UNAVAILABLE'
  | 'SKIP_UNAVAILABLE'
  | 'BUSY'
  | 'TIMEOUT';

export class ServiceError extends Error {
  constructor(public code: ServiceErrorCode) {
    super(code);
  }
}

export const errorMessageKey = (e: unknown): TranslationKey => {
  if (!(e instanceof ServiceError)) return 'error.generic';
  switch (e.code) {
    case 'PHONE_TAKEN':
      return 'error.phoneTaken';
    case 'INVALID_CREDENTIALS':
      return 'error.invalidCredentials';
    case 'ACCOUNT_SUSPENDED':
      return 'error.suspended';
    case 'SINGPASS_FAILED':
      return 'error.singpassFailed';
    case 'NOT_FOUND':
      return 'error.notFound';
    case 'ACTIVITY_FULL':
      return 'error.activityFull';
    case 'ACTIVITY_UNAVAILABLE':
      return 'error.activityUnavailable';
    case 'BUSY':
      return 'error.busy';
    case 'TIMEOUT':
      return 'error.timeout';
    default:
      return 'error.generic';
  }
};

export interface AuthService {
  /** FR 1.1: create a consumer account. Throws PHONE_TAKEN. Returns a session with profile = null. */
  register(phone: string, password: string): Promise<Session>;
  /** FR 1.2: throws INVALID_CREDENTIALS / ACCOUNT_SUSPENDED. */
  login(phone: string, password: string): Promise<Session>;
  /**
   * FR 1.3: exchange a Singpass identity (after consent) for a session.
   * Links to an existing account or creates one; `isNew` tells the UI to
   * route to Complete Profile with Singpass data prefilled.
   */
  loginWithSingpass(identity: SingpassIdentity): Promise<{ session: Session; isNew: boolean }>;
  /** Restore a persisted session (null if none or expired). */
  restore(): Promise<Session | null>;
  logout(): Promise<void>;
}

export interface ProfileService {
  /** FR 2.1 / 2.2: create or replace the current user's profile. */
  saveProfile(accountId: string, input: ProfileInput): Promise<UserProfile>;
  /**
   * Upload a picked local image and return its public URL. In Supabase this
   * is a Storage bucket upload. The mock returns the local URI unchanged.
   */
  uploadAvatar(accountId: string, localUri: string): Promise<string>;
}

/**
 * One Discover browsing session (FR 3.2.5: dismissed cards don't come back
 * in the same session). = P2's `ActivityDiscoverySession`.
 */
export interface ActivityDiscoverySession {
  readonly excludedActivityIds: readonly string[];
  /** Next batch of cards, excluding saved, joined, skipped and this session's decisions. */
  load(options?: { filters?: ActivityFilters; limit?: number }): Promise<Activity[]>;
  /** Right swipe / Save button → 'like'. Left swipe / Skip button → 'skip'. */
  act(activityId: string, action: ActivityDiscoveryAction): Promise<void>;
}

/**
 * Activity discovery API (P2, Shyanne). Each method maps 1:1 onto a function
 * in @communitylink/shared (`shyanne` branch); the name is given on each
 * line. A Supabase implementation is a thin wrapper that passes the client:
 *   getRecommendations: (o) => getActivityRecommendations(supabase, o)
 */
export interface ActivityService {
  /** FR 5.1 → getActivityRecommendations. Must resolve within 3 s (UC #5-03). */
  getRecommendations(options?: {
    deviceLocation?: { lat: number; lng: number };
  }): Promise<ActivityRecommendations>;
  /** FR 3.1 / 4.2 → filterActivities(await listActivities()). Upcoming, scheduled only. */
  listActivities(filters?: ActivityFilters): Promise<Activity[]>;
  /** FR 3.1 → getActivity. Null when it does not exist. Cancelled activities are still returned. */
  getActivity(id: string): Promise<Activity | null>;
  /** FR 3.1.6 → getActivityOrganiserName (public display name only). */
  getOrganiserName(activity: Activity): Promise<string | null>;
  /** UC JoinActivity / SaveActivity state → getMyActivityParticipation. */
  getParticipation(activityId: string): Promise<ActivityParticipation>;
  /** UC SaveActivity → saveActivity / unsaveActivity. Idempotent. */
  save(activityId: string): Promise<void>;
  unsave(activityId: string): Promise<void>;
  /** UC JoinActivity → joinActivity / leaveActivity. Throws ACTIVITY_FULL / ACTIVITY_UNAVAILABLE. */
  join(activityId: string): Promise<void>;
  leave(activityId: string): Promise<void>;
  /** FR 9.1.5 → listActivityRatings (newest first). */
  listRatings(activityId: string): Promise<ActivityRating[]>;
  /** My activities → listMyActivityCollections. */
  listMine(): Promise<MyActivityCollections>;
  /** FR 3.2 → createActivityDiscoverySession. Create once per browsing session. */
  createDiscoverySession(restoredIds?: readonly string[]): Promise<ActivityDiscoverySession>;
}
