// Temporary authenticated home until the shared app shell lands.
// Replace with the real tab navigation once Summer's shell lands.
import { Button, StyleSheet, Text, View } from 'react-native';
import { RoleGate } from '../auth/RoleGate';
import { useAuth } from '../auth/AuthProvider';
import { ActivityList } from '../activities/ActivityList';

export function DevHomeScreen() {
  const { profile, signOut } = useAuth();
  if (!profile) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hi, {profile.display_name}</Text>
      <Text>
        Role: {profile.role} · Onboarded: {profile.onboarded ? 'yes' : 'no'}
      </Text>
      <RoleGate permission="activity:create">
        <Text style={styles.badge}>You can create activities</Text>
      </RoleGate>
      <RoleGate roles={['admin']}>
        <Text style={styles.badge}>Admin tools available</Text>
      </RoleGate>

      <Text style={styles.heading}>Upcoming activities</Text>
      <ActivityList />
      <Button title="Log out" onPress={() => signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 64, gap: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  badge: { backgroundColor: '#e6f4fe', padding: 8, borderRadius: 6 },
});
