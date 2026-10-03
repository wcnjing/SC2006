import { isSessionExpired, msUntilExpiry } from '@communitylink/shared';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useAuth } from './AuthProvider';

const TIMEOUT_MESSAGE = 'You were logged out after 30 minutes of inactivity.';

// FR 1.2: wrap the app in this. Any touch resets the timer; the session ends
// after 30 minutes (SESSION_TIMEOUT_MS) without one, including time spent in the background.
export function InactivityGuard({ children }: { children: React.ReactNode }) {
  const { session, signOut } = useAuth();
  const lastActiveAt = useRef(Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!session) return;
    timer.current = setTimeout(() => {
      if (isSessionExpired(lastActiveAt.current)) {
        void signOut(TIMEOUT_MESSAGE);
      } else {
        schedule();
      }
    }, msUntilExpiry(lastActiveAt.current));
  }, [session, signOut]);

  const markActive = useCallback(() => {
    lastActiveAt.current = Date.now();
  }, []);

  useEffect(() => {
    markActive();
    schedule();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [session, markActive, schedule]);

  // JS timers pause in the background, so re-check on return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !session) return;
      if (isSessionExpired(lastActiveAt.current)) {
        void signOut(TIMEOUT_MESSAGE);
      } else {
        schedule();
      }
    });
    return () => sub.remove();
  }, [session, signOut, schedule]);

  return (
    <View
      style={styles.fill}
      // Capture phase sees every touch first; returning false lets it through.
      onStartShouldSetResponderCapture={() => {
        markActive();
        return false;
      }}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
