import { canManageActivity, listMyActivities } from '@communitylink/shared';
import { Link } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Button, FlatList, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useActivityQuery } from '../../activities/useActivityQuery';
import { supabase } from '../../lib/supabase';

export default function MyActivities() {
  const { profile, session } = useAuth();
  if (!canManageActivity(profile, session?.user.id))
    return <Text accessibilityRole="alert">An active organiser account is required.</Text>;
  return <OwnActivities key={profile!.id} />;
}
function OwnActivities() {
  const load = useCallback(() => listMyActivities(supabase), []);
  const { data, error, loading, retry } = useActivityQuery(load);
  return (
    <View style={{ flex: 1, padding: 24, gap: 12 }}>
      <Link href="/">Back to activities</Link>
      <Link href="/activities/create">Create activity</Link>
      <Text accessibilityRole="header">My activities</Text>
      <Button title="Refresh my activities" onPress={retry} disabled={loading} />
      {loading ? (
        <ActivityIndicator accessibilityLabel="Loading my activities" />
      ) : error ? (
        <Text accessibilityRole="alert">{error}</Text>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text>You have not created any activities.</Text>}
          renderItem={({ item }) => (
            <View style={{ paddingVertical: 12, gap: 4 }}>
              <Link href={{ pathname: '/activities/[id]/manage', params: { id: item.id } }}>
                {item.title}
              </Link>
              <Text>
                {item.status} · {new Date(item.starts_at).toLocaleString()}
              </Text>
              <Link href={{ pathname: '/activities/[id]', params: { id: item.id } }}>
                View details
              </Link>
            </View>
          )}
        />
      )}
    </View>
  );
}
