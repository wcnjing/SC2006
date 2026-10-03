import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Button, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { InactivityGuard } from './src/auth/InactivityGuard';
import { DevAuthScreen } from './src/dev/DevAuthScreen';
import { DevHomeScreen } from './src/dev/DevHomeScreen';
import { OnboardingScreen } from './src/dev/OnboardingScreen';
import { DevProfileScreen } from './src/dev/DevProfileScreen';

function Root() {
  const { session, profile, loading, justRegistered, refreshProfile, signOut } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'profile'>('home');

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
    <View style={styles.appContainer}>
      <View style={styles.content}>
        {activeTab === 'home' ? (
          <DevHomeScreen
            showOnboardingPrompt={!profile.onboarded}
            onStartOnboarding={() => setShowOnboarding(true)}
          />
        ) : (
          <DevProfileScreen />
        )}
      </View>
      <View style={styles.tabBar}>
        <Pressable style={styles.tab} onPress={() => setActiveTab('home')}>
          <Image
            source={require('./assets/home-icon.png')}
            style={[styles.tabIcon, activeTab !== 'home' && styles.inactiveTabIcon]}
          />
          <Text style={[styles.tabText, activeTab === 'home' && styles.activeTabText]}>Home</Text>
        </Pressable>
        <Pressable style={styles.tab} onPress={() => setActiveTab('profile')}>
          <Image
            source={require('./assets/profile-icon.png')}
            style={[styles.tabIcon, activeTab !== 'profile' && styles.inactiveTabIcon]}
          />
          <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>
            Profile
          </Text>
        </Pressable>
      </View>
    </View>
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
  appContainer: { flex: 1, backgroundColor: '#ffffff' },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#cccccc',
    backgroundColor: '#ffffff',
    paddingBottom: 12,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  tabIcon: { width: 24, height: 24, marginBottom: 4 },
  inactiveTabIcon: { opacity: 0.45 },
  tabText: { color: '#666666', fontSize: 16, fontWeight: '600' },
  activeTabText: { color: '#1565c0' },
});
