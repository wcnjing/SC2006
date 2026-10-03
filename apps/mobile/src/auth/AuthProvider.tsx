import {
  getMyProfile,
  signIn as apiSignIn,
  signOut as apiSignOut,
  signUp as apiSignUp,
  type Profile,
  type SignInInput,
  type SignUpInput,
} from '@communitylink/shared';
import type { Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  // true until the stored session (if any) has been restored on app start
  loading: boolean;
  // shown on the login screen after a forced sign-out (timeout, suspension)
  signedOutReason: string | null;
  justRegistered: boolean;
  signIn: (input: SignInInput) => Promise<void>;
  signInWithMockpass: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: (reason?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOutReason, setSignedOutReason] = useState<string | null>(null);
  const [justRegistered, setJustRegistered] = useState(false);

  const signOut = useCallback(async (reason?: string) => {
    setSignedOutReason(reason ?? null);
    setJustRegistered(false);
    await apiSignOut(supabase);
  }, []);

  const loadProfile = useCallback(async () => {
    const next = await getMyProfile(supabase);
    if (next.status === 'suspended') {
      const why = next.suspended_reason ? ` Reason: ${next.suspended_reason}` : '';
      await signOut(`Your account has been suspended.${why}`);
      return;
    }
    if (next.onboarded) setJustRegistered(false);
    setProfile(next);
  }, [signOut]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setLoading(false);
        return;
      }
      // Defer Supabase calls out of the auth callback to avoid a client deadlock.
      setTimeout(() => {
        loadProfile()
          .catch(() => setProfile(null))
          .finally(() => setLoading(false));
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      signedOutReason,
      justRegistered,
      signIn: async (input) => {
        setSignedOutReason(null);
        setJustRegistered(false);
        await apiSignIn(supabase, input);
      },
      signInWithMockpass: async () => {
        setSignedOutReason(null);
        const authServiceUrl =
          process.env.EXPO_PUBLIC_MOCKPASS_AUTH_URL ?? 'http://127.0.0.1:3000';
        const redirectUri = 'communitylink://mockpass/callback';
        const result = await WebBrowser.openAuthSessionAsync(
          `${authServiceUrl}/auth/mockpass/start`,
          redirectUri,
        );
        if (result.type !== 'success') return;

        const callback = new URL(result.url);
        const accessToken = callback.searchParams.get('access_token');
        const refreshToken = callback.searchParams.get('refresh_token');
        if (!accessToken || !refreshToken) {
          throw new Error('Mockpass did not return a valid session.');
        }
        setJustRegistered(true);
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      },
      signUp: async (input) => {
        setSignedOutReason(null);
        setJustRegistered(true);
        await apiSignUp(supabase, input);
      },
      signOut,
      refreshProfile: loadProfile,
    }),
    [session, profile, loading, signedOutReason, justRegistered, signOut, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
