import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AppHeader } from '@/components/layout/AppHeader';
import { AppText, ErrorState, LoadingState, Screen } from '@/components/ui';
import { findNeighbourhood } from '@/config/catalog';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { activityService } from '@/services';
import { colors, radii, spacing } from '@/theme/tokens';
import type { Activity } from '@/types/models';

const SINGAPORE_REGION: Region = {
  latitude: 1.3521,
  longitude: 103.8198,
  latitudeDelta: 0.35,
  longitudeDelta: 0.35,
};

export default function MapScreen() {
  const { t } = useSettings();
  const { session } = useAuth();
  const neighbourhood = findNeighbourhood(session?.profile?.neighbourhoodId);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await activityService.listActivities(
        neighbourhood ? { neighbourhoodId: neighbourhood.dbId } : undefined,
      );
      setActivities(rows.filter((activity) => activity.lat != null && activity.lng != null));
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  }, [neighbourhood?.dbId]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const region = useMemo<Region>(
    () =>
      neighbourhood
        ? {
            latitude: neighbourhood.lat,
            longitude: neighbourhood.lng,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          }
        : SINGAPORE_REGION,
    [neighbourhood],
  );

  return (
    <Screen inTabs scroll={false} header={<AppHeader />} contentStyle={styles.content}>
      <AppText variant="h1" heading>
        {t('tab.map')}
      </AppText>
      <AppText color={colors.textMuted} style={styles.subtitle}>
        {neighbourhood ? t(neighbourhood.labelKey as never) : t('profile.neighbourhood')}
      </AppText>
      <View style={styles.mapFrame}>
        <MapView
          accessibilityLabel={
            neighbourhood
              ? `Activities near ${t(neighbourhood.labelKey as never)}`
              : 'Community activities in Singapore'
          }
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          showsUserLocation={false}
          showsMyLocationButton={false}
        >
          {activities.map((activity) => (
            <Marker
              key={activity.id}
              coordinate={{ latitude: activity.lat!, longitude: activity.lng! }}
              title={activity.title}
              description={activity.location_name}
              onPress={() => router.push(`/activity/${activity.id}`)}
            />
          ))}
        </MapView>
      </View>
      {loading && <LoadingState />}
      {!loading && Boolean(error) && (
        <ErrorState message={t('error.generic')} onRetry={() => void loadActivities()} />
      )}
      {!loading && !error && (
        <AppText color={colors.textMuted} style={styles.caption}>
          {activities.length === 0
            ? 'No upcoming activities with map locations nearby yet.'
            : `${activities.length} upcoming activit${activities.length === 1 ? 'y' : 'ies'} nearby`}
        </AppText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.lg },
  subtitle: { marginTop: spacing.xs, marginBottom: spacing.md },
  mapFrame: {
    height: 420,
    overflow: 'hidden',
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
  },
  caption: { marginTop: spacing.md },
});
