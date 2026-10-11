import { canManageActivity } from '@communitylink/shared';
import { Link } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { ActivityEditor } from '../../activities/ActivityEditor';

export default function CreateActivity() {
  const { profile, session } = useAuth();
  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
      <Link href="/">Back to activities</Link>
      <Text accessibilityRole="header">Create activity</Text>
      {canManageActivity(profile, session?.user.id) ? (
        <ActivityEditor key={profile!.id} />
      ) : (
        <Text accessibilityRole="alert">An active organiser account is required.</Text>
      )}
    </ScrollView>
  );
}
