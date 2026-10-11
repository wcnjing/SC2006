import { canManageActivity, getActivity } from '@communitylink/shared';
import { Link, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Button, ScrollView, Text } from 'react-native';
import { useAuth } from '../../../auth/AuthProvider';
import { ActivityEditor } from '../../../activities/ActivityEditor';
import { useActivityQuery } from '../../../activities/useActivityQuery';
import { supabase } from '../../../lib/supabase';

export default function ManageActivity() {
  const { profile, session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!canManageActivity(profile, session?.user.id))
    return <Text accessibilityRole="alert">An active organiser account is required.</Text>;
  return <OwnedEditor key={`${profile!.id}:${id}`} id={typeof id === 'string' ? id : ''} />;
}
function OwnedEditor({ id }: { id: string }) {
  const { profile, session } = useAuth();
  const load = useCallback(() => getActivity(supabase, id), [id]);
  const { data, loading, error, retry } = useActivityQuery(load);
  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
      <Link href="/activities/manage">Back to my activities</Link>
      <Text accessibilityRole="header">Manage activity</Text>
      {loading ? (
        <ActivityIndicator accessibilityLabel="Loading activity editor" />
      ) : error ? (
        <>
          <Text accessibilityRole="alert">{error}</Text>
          <Button title="Retry activity editor" onPress={retry} />
        </>
      ) : !data ? (
        <Text>Activity not found.</Text>
      ) : !canManageActivity(profile, session?.user.id, data) ? (
        <Text accessibilityRole="alert">You can only manage your own organiser activities.</Text>
      ) : (
        <ActivityEditor key={`${data.id}:${data.updated_at}`} activity={data} />
      )}
    </ScrollView>
  );
}
