// TEMPORARY: proves the end-to-end slice (log in -> profile -> read activities).
// Replace with the real tab navigation once Summer's shell lands.
import type { Activity } from '@communitylink/shared';
import { useEffect, useState } from 'react';
import { Button, FlatList, StyleSheet, Text, View } from 'react-native';
import { RoleGate } from '../auth/RoleGate';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';

export function DevHomeScreen() {
  const { profile, signOut } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('activities')
      .select('*')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
      .limit(20)
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setActivities(data);
      });
  }, []);

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
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={activities}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <Text style={styles.item}>
            {item.title} — {item.location_name}
          </Text>
        )}
        ListEmptyComponent={<Text>No activities yet. Run `npm run seed`.</Text>}
      />
      <Button title="Log out" onPress={() => signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 64, gap: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  badge: { backgroundColor: '#e6f4fe', padding: 8, borderRadius: 6 },
  item: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ccc' },
  error: { color: '#b00020' },
});
