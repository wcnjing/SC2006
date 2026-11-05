import type { ActivityFilters } from '@communitylink/shared';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  ChipGroup,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  ScreenHeader,
  Select,
  TextField,
} from '@/components/ui';
import {
  ACCESSIBILITY_TAGS,
  CATEGORIES,
  findNeighbourhood,
  NEIGHBOURHOODS,
} from '@/config/catalog';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/SettingsContext';
import { ActivityRow } from '@/features/activities/ActivityRow';
import type { TranslationKey } from '@/i18n/en';
import { distanceKm, hasCoordinates } from '@/lib/geo';
import { activityService, errorMessageKey } from '@/services';
import { colors, spacing } from '@/theme/tokens';
import type { Activity } from '@/types/models';

const ANY = 'any';
const DISTANCES = ['1', '3', '5'] as const;
const DATES = ['today', 'week', 'month'] as const;
type DateRange = (typeof DATES)[number];
const DATE_DAYS: Record<DateRange, number> = { today: 0, week: 6, month: 29 };
const DATE_LABEL: Record<DateRange, TranslationKey> = {
  today: 'search.dateToday',
  week: 'search.dateWeek',
  month: 'search.dateMonth',
};

type Filters = {
  hood: string;
  distance: string;
  category: string;
  date: string;
  access: string[];
  environment: string;
};
const NO_FILTERS: Filters = {
  hood: ANY,
  distance: ANY,
  category: ANY,
  date: ANY,
  access: [],
  environment: ANY,
};

