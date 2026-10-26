import { getActivityRecommendations, hasRole } from '@communitylink/shared';
import { Link } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { ActivityButton as Button, ActivityIconButton, activityStyles } from './activityTheme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { requestActivityLocation } from './ActivityDistanceFilter';
import { useActivityQuery } from './useActivityQuery';

export function ActivityRecommendationLink() {
  const { session, profile } = useAuth();
  if (!session || !profile || session.user.id !== profile.id || !hasRole(profile, 'resident'))
    return null;
  return <Link href="/activities/recommendations">Recommended for you</Link>;
}
export function ActivityRecommendations() {
  const { session, profile } = useAuth();
  if (!session || !profile || session.user.id !== profile.id || !hasRole(profile, 'resident'))
    return (
      <Text accessibilityRole="alert">
        An active resident account is required for recommendations.
      </Text>
    );
  return <ResidentRecommendations key={profile.id} />;
}
function ResidentRecommendations() {
  const [deviceLocation, setDeviceLocation] = useState<{ lat: number; lng: number } | undefined>();
  const [locationMessage, setLocationMessage] = useState('');
  const [locating, setLocating] = useState(false);
  const inFlight = useRef(false);
  const load = useCallback(
    () => getActivityRecommendations(supabase, { deviceLocation }),
    [deviceLocation],
  );
  const { data, loading, error, retry } = useActivityQuery(load);
  async function locate() {
    if (inFlight.current) return;
    inFlight.current = true;
    setLocating(true);
    setLocationMessage('');
    try {
      setDeviceLocation(await requestActivityLocation());
      setLocationMessage('Using your current location.');
    } catch (err) {
      setLocationMessage(err instanceof Error ? err.message : 'Unable to get your location.');
    } finally {
      inFlight.current = false;
      setLocating(false);
    }
  }
  return (
    <View style={activityStyles.page}>
      <Link href="/" style={activityStyles.link}>
        Back to activities
      </Link>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Text accessibilityRole="header" style={activityStyles.title}>
          Recommended for you
        </Text>
        <ActivityIconButton
          label="Refresh recommendations"
          icon="refresh"
          onPress={retry}
          disabled={locating}
          busy={loading}
        />
      </View>
      <Text style={activityStyles.body}>Find your next community activity.</Text>
      <Button
        title={locating ? 'Getting location…' : 'Use my current location'}
        onPress={() => {
          void locate();
        }}
        disabled={locating}
      />
      {!!deviceLocation && (
        <Button
          title="Use profile neighbourhood instead"
          onPress={() => {
            setDeviceLocation(undefined);
            setLocationMessage('');
          }}
          disabled={locating}
        />
      )}
      {!!locationMessage && <Text accessibilityLiveRegion="polite">{locationMessage}</Text>}
      {loading ? (
        <ActivityIndicator accessibilityLabel="Generating recommendations" />
      ) : error ? (
        <Text accessibilityRole="alert">{error}</Text>
      ) : (
        data && (
          <>
            <Text style={activityStyles.body}>
              {data.personalised
                ? 'Activities picked for your interests and needs.'
                : 'Explore activities nearby and popular in your community.'}
            </Text>
            {data.origin && (
              <Text style={activityStyles.body}>
                {data.origin.source === 'device'
                  ? 'Near your current location'
                  : `Near ${data.origin.label} (approximate)`}
              </Text>
            )}
            <Text accessibilityLiveRegion="polite">
              {data.recommendations.length}{' '}
              {data.recommendations.length === 1 ? 'recommendation' : 'recommendations'}
            </Text>
            <FlatList
              data={data.recommendations}
              keyExtractor={(item) => item.activity.id}
              ListEmptyComponent={
                <Text>
                  No suitable activities right now. Check back soon for more activities that meet
                  your needs.
                </Text>
              }
              renderItem={({ item }) => (
                <View style={activityStyles.card}>
                  <Link
                    href={{ pathname: '/activities/[id]', params: { id: item.activity.id } }}
                    style={activityStyles.heading}
                  >
                    {item.activity.title}
                  </Link>
                  {!!item.activity.category && (
                    <Text style={activityStyles.badge}>{item.activity.category}</Text>
                  )}
                  <Text style={activityStyles.body}>
                    {item.activity.location_name} ·{' '}
                    {new Date(item.activity.starts_at).toLocaleString()}
                  </Text>
                  {item.distanceKm !== null && (
                    <Text style={activityStyles.body}>
                      {item.distanceKm.toFixed(1)} km away
                      {data.origin?.source === 'neighbourhood' ? ' (approximate)' : ''}
                    </Text>
                  )}
                  {item.reasons
                    .filter(
                      (reason) =>
                        reason.startsWith('Matches your interests:') ||
                        reason.startsWith('Meets all your accessibility requirements:'),
                    )
                    .map((reason) => (
                      <Text style={activityStyles.reason} key={reason}>
                        {reason.replace(
                          'Meets all your accessibility requirements:',
                          'Matches your accessibility needs:',
                        )}
                      </Text>
                    ))}
                  {item.joinedCount > 0 && (
                    <Text style={activityStyles.body}>
                      {item.joinedCount} {item.joinedCount === 1 ? 'person' : 'people'} joined
                    </Text>
                  )}
                </View>
              )}
            />
          </>
        )
      )}
    </View>
  );
}
