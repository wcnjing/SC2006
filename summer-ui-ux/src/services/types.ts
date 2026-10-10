import type { TranslationKey } from '@/i18n/en';
import type { ProfileInput, Session, SingpassIdentity, UserProfile } from '@/types/models';

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
  | 'NETWORK';

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
