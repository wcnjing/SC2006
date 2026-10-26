import { canManageActivity, type Activity } from '@communitylink/shared';
import { Link } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';

export function OrganiserActivityLinks({ activity }: { activity?: Activity }) {
  const { profile, session } = useAuth();
  if (!canManageActivity(profile, session?.user.id, activity)) return null;
  return (
    <View style={{ gap: 8 }}>
      {activity ? (
        <Link href={{ pathname: '/activities/[id]/manage', params: { id: activity.id } }}>
          Manage this activity
        </Link>
      ) : (
        <>
          <Link href="/activities/create">Create activity</Link>
          <Link href="/activities/manage">My activities</Link>
        </>
      )}
    </View>
  );
}
