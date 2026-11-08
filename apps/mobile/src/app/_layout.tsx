import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/ui';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SettingsProvider, useSettings } from '@/context/SettingsContext';
import { colors } from '@/theme/tokens';

/**
 * Dialog Map 0: Application lifecycle and role dispatch.
 *
 *   guest      → (auth): Login, Sign Up, Singpass
 *   onboarding → Complete Your Profile (new account, no profile yet)
 *   ready      → (app): 5-tab shell plus all pushed screens; role-gated
 *                Organiser / Admin areas are checked in their own layouts
 *
 * Guards are client-side only. The Supabase row-level policies (P1) are the real access control.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootStack />
        </AuthProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const { status, touch } = useAuth();
  const { ready, reduceMotion } = useSettings();

  // Keyboard use on web also counts as activity for the session timeout.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.addEventListener('keydown', touch);
    return () => document.removeEventListener('keydown', touch);
  }, [touch]);

  if (status === 'loading' || !ready) {
    return (
      <View style={styles.splash} accessibilityLabel="Loading CommunityLink">
        <LogoMark size={72} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={styles.flex}
      // Any touch resets the inactivity timer; returning false lets the touch continue as normal.
      onStartShouldSetResponderCapture={() => {
        touch();
        return false;
      }}
    >
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: reduceMotion ? 'none' : 'default',
        }}
      >
        <Stack.Protected guard={status === 'guest'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'onboarding'}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'ready'}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: colors.background,
  },
});
