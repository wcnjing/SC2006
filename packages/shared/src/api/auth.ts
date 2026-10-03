import type { Session } from '@supabase/supabase-js';
import { validateDisplayName, validateEmail, validatePassword } from '../validation';
import { ApiError, type CommunityLinkClient } from './client';

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  user_already_exists: 'An account with this email already exists.',
  email_exists: 'An account with this email already exists.',
  email_not_confirmed: 'Please confirm your email before logging in.',
  weak_password: 'Password is too weak.',
  over_request_rate_limit: 'Too many attempts. Please wait a minute and try again.',
};

function authError(error: { message: string; code?: string }): ApiError {
  const message = (error.code && AUTH_MESSAGES[error.code]) || error.message;
  return new ApiError(message, error.code, error);
}

function firstError(...errors: (string | null)[]): string | null {
  return errors.find((e) => e !== null) ?? null;
}

// FR 1.1: register with email + password. A profile row is created by the
// handle_new_user trigger using display_name from the metadata.
export async function signUp(
  client: CommunityLinkClient,
  input: SignUpInput,
): Promise<Session | null> {
  const invalid = firstError(
    validateDisplayName(input.displayName),
    validateEmail(input.email),
    validatePassword(input.password),
  );
  if (invalid) throw new ApiError(invalid, 'validation');

  const { data, error } = await client.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: { data: { display_name: input.displayName.trim() } },
  });
  if (error) throw authError(error);
  // session is null when email confirmation is switched on.
  return data.session;
}

export async function signIn(client: CommunityLinkClient, input: SignInInput): Promise<Session> {
  const invalid = validateEmail(input.email);
  if (invalid) throw new ApiError(invalid, 'validation');
  if (!input.password) throw new ApiError('Password is required', 'validation');

  const { data, error } = await client.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });
  if (error) throw authError(error);
  return data.session;
}

export async function signOut(client: CommunityLinkClient): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) throw authError(error);
}

export async function getCurrentUserId(client: CommunityLinkClient): Promise<string | null> {
  const { data } = await client.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function requireUserId(client: CommunityLinkClient): Promise<string> {
  const id = await getCurrentUserId(client);
  if (!id) throw new ApiError('You need to be logged in.', 'unauthenticated');
  return id;
}
