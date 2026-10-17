import { ApiError } from '@communitylink/shared';

import { ServiceError, type ServiceErrorCode } from '../types';

/** ApiError.code (P1/P2 shared API, Supabase Auth, Postgres) → the shell's ServiceError codes. */
const CODES: Record<string, ServiceErrorCode> = {
  invalid_credentials: 'INVALID_CREDENTIALS',
  user_already_exists: 'EMAIL_TAKEN',
  email_exists: 'EMAIL_TAKEN',
  unauthenticated: 'NOT_AUTHENTICATED',
  forbidden: 'FORBIDDEN',
  '42501': 'FORBIDDEN',
  not_found: 'NOT_FOUND',
  PGRST116: 'NOT_FOUND',
  skip_unavailable: 'SKIP_UNAVAILABLE',
  busy: 'BUSY',
  timeout: 'TIMEOUT',
};

export function toServiceError(e: unknown): unknown {
  if (e instanceof ServiceError) return e;
  if (e instanceof ApiError) {
    const code = e.code && CODES[e.code];
    if (code) return new ServiceError(code);
    if (/full/i.test(e.message)) return new ServiceError('ACTIVITY_FULL');
    if (/cancelled|completed|already started/i.test(e.message))
      return new ServiceError('ACTIVITY_UNAVAILABLE');
    return e;
  }
  // fetch() failures (offline, wrong URL) surface as TypeError.
  if (e instanceof TypeError) return new ServiceError('NETWORK');
  return e;
}

/** Run a call and rethrow any failure as a ServiceError the screens understand. */
export async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw toServiceError(e);
  }
}
