import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { router, useFocusEffect } from 'expo-router';
import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/layout/AppHeader';
import { AppText, ErrorState, LoadingState, Screen } from '@/components/ui';
import { findNeighbourhood } from '@/config/catalog';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { activityService } from '@/services';
import { colors, radii, spacing } from '@/theme/tokens';
import type { Activity } from '@/types/models';

export default function WebMapScreen() {
  const { t } = useSettings();
  const { session } = useAuth();
  const neighbourhood = findNeighbourhood(session?.profile?.neighbourhoodId);
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY;
  const mapElement = useRef<HTMLDivElement | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await activityService.listActivities();
      setActivities(rows.filter((activity) => activity.lat != null && activity.lng != null));
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadActivities();
    }, [loadActivities]),
  );

  useEffect(() => {
    if (!apiKey || !mapElement.current || activities.length === 0) return;
    let cancelled = false;
    setOptions({ key: apiKey, v: 'weekly' });
    void Promise.all([importLibrary('maps'), importLibrary('marker')])
      .then(([{ Map }, { AdvancedMarkerElement }]) => {
        if (cancelled || !mapElement.current) return;

        const center = neighbourhood
          ? { lat: neighbourhood.lat, lng: neighbourhood.lng }
          : { lat: 1.3521, lng: 103.8198 };
        const map = new Map(mapElement.current, {
          center,
          zoom: neighbourhood ? 14 : 11,
          mapId: 'DEMO_MAP_ID',
        });

        for (const activity of activities) {
          const marker = new AdvancedMarkerElement({
            map,
            position: { lat: activity.lat!, lng: activity.lng! },
            title: activity.title,
          });
          marker.addListener('click', () => router.push(`/activity/${activity.id}`));
        }
      })
      .catch(setError);

    return () => {
      cancelled = true;
    };
  }, [activities, apiKey, neighbourhood]);

  return (
    <Screen inTabs scroll header={<AppHeader />} contentStyle={styles.content}>
      <AppText variant="h1" heading>
        {t('tab.map')}
      </AppText>
      <AppText color={colors.textMuted} style={styles.subtitle}>
        {neighbourhood ? t(neighbourhood.labelKey as never) : t('profile.neighbourhood')}
      </AppText>
      {!apiKey ? (
        <View style={styles.missingMap}>
          <AppText variant="h3">Map unavailable</AppText>
          <AppText color={colors.textMuted} style={styles.missingText}>
            Set EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY in the root .env file.
          </AppText>
        </View>
      ) : (
        createElement('div', { ref: mapElement, style: styles.map })
      )}
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
  map: {
    width: '100%',
    height: 420,
    borderRadius: radii.lg,
  },
  missingMap: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
  },
  missingText: { marginTop: spacing.sm, textAlign: 'center' },
  caption: { marginTop: spacing.md },
});
