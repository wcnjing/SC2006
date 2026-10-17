import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  AppHeader,
  AppText,
  Banner,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  Section,
} from '@/components/ui';
import { findNeighbourhood } from '@/config/catalog';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { ActivityCard } from '@/features/activities/ActivityCard';
import { recommendationReason } from '@/features/activities/reasons';
import type { TranslationKey } from '@/i18n/en';
import { distanceKm, hasCoordinates } from '@/lib/geo';
import { useAsync } from '@/lib/useAsync';
import { activityService, errorMessageKey } from '@/services';
import { colors, MIN_TOUCH, radii, spacing } from '@/theme/tokens';

/** How many recommendations Home shows; the rest are in Discover. */
const TOP_RECOMMENDATIONS = 3;
/** "Happening nearby" = upcoming within this radius of the user's neighbourhood, next 7 days. */
const NEARBY_KM = 3;
const NEARBY_DAYS = 7;

function greetingKey(): TranslationKey {
  const h = new Date().getHours();
  return h < 12
    ? 'home.greeting.morning'
    : h < 18
      ? 'home.greeting.afternoon'
      : 'home.greeting.evening';
}

const sgDate = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);

/**
 * Home (mockups 4.B / 4.C left; Dialog Map: entry / loadRecommendations(),
 * do / displayRankedActivities()).
 *  - FR 5.1.5 recommended activities, each with a reason (FR 5.1.6)
 *  - UC ViewRecommendations exception: no interests → ranked by distance and
 *    popularity, with a prompt to add interests
 *  - "Happening nearby": what's on near the user's neighbourhood this week
 */
export default function HomeScreen() {
  const { t } = useSettings();
  const { session } = useAuth();
  const profile = session?.profile;
  const hood = findNeighbourhood(profile?.neighbourhoodId);

  const feed = useAsync(async () => {
    const now = Date.now();
    const [recs, upcoming] = await Promise.all([
      activityService.getRecommendations(),
      hood
        ? activityService.listActivities({
            distance: { origin: hood, maxKm: NEARBY_KM },
            dateTo: sgDate(now + NEARBY_DAYS * 86_400_000),
          })
        : Promise.resolve([]),
    ]);
    const top = recs.recommendations.slice(0, TOP_RECOMMENDATIONS);
    const shown = new Set(top.map((r) => r.activity.id));
    const nearby = upcoming
      .filter((a) => !shown.has(a.id))
      .map((activity) => ({
        activity,
        km: hood && hasCoordinates(activity) ? distanceKm(hood, activity) : null,
      }));
    return { top, personalised: recs.personalised, nearby };
  });

  return (
    <Screen
      inTabs
      header={<AppHeader unread={1} />}
      contentStyle={styles.content}
      refreshing={feed.refreshing}
      onRefresh={feed.refresh}
    >
      <View style={styles.greeting}>
        <AppText variant="h1" heading>
          {t(greetingKey(), { name: profile?.displayName ?? '' })}
        </AppText>
        {hood && (
          <View style={styles.location}>
            <Ionicons name="location" size={18} color={colors.primary} />
            <AppText variant="label" color={colors.textMuted}>
              {t('home.locationLine', { place: t(hood.labelKey as TranslationKey) })}
            </AppText>
          </View>
        )}
      </View>

      {/* Search bar is a button: tapping it opens Search & Filter (Dialog Map: tapSearchBar). */}
      <Pressable
        accessibilityRole="search"
        accessibilityLabel={t('home.search')}
        onPress={() => router.push('/search')}
        style={({ pressed }) => [
          styles.search,
          pressed && { backgroundColor: colors.surfaceMuted },
        ]}
      >
        <Ionicons name="search" size={22} color={colors.textMuted} />
        <AppText color={colors.textSubtle} style={{ flex: 1 }}>
          {t('home.search')}
        </AppText>
        <Ionicons name="options-outline" size={22} color={colors.text} />
      </Pressable>

      {feed.loading && !feed.data ? (
        <LoadingState />
      ) : feed.error && !feed.data ? (
        <ErrorState
          message={t(
            errorMessageKey(feed.error) === 'error.generic'
              ? 'home.loadError'
              : errorMessageKey(feed.error),
          )}
          onRetry={feed.reload}
        />
      ) : (
        feed.data && (
          <>
            <Section title={t('home.recommended')}>
              {!feed.data.personalised && (
                <View style={styles.notice}>
                  <Banner tone="info">{t('home.notPersonalised')}</Banner>
                  <Button
                    label={t('home.addInterests')}
                    icon="add"
                    variant="outline"
                    size="sm"
                    fullWidth={false}
                    style={styles.start}
                    onPress={() => router.push('/edit-profile')}
                  />
                </View>
              )}
              {feed.data.top.length === 0 ? (
                <EmptyState
                  icon="sparkles-outline"
                  title={t('home.recommendedEmpty')}
                  body={t('home.recommendedEmptyBody')}
                  actionLabel={t('home.browseAll')}
                  onAction={() => router.navigate('/discover')}
                />
              ) : (
                feed.data.top.map((rec) => (
                  <ActivityCard
                    key={rec.activity.id}
                    activity={rec.activity}
                    distanceKm={rec.distanceKm}
                    reason={recommendationReason(t, rec, profile)}
                  />
                ))
              )}
            </Section>

            <Section
              title={t('home.nearby')}
              actionLabel={t('home.seeAll')}
              onAction={() => router.navigate('/discover')}
            >
              {feed.data.nearby.length === 0 ? (
                <AppText color={colors.textMuted}>{t('home.nearbyEmpty')}</AppText>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carousel}
                  style={styles.carouselBleed}
                >
                  {feed.data.nearby.map(({ activity, km }) => (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      distanceKm={km}
                      size="compact"
                    />
                  ))}
                </ScrollView>
              )}
            </Section>
          </>
        )
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.lg },
  greeting: { gap: spacing.xs },
  location: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  notice: { gap: spacing.sm },
  start: { alignSelf: 'flex-start' },
  // Let the carousel run to the screen edge while its first card lines up with the page margin.
  carouselBleed: { marginHorizontal: -spacing.xl },
  carousel: { gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
});
