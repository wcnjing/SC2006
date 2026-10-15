/**
 * Frontend view of the Lab 2 entity classes (Section 5 class diagram).
 *
 * P1 owns the canonical shared types. When those land, replace these with
 * re-exports from P1's package and keep the names, so screens don't change.
 * Only the fields the shell needs are included here.
 */

export type UserRole = 'consumer' | 'organiser' | 'admin';

export type AccountStatus = 'active' | 'suspended';

/** <<entity>> UserAccount */
export interface UserAccount {
  accountId: string;
  phoneNumber: string | null; // [0..1]: Singpass-only accounts may not have one
  roles: UserRole[];
  status: AccountStatus;
  createdAt: string; // ISO DateTime
  linkedSingpass: boolean;
}

/** <<entity>> UserProfile (0..1 per account; null until onboarding is done) */
export interface UserProfile {
  profileId: string;
  displayName: string;
  pictureUrl: string | null;
  neighbourhoodId: string; // Community.communityId
  interestIds: string[]; // ActivityCategory.categoryId[]
  accessibilityTagIds: string[]; // AccessibilityTag.tagId[]
  preferredLanguage: 'en' | 'zh' | 'ms' | 'ta';
  updatedAt: string;
}

export type ProfileInput = Omit<UserProfile, 'profileId' | 'updatedAt'>;

export interface Session {
  account: UserAccount;
  profile: UserProfile | null;
  token: string;
}

/** Data returned by (mock) Singpass after consent: FR 1.3.4 */
export interface SingpassIdentity {
  uinfin: string;
  name: string;
  mobile: string | null;
}

export const hasRole = (account: UserAccount | null | undefined, role: UserRole) =>
  !!account?.roles.includes(role);

/* -------------------------------------------------------------------------- */
/* Activities (P2 / Shyanne).                                                 */
/*                                                                            */
/* These mirror @communitylink/shared on the `shyanne` branch field for field */
/* (snake_case, because they are the Supabase row types). That way P2's API   */
/* functions plug into src/services without any mapping. Do not rename.      */
/* -------------------------------------------------------------------------- */

export type ActivityStatus = 'scheduled' | 'cancelled' | 'completed';
export type ActivitySource = 'organiser' | 'dataset';

/** = shared `Activity` (Tables<'activities'>). */
export interface Activity {
  id: string; // uuid
  title: string;
  description: string;
  category: string; // CATEGORIES id
  tags: string[];
  accessibility_features: string[]; // ACCESSIBILITY_TAGS ids
  is_outdoor: boolean;
  location_name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  neighbourhood_id: number | null; // NEIGHBOURHOODS dbId
  organiser_id: string | null;
  source: ActivitySource;
  starts_at: string; // ISO
  ends_at: string; // ISO
  status: ActivityStatus;
  capacity: number | null; // null = no limit
  cost_cents: number;
  cancelled_reason: string | null;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

/** = shared `ActivityRating` (Tables<'activity_ratings'>), plus the reviewer's public name. */
export interface ActivityRating {
  activity_id: string;
  user_id: string;
  rating: number; // 1–5
  comment: string | null;
  created_at: string;
  /** Not in the row; P2 reads it from profiles.display_name (public field only). */
  reviewer_name?: string | null;
}

/** = shared `RecommendationOrigin`. */
export interface RecommendationOrigin {
  lat: number;
  lng: number;
  label: string;
  source: 'device' | 'neighbourhood';
}

/** = shared `ActivityRecommendation`. `reasons` are P2's English strings; the UI builds its own translated reason. */
export interface ActivityRecommendation {
  activity: Activity;
  score: number;
  reasons: string[];
  distanceKm: number | null;
  joinedCount: number;
  scores: { interests: number; proximity: number; popularity: number };
}

/** = shared `ActivityRecommendations`. */
export interface ActivityRecommendations {
  recommendations: ActivityRecommendation[];
  /** False when the profile has no interests (UC ViewRecommendations exception 1). */
  personalised: boolean;
  origin: RecommendationOrigin | null;
}

/** = shared `ActivityParticipation`. */
export interface ActivityParticipation {
  saved: boolean;
  joined: boolean;
  activity: Activity;
  joinedCount: number;
}

/** = shared `MyActivityCard` / `MyActivityCollections`. */
export interface MyActivityCard {
  activity: Activity;
  saved: boolean;
  joined: boolean;
}

export interface MyActivityCollections {
  saved: MyActivityCard[];
  /** Upcoming, joined. */
  joined: MyActivityCard[];
  /** Started or finished, joined; newest first. */
  history: MyActivityCard[];
}

/** = shared `ActivityDiscoveryAction`. 'like' and 'save' both bookmark. */
export type ActivityDiscoveryAction = 'like' | 'skip' | 'save';

/** = shared `ActivityFilters` (subset the shell uses). */
export interface ActivityFilters {
  keyword?: string;
  category?: string;
  neighbourhoodId?: number;
  dateFrom?: string; // YYYY-MM-DD, Singapore date
  dateTo?: string;
  accessibility?: string[];
  environment?: 'indoor' | 'outdoor';
  distance?: { origin: { lat: number; lng: number }; maxKm: number };
}