/** YYYY-MM-DD in Singapore, `days` from today (P2's filters compare SG dates). */
const sgDate = (days: number) =>
  new Date(Date.now() + 8 * 3600_000 + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Search and filter activities (FR 4.1, 4.2; UC SearchActivity / FilterActivity).
 * Results update as soon as a filter changes (FR 4.2.7); typing waits 300 ms.
 * Distance is measured from the centre of the user's neighbourhood (plan:
 * "simple distance first"; device GPS comes with P4's map work).
 */
export default function SearchActivitiesScreen() {
  const t = useT();
  const { session } = useAuth();
  const home = findNeighbourhood(session?.profile?.neighbourhoodId);

  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [state, setState] = useState<{ data?: Activity[]; error?: unknown; loading: boolean }>({
    loading: true,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(keyword), 300);
    return () => clearTimeout(id);
  }, [keyword]);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const activeCount = Object.entries(filters).filter(([k, v]) =>
    Array.isArray(v) ? v.length > 0 : v !== NO_FILTERS[k as keyof Filters],
  ).length;

  useEffect(() => {
    const query: ActivityFilters = { keyword: debounced.trim() || undefined };
    if (filters.hood !== ANY) query.neighbourhoodId = findNeighbourhood(filters.hood)?.dbId;
    if (filters.category !== ANY) query.category = filters.category;
    if (filters.date !== ANY) {
      query.dateFrom = sgDate(0);
      query.dateTo = sgDate(DATE_DAYS[filters.date as DateRange]);
    }
    if (filters.access.length) query.accessibility = filters.access;
    if (filters.environment !== ANY)
      query.environment = filters.environment as 'indoor' | 'outdoor';
    if (filters.distance !== ANY && home)
      query.distance = { origin: home, maxKm: Number(filters.distance) };

    let stale = false;
    activityService.listActivities(query).then(
      (data) => {
        if (stale) return;
        setState({ data, loading: false });
        AccessibilityInfo.announceForAccessibility(t('search.count', { count: data.length }));
      },
      (error) => !stale && setState({ error, loading: false }),
    );
    return () => {
      stale = true;
    };
    // t only changes with the language; re-searching then is harmless but not needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, filters, home, attempt]);

  const any = { value: ANY, label: t('search.any') };
  const km = (a: Activity) => (home && hasCoordinates(a) ? distanceKm(home, a) : null);

  return (
    <Screen header={<ScreenHeader title={t('search.title')} />} contentStyle={styles.content}>
      <TextField
        label={t('search.title')}
        placeholder={t('home.search')}
        leftIcon="search"
        value={keyword}
        onChangeText={setKeyword}
        autoFocus
        returnKeyType="search"
        accessibilityRole="search"
      />

      <View style={styles.filterBar}>
        <Button
          label={
            activeCount ? t('search.filtersCount', { count: activeCount }) : t('search.filters')
          }
          icon="options-outline"
          variant="outline"
          size="sm"
          accessibilityState={{ expanded: showFilters }}
          onPress={() => setShowFilters((v) => !v)}
        />
        {activeCount > 0 && (
          <Button
            label={t('search.clear')}
            variant="ghost"
            size="sm"
            onPress={() => setFilters(NO_FILTERS)}
          />
        )}
      </View>

      {showFilters && (
        <View style={styles.filters}>
          <Select
            label={t('profile.neighbourhoodLabel')}
            value={filters.hood}
            onChange={(v) => set('hood', v)}
            options={[
              any,
              ...NEIGHBOURHOODS.filter((n) => n.enabled).map((n) => ({
                value: n.id,
                label: t(n.labelKey as TranslationKey),
              })),
            ]}
          />
          {home && (
            <>
              <AppText variant="label">
                {t('search.distance', { place: t(home.labelKey as TranslationKey) })}
              </AppText>
              <ChipGroup
                accessibilityLabel={t('search.distance', {
                  place: t(home.labelKey as TranslationKey),
                })}
                value={filters.distance}
                onChange={(v) => set('distance', v as string)}
                options={[
                  any,
                  ...DISTANCES.map((d) => ({ value: d, label: t('search.withinKm', { km: d }) })),
                ]}
              />
            </>
          )}
          <Select
            label={t('search.category')}
            value={filters.category}
            onChange={(v) => set('category', v)}
            options={[
              any,
              ...CATEGORIES.filter((c) => c.enabled).map((c) => ({
                value: c.id,
                label: t(c.labelKey as TranslationKey),
              })),
            ]}
          />
          <AppText variant="label">{t('search.date')}</AppText>
          <ChipGroup
            accessibilityLabel={t('search.date')}
            value={filters.date}
            onChange={(v) => set('date', v as string)}
            options={[any, ...DATES.map((d) => ({ value: d, label: t(DATE_LABEL[d]) }))]}
          />
          <AppText variant="label">{t('search.setting')}</AppText>
          <ChipGroup
            accessibilityLabel={t('search.setting')}
            value={filters.environment}
            onChange={(v) => set('environment', v as string)}
            options={[
              any,
              { value: 'indoor', label: t('activity.indoor') },
              { value: 'outdoor', label: t('activity.outdoor') },
            ]}
          />
          <AppText variant="label">{t('search.accessibility')}</AppText>
          <ChipGroup
            accessibilityLabel={t('search.accessibility')}
            value={filters.access}
            onChange={(v) => set('access', v as string[])}
            options={ACCESSIBILITY_TAGS.filter((a) => a.enabled).map((a) => ({
              value: a.id,
              label: t(a.labelKey as TranslationKey),
            }))}
          />
        </View>
      )}

      {state.error && !state.data ? (
        <ErrorState
          message={t(errorMessageKey(state.error))}
          onRetry={() => {
            setState({ loading: true });
            setAttempt((n) => n + 1);
          }}
        />
      ) : state.loading && !state.data ? (
        <LoadingState />
      ) : state.data && state.data.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title={t('search.emptyTitle')}
          body={t('search.emptyBody')}
          actionLabel={activeCount ? t('search.clear') : undefined}
          onAction={() => setFilters(NO_FILTERS)}
        />
      ) : (
        state.data && (
          <>
            <AppText variant="caption" color={colors.textMuted} accessibilityLiveRegion="polite">
              {t('search.count', { count: state.data.length })}
            </AppText>
            <View accessibilityRole="list" style={styles.results}>
              {state.data.map((a) => (
                <ActivityRow key={a.id} activity={a} distanceKm={km(a)} />
              ))}
            </View>
          </>
        )
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.sm },
  filterBar: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  filters: { gap: spacing.md },
  results: { gap: spacing.lg },
});
