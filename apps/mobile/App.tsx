import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { InactivityGuard } from './src/auth/InactivityGuard';
import { DevAuthScreen } from './src/dev/DevAuthScreen';
import { DevHomeScreen } from './src/dev/DevHomeScreen';

function Root() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  // Summer: swap these for the real navigator (auth stack vs. main tabs).
  return session ? <DevHomeScreen /> : <DevAuthScreen />;
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
});
