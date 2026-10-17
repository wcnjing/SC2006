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
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DEMO_MODE } from '../lib/runtime';
import { DEMO_ACCOUNTS, getDemoBackend } from '../demo/demoBackend';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  // true until the stored session (if any) has been restored on app start
  loading: boolean;
  // shown on the login screen after a forced sign-out (timeout, suspension)
  signedOutReason: string | null;
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: (reason?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return DEMO_MODE ? (
    <DemoAuthProvider>{children}</DemoAuthProvider>
  ) : (
    <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
  );
}

function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  const [{ profile, signedOutReason }, setAuth] = useState<{
    profile: Profile | null;
    signedOutReason: string | null;
  }>(() => {
    try {
      return { profile: getDemoBackend().getProfile(), signedOutReason: null };
    } catch (error) {
      return {
        profile: null,
        signedOutReason: error instanceof Error ? error.message : 'Unable to load demo data.',
      };
    }
  });
  const session = useMemo<Session | null>(
    () =>
      profile
        ? {
            access_token: 'local-demo-only',
            refresh_token: 'local-demo-only',
            token_type: 'bearer',
            expires_in: 1800,
            user: {
              id: profile.id,
              aud: 'authenticated',
              created_at: profile.created_at,
              email: DEMO_ACCOUNTS.find((account) => account.profile.id === profile.id)?.email,
              app_metadata: { provider: 'demo' },
              user_metadata: { display_name: profile.display_name },
            },
          }
        : null,
    [profile],
  );
  const signOut = useCallback(async (reason?: string) => {
    getDemoBackend().signOut();
    setAuth({ profile: null, signedOutReason: reason ?? null });
  }, []);
  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading: false,
      signedOutReason,
      signOut,
      signIn: async ({ email }) => {
        setAuth({ profile: getDemoBackend().signIn(email), signedOutReason: null });
      },
      signUp: async () => {
        throw new Error('Choose one of the demo residents.');
      },
      refreshProfile: async () => {
        const next = getDemoBackend().getProfile();
        setAuth((previous) => ({ ...previous, profile: next }));
      },
    }),
    [session, profile, signedOutReason, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOutReason, setSignedOutReason] = useState<string | null>(null);

  const signOut = useCallback(async (reason?: string) => {
    setSignedOutReason(reason ?? null);
    await apiSignOut(supabase);
  }, []);

  const loadProfile = useCallback(async () => {
    const next = await getMyProfile(supabase);
    if (next.status === 'suspended') {
      const why = next.suspended_reason ? ` Reason: ${next.suspended_reason}` : '';
      await signOut(`Your account has been suspended.${why}`);
      return;
    }
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
      signIn: async (input) => {
        setSignedOutReason(null);
        await apiSignIn(supabase, input);
      },
      signUp: async (input) => {
        setSignedOutReason(null);
        await apiSignUp(supabase, input);
      },
      signOut,
      refreshProfile: loadProfile,
    }),
    [session, profile, loading, signedOutReason, signOut, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
