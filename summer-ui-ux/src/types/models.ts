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
