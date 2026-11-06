import { getActivity, getActivityOrganiserName, type Activity } from '@communitylink/shared';
import { Link, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useActivityQuery } from '../../activities/useActivityQuery';
import { OrganiserActivityLinks } from '../../activities/OrganiserActivityLinks';
import { ActivityRatings } from '../../activities/ActivityRatings';
import { ActivityActions } from '../../activities/ActivityActions';
import { ActivityButton as Button, activityStyles } from '../../activities/activityTheme';
import { supabase } from '../../lib/supabase';

function ActivityOrganiser({ activity }: { activity: Activity }) {
  const load = useCallback(
    function loadOrganiser() {
      return getActivityOrganiserName(supabase, activity);
    },
    [activity],
  );
  const { data: name, loading, error } = useActivityQuery(load);
  return (
    <Text style={activityStyles.body} accessibilityLiveRegion="polite">
      Organiser:{' '}
      {loading
        ? 'Loading organiser…'
        : !error && name
          ? name
          : 'Organiser information unavailable.'}
    </Text>
  );
}

export default function ActivityDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback(() => getActivity(supabase, typeof id === 'string' ? id : ''), [id]);
  const { data: activity, loading, error, retry } = useActivityQuery(load);
  return (
    <ScrollView contentContainerStyle={activityStyles.page}>
      <Link href="/" style={activityStyles.link}>
        Back to activities
      </Link>
      {loading ? (
        <ActivityIndicator accessibilityLabel="Loading activity details" />
      ) : error ? (
        <>
          <Text accessibilityRole="alert">{error}</Text>
          <Button title="Retry details" onPress={retry} />
        </>
      ) : !activity ? (
        <Text>Activity not found or no longer available.</Text>
      ) : (
        <>
          <View style={activityStyles.card}>
            <ActivityActions activity={activity} onRefresh={retry}>
              <Text accessibilityRole="header" style={activityStyles.title}>
                {activity.title}
              </Text>
              <View style={activityStyles.row}>
                <Text style={activityStyles.badge}>{activity.category}</Text>
                <Text style={activityStyles.badge}>
                  {activity.is_outdoor ? 'Outdoor' : 'Indoor'}
                </Text>
              </View>
              <ActivityOrganiser activity={activity} />
              <Text style={activityStyles.body}>{activity.description}</Text>
            </ActivityActions>
          </View>
          <OrganiserActivityLinks activity={activity} />
          <View style={activityStyles.card}>
            <Text accessibilityRole="header" style={activityStyles.heading}>
              When and where
            </Text>
            {activity.status !== 'scheduled' && (
              <Text>{activity.status === 'cancelled' ? 'Cancelled' : 'Completed'}</Text>
            )}
            {activity.cancelled_reason && (
              <Text>Cancellation reason: {activity.cancelled_reason}</Text>
            )}
            <Text>Starts: {new Date(activity.starts_at).toLocaleString()}</Text>
            <Text>Ends: {new Date(activity.ends_at).toLocaleString()}</Text>
            <Text>Location: {activity.location_name}</Text>
            {activity.address && <Text>Address: {activity.address}</Text>}
          </View>
          <View style={activityStyles.card}>
            <Text accessibilityRole="header" style={activityStyles.heading}>
              Activity information
            </Text>
            <Text>
              Cost:{' '}
              {activity.cost_cents === 0 ? 'Free' : `SGD ${(activity.cost_cents / 100).toFixed(2)}`}
            </Text>
            <Text>Capacity: {activity.capacity ?? 'Not specified'}</Text>
            <Text>Setting: {activity.is_outdoor ? 'Outdoor' : 'Indoor'}</Text>
            <Text>
              Accessibility: {activity.accessibility_features.join(', ') || 'Not specified'}
            </Text>
            {activity.tags.length > 0 && <Text>Tags: {activity.tags.join(', ')}</Text>}
          </View>
          <View style={activityStyles.card}>
            <ActivityRatings activityId={activity.id} combinedRefresh />
          </View>
        </>
      )}
    </ScrollView>
  );
}
