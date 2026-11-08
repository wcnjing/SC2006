import { ApiError, type ActivityInput, type CommunityLinkClient } from '@communitylink/shared';

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
 * ./supabase implements it on the teammates' @communitylink/shared functions;
 * ./mock is the in-device stand-in used when Supabase isn't configured
 * (src/lib/supabase.ts). ./index.ts picks one; no screen code changes.
 */

export type ServiceErrorCode =
  | 'EMAIL_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_SUSPENDED'
  | 'SINGPASS_FAILED'
  | 'NOT_AUTHENTICATED'
  | 'NETWORK'
  /** Logged in, but the role can't do this (P2's APIs are resident-only). */
  | 'FORBIDDEN'
  | 'UPLOAD_FAILED'
  | 'GEOCODING_FAILED'
  /** Sign-up worked but the Supabase project requires email confirmation first. */
  | 'CONFIRM_EMAIL'
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
    case 'EMAIL_TAKEN':
      return 'error.emailTaken';
    case 'FORBIDDEN':
      return 'error.forbidden';
    case 'UPLOAD_FAILED':
      return 'error.uploadFailed';
    case 'GEOCODING_FAILED':
      return 'error.geocodingFailed';
    case 'CONFIRM_EMAIL':
      return 'error.confirmEmail';
    case 'NETWORK':
      return 'error.network';
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

/**
 * Message for a failed call. P2/P3 validation and conflict errors already carry
 * a user-facing sentence (e.g. "Start date/time must be in the future."), so
 * show it as is; everything else goes through errorMessageKey.
 */
export const errorText = (t: (key: TranslationKey) => string, e: unknown): string =>
  e instanceof ApiError ? e.message : t(errorMessageKey(e));

export interface AuthService {
  /** FR 1.1: create a resident account. Throws EMAIL_TAKEN. Returns a session with profile = null. */
  register(email: string, password: string): Promise<Session>;
  /** FR 1.2: throws INVALID_CREDENTIALS / ACCOUNT_SUSPENDED. */
  login(email: string, password: string): Promise<Session>;
  /**
   * FR 1.3 Singpass. Two ways in, depending on the backend:
   *  - singpassStartUrl() returns a URL → open it (Mockpass bridge); it comes
   *    back to /mockpass/callback with tokens → completeSingpassRedirect()
   *  - it returns null → the in-app mock consent screen → loginWithSingpass(identity)
   * `isNew` tells the UI to route to Complete Profile with the name prefilled.
   */
  singpassStartUrl(): string | null;
  completeSingpassRedirect(tokens: {
    accessToken: string;
    refreshToken: string;
  }): Promise<{ session: Session; isNew: boolean; displayName: string | null }>;
  loginWithSingpass(identity: SingpassIdentity): Promise<{ session: Session; isNew: boolean }>;
  /** Restore a persisted session (null if none or expired). */
  restore(): Promise<Session | null>;
  logout(): Promise<void>;
  /** FR 12.1.3: true once an admin has suspended the signed-in account. */
  isSuspended(): Promise<boolean>;
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
 * Activity API (P2, Shyanne). Each method maps 1:1 onto a function in
 * @communitylink/shared; the name is given on each line (./supabase/activities.ts).
 * Everything except listActivities / getActivity / getOrganiserName / listRatings
 * is role-gated by P2: participation, discovery and rating are resident-only,
 * the organiser methods are organiser-only (FORBIDDEN otherwise).
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
  /** UC RateActivity → submitActivityRating. Joined residents, once, after the end time. */
  rate(activityId: string, input: { rating: number; comment?: string | null }): Promise<void>;

  // Organiser (FR 11, P2 activityManagement). Organiser role only; own `source = organiser` rows.
  /** Organiser dashboard → listMyActivities. */
  listOrganised(): Promise<Activity[]>;
  /** UC CreateActivity → createActivity. */
  create(input: ActivityInput): Promise<Activity>;
  /** UC UpdateActivity → updateActivity. Pass the loaded `updated_at` so a stale edit is rejected. */
  update(id: string, input: ActivityInput, expectedUpdatedAt?: string): Promise<Activity>;
  /** UC CancelActivity → cancelActivity. A reason is required. */
  cancel(id: string, reason: string, expectedUpdatedAt?: string): Promise<Activity>;
}

/**
 * Community API (P3, Yining): posts, comments and likes, reports, moderation,
 * connections, direct messages and blocking. Each method is the
 * @communitylink/shared function of the same name, minus the client argument,
 * so the Supabase implementation is generated from this list.
 */
export const COMMUNITY_API = [
  'listPosts',
  'getPost',
  'createPost',
  'updatePost',
  'deletePost',
  'listComments',
  'createComment',
  'deleteComment',
  'getPostLikeState',
  'setPostLiked',
  'submitReport',
  'listMyReports',
  'listModerationReports',
  'getModerationReport',
  'reviewContentReport',
  'listModerationAudit',
  'listUsers',
  'setUserStatus',
  'sendConnectionRequest',
  'acceptConnectionRequest',
  'rejectConnectionRequest',
  'cancelConnectionRequest',
  'listConnections',
  'findConnectionPeople',
  'getDirectConversation',
  'sendDirectMessage',
  'listDirectMessages',
  'blockUser',
  'unblockUser',
  'listBlockedUsers',
] as const;

type WithoutClient<F> = F extends (client: CommunityLinkClient, ...args: infer A) => infer R
  ? (...args: A) => R
  : never;

export type CommunityService = {
  [K in (typeof COMMUNITY_API)[number]]: WithoutClient<(typeof import('@communitylink/shared'))[K]>;
};
