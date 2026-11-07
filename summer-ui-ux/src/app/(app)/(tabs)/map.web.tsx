import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
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

  const mapUrl = useMemo(() => {
    if (!apiKey || !neighbourhood) return null;
    const params = new URLSearchParams({
      key: apiKey,
      center: `${neighbourhood.lat},${neighbourhood.lng}`,
      zoom: '14',
    });
    return `https://www.google.com/maps/embed/v1/view?${params.toString()}`;
  }, [apiKey, neighbourhood]);

  return (
    <Screen inTabs scroll header={<AppHeader />} contentStyle={styles.content}>
      <AppText variant="h1" heading>
        {t('tab.map')}
      </AppText>
      <AppText color={colors.textMuted} style={styles.subtitle}>
        {neighbourhood ? t(neighbourhood.labelKey as never) : t('profile.neighbourhood')}
      </AppText>
      {mapUrl ? (
        createElement('iframe', {
          title: neighbourhood ? `Map of ${t(neighbourhood.labelKey as never)}` : 'Community map',
          src: mapUrl,
          loading: 'lazy',
          referrerPolicy: 'no-referrer-when-downgrade',
          style: styles.map,
        })
      ) : (
        <View style={styles.missingMap}>
          <AppText variant="h3">Map unavailable</AppText>
          <AppText color={colors.textMuted} style={styles.missingText}>
            {!neighbourhood
              ? 'Complete your profile with a neighbourhood to view its map.'
              : 'Set EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY in the root .env file.'}
          </AppText>
        </View>
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
    borderWidth: 0,
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
