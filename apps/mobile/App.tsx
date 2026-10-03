import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { InactivityGuard } from './src/auth/InactivityGuard';
import { DevAuthScreen } from './src/dev/DevAuthScreen';
import { DevHomeScreen } from './src/dev/DevHomeScreen';
import { OnboardingScreen } from './src/dev/OnboardingScreen';

function Root() {
  const { session, profile, loading, justRegistered, refreshProfile, signOut } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  // Summer: swap these for the real navigator (auth stack vs. main tabs).
  if (!session) return <DevAuthScreen />;
  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Unable to load your profile.</Text>
        <Button title="Try again" onPress={refreshProfile} />
        <Button title="Log out" onPress={() => signOut()} />
      </View>
    );
  }
  if (showOnboarding) {
    return <OnboardingScreen onComplete={() => setShowOnboarding(false)} />;
  }
  if (justRegistered) {
    return <OnboardingScreen onComplete={() => setShowOnboarding(false)} />;
  }
  return (
    <DevHomeScreen
      showOnboardingPrompt={!profile?.onboarded}
      onStartOnboarding={() => setShowOnboarding(true)}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <InactivityGuard>
        <Root />
      </InactivityGuard>
      <StatusBar style="dark" />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  error: { color: '#b00020', marginBottom: 12 },
});
