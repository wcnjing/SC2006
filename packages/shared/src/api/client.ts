import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

// Every API function takes the typed client as its first argument, so the
// same code works in the Expo app, a web app, scripts and tests.
export type CommunityLinkClient = SupabaseClient<Database>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Postgres error codes we raise or hit regularly.
const FRIENDLY_MESSAGES: Record<string, string> = {
  '42501': 'You do not have permission to do that.',
  '23505': 'That already exists.',
  PGRST116: 'Not found.',
};

export function toApiError(error: { message: string; code?: string }): ApiError {
  const friendly = error.code ? FRIENDLY_MESSAGES[error.code] : undefined;
  // RLS violations come back as 42501 with a technical message; our own
  // `raise exception` messages are already readable, so keep those.
  const isRlsViolation = error.message.includes('row-level security');
  return new ApiError(
    isRlsViolation || !error.message ? (friendly ?? error.message) : error.message,
    error.code,
    error,
  );
}

// Unwraps a Supabase `{ data, error }` response, throwing ApiError on failure.
// Supabase only returns data: null alongside an error (or for void RPCs).
export function unwrap<T>(result: {
  data: T | null;
  error: { message: string; code?: string } | null;
}): T {
  if (result.error) throw toApiError(result.error);
  return result.data as T;
}
