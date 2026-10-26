import { hasRole, listMyConcludedActivities } from '@communitylink/shared';
import { Link } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Button, FlatList, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useActivityQuery } from '../../activities/useActivityQuery';
import { supabase } from '../../lib/supabase';

export default function JoinedActivityReviews() {
  const { session, profile } = useAuth();
  if (!session || !profile || profile.id !== session.user.id || !hasRole(profile, 'resident'))
    return <Text accessibilityRole="alert">An active resident account is required.</Text>;
  return <ConcludedActivities key={profile.id} />;
}
function ConcludedActivities() {
  const load = useCallback(() => listMyConcludedActivities(supabase), []);
  const { data, error, loading, retry } = useActivityQuery(load);
  return (
    <View style={{ flex: 1, padding: 24, gap: 12 }}>
      <Link href="/">Back to activities</Link>
      <Text accessibilityRole="header">Joined activities to review</Text>
      <Text>Open a concluded activity to rate it or read its reviews.</Text>
      <Button title="Refresh concluded activities" onPress={retry} disabled={loading} />
      {loading ? (
        <ActivityIndicator accessibilityLabel="Loading concluded activities" />
      ) : error ? (
        <Text accessibilityRole="alert">{error}</Text>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text>No concluded joined activities available to review.</Text>}
          renderItem={({ item }) => (
            <View style={{ paddingVertical: 12, gap: 4 }}>
              <Link href={{ pathname: '/activities/[id]', params: { id: item.id } }}>
                {item.title}
              </Link>
              <Text>Ended: {new Date(item.ends_at).toLocaleString()}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
