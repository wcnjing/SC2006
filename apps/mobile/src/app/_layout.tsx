import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { InactivityGuard } from '../auth/InactivityGuard';
import { DevAuthScreen } from '../dev/DevAuthScreen';

function AuthenticatedRoutes() {
  const { session, loading } = useAuth();
  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  if (!session) return <DevAuthScreen />;
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'CommunityLink' }} />
      <Stack.Screen name="activities/[id]" options={{ title: 'Activity details' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <InactivityGuard>
        <AuthenticatedRoutes />
      </InactivityGuard>
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
