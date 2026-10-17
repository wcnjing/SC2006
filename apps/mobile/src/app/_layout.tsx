import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { InactivityGuard } from '../auth/InactivityGuard';
import { DevAuthScreen } from '../dev/DevAuthScreen';
import { DEMO_MODE } from '../lib/runtime';
import { DemoBanner, DemoWelcomeScreen } from '../demo/DemoScreens';

function AuthenticatedRoutes() {
  const { session, loading } = useAuth();
  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  if (!session) return DEMO_MODE ? <DemoWelcomeScreen /> : <DevAuthScreen />;
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'CommunityLink' }} />
      <Stack.Screen name="community" options={{ title: 'Community' }} />
      <Stack.Screen name="post/create" options={{ title: 'Create post' }} />
      <Stack.Screen name="post/[id]/index" options={{ title: 'Post' }} />
      <Stack.Screen name="post/[id]/edit" options={{ title: 'Edit post' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <InactivityGuard>
        <View style={{ flex: 1 }}>
          {DEMO_MODE && <DemoBanner />}
          <AuthenticatedRoutes />
        </View>
      </InactivityGuard>
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
