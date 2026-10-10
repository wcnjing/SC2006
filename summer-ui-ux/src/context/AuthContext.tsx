import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { readJSON, writeJSON } from '@/lib/storage';
import { authService } from '@/services';
import {
  hasRole,
  type Session,
  type SingpassIdentity,
  type UserProfile,
  type UserRole,
} from '@/types/models';

/** NFR Security, Session Management: expire after 30 minutes of inactivity. */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;
const PERSIST_THROTTLE_MS = 60 * 1000;
const LAST_ACTIVE_KEY = 'last-active';

/**
 * Where the user is in the auth lifecycle. The root layout uses this to pick
 * which route group is reachable (Dialog Map 0 / 1).
 *   guest       → (auth) screens only
 *   onboarding  → logged in but no profile yet → Complete Your Profile
 *   ready       → main app (tabs and the rest)
 */
export type AuthStatus = 'loading' | 'guest' | 'onboarding' | 'ready';

type AuthValue = {
  status: AuthStatus;
  session: Session | null;
  /** Set when the last logout was caused by inactivity, so Login can explain it. */
  sessionExpired: boolean;
  /** Prefill for Complete Profile after a new Singpass sign-up. */
  singpassPrefill: { displayName: string } | null;
  login: (phone: string, password: string) => Promise<void>;
  register: (phone: string, password: string) => Promise<void>;
  loginWithSingpass: (identity: SingpassIdentity) => Promise<void>;
  logout: () => Promise<void>;
  setProfile: (p: UserProfile) => void;
  hasRole: (r: UserRole) => boolean;
  /** Call on any user interaction to keep the session alive. */
  touch: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [singpassPrefill, setSingpassPrefill] = useState<AuthValue['singpassPrefill']>(null);
  const lastActive = useRef(0); // set by touch() when a session begins
  const lastPersisted = useRef(0);

  const touch = useCallback(() => {
    const t = Date.now();
    lastActive.current = t;
    if (t - lastPersisted.current > PERSIST_THROTTLE_MS) {
      lastPersisted.current = t;
      writeJSON(LAST_ACTIVE_KEY, t);
    }
  }, []);

  const begin = useCallback(
    (s: Session) => {
      setSessionExpired(false);
      lastPersisted.current = 0;
      touch();
      setSession(s);
    },
    [touch],
  );

  const endSession = useCallback(async (expired: boolean) => {
    await authService.logout();
    setSingpassPrefill(null);
    setSessionExpired(expired);
    setSession(null);
  }, []);

  // Restore a persisted session on launch, unless it has already timed out.
  useEffect(() => {
    (async () => {
      const [restored, last] = await Promise.all([
        authService.restore(),
        readJSON<number>(LAST_ACTIVE_KEY),
      ]);
      if (restored && last && Date.now() - last > SESSION_TIMEOUT_MS) {
        await endSession(true);
      } else if (restored) {
        begin(restored);
      }
      setLoading(false);
    })();
  }, [begin, endSession]);

  // Inactivity watchdog: periodic check plus a check when the app returns to the foreground.
  useEffect(() => {
    if (!session) return;
    const check = () => {
      if (Date.now() - lastActive.current > SESSION_TIMEOUT_MS) endSession(true);
    };
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [session, endSession]);

  const value = useMemo<AuthValue>(() => {
    const status: AuthStatus = loading
      ? 'loading'
      : !session
        ? 'guest'
        : !session.profile
          ? 'onboarding'
          : 'ready';
    return {
      status,
      session,
      sessionExpired,
      singpassPrefill,
      touch,
      login: async (phone, password) => begin(await authService.login(phone, password)),
      register: async (phone, password) => begin(await authService.register(phone, password)),
      loginWithSingpass: async (identity) => {
        const { session: s, isNew } = await authService.loginWithSingpass(identity);
        setSingpassPrefill(isNew ? { displayName: identity.name } : null);
        begin(s);
      },
      logout: () => endSession(false),
      setProfile: (profile) => setSession((s) => (s ? { ...s, profile } : s)),
      hasRole: (r) => hasRole(session?.account, r),
    };
  }, [loading, session, sessionExpired, singpassPrefill, touch, begin, endSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
