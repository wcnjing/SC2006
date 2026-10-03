import { listNeighbourhoods, type Neighbourhood } from '@communitylink/shared';
import { useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';

export function DevProfileScreen() {
  const { profile, signOut } = useAuth();
  const [neighbourhoods, setNeighbourhoods] = useState<Neighbourhood[]>([]);
  const [neighbourhoodError, setNeighbourhoodError] = useState<string | null>(null);

  useEffect(() => {
    listNeighbourhoods(supabase)
      .then(setNeighbourhoods)
      .catch(() => setNeighbourhoodError('Unable to load your neighbourhood.'));
  }, []);

  if (!profile) return null;

  const neighbourhood = neighbourhoods.find(
    (item) => item.id === profile.neighbourhood_id,
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My profile</Text>
        <Button title="Log out" onPress={() => signOut()} />
      </View>
      <View style={styles.card}>
        <Text style={styles.name}>{profile.display_name}</Text>
        <Text style={styles.value}>
          Neighbourhood:{' '}
          {neighbourhoodError ??
            neighbourhood?.name ??
            (profile.neighbourhood_id ? 'Loading...' : 'Not set')}
        </Text>
        <Text style={styles.value}>
          Interests: {profile.interests.length ? profile.interests.join(', ') : 'Not set'}
        </Text>
        <Text style={styles.value}>
          Accessibility needs:{' '}
          {profile.accessibility_needs.length ? profile.accessibility_needs.join(', ') : 'None'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  container: { flexGrow: 1, padding: 24, paddingTop: 64, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '700', color: '#000000' },
  card: { gap: 10, padding: 16, borderRadius: 8, backgroundColor: '#f2f2f2' },
  name: { fontSize: 22, fontWeight: '600', color: '#000000' },
  value: { color: '#000000' },
});
