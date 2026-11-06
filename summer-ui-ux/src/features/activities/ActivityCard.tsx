import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Banner, Card, Tag, toneForCategory } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { colors, spacing } from '@/theme/tokens';
import type { Activity } from '@/types/models';

import { ActivityImage } from './ActivityImage';
import { ActivityTags } from './ActivityTags';
import { categoryLabel, formatDistance, formatWhen } from './format';
import { MetaLine } from './MetaLine';

export const openActivity = (id: string) =>
  router.push({ pathname: '/activity/[id]', params: { id } });

type Props = {
  activity: Activity;
  distanceKm?: number | null;
  /** FR 5.1.6 "why" strip, shown on recommendations. */
  reason?: string;
  /** 'large' = Home "Recommended for you"; 'compact' = horizontal "Happening nearby". */
  size?: 'large' | 'compact';
  /** Extra line under the meta (e.g. "3 spots left"). */
  footer?: ReactNode;
};

/** Tappable activity card (mockups 4.B / 4.C). Opens Activity details. */
export function ActivityCard({ activity, distanceKm, reason, size = 'large', footer }: Props) {
  const { t, language } = useSettings();
  const when = formatWhen(activity, language);
  const distance = formatDistance(t, distanceKm);
  const compact = size === 'compact';
  const label = t('activity.openA11y', {
    title: activity.title,
    when: when.full,
    where: [activity.location_name, distance].filter(Boolean).join(', '),
  });

  return (
    <Card
      padded={false}
      onPress={() => openActivity(activity.id)}
      accessibilityLabel={reason ? `${label} ${reason}` : label}
      style={compact && styles.compact}
    >
      <ActivityImage category={activity.category} height={compact ? 110 : 170} rounded={false} />
      <View style={[styles.body, compact && styles.bodyCompact]}>
        <View style={styles.topRow}>
          <Tag
            label={categoryLabel(t, activity.category)}
            tone={toneForCategory(activity.category)}
          />
          {distance && !compact && (
            <AppText variant="caption" color={colors.text} style={styles.distance}>
              {distance}
            </AppText>
          )}
        </View>
        <AppText variant={compact ? 'label' : 'h3'} numberOfLines={2}>
          {activity.title}
        </AppText>
        {compact ? (
          <>
            <MetaLine icon="calendar-outline" text={when.date} lines={1} />
            <MetaLine
              icon="location-outline"
              text={[distance, activity.location_name].filter(Boolean).join(' · ')}
              lines={1}
            />
          </>
        ) : (
          <>
            <MetaLine icon="calendar-outline" text={when.full} />
            <MetaLine icon="location-outline" text={activity.location_name} />
            <ActivityTags activity={activity} limit={2} />
          </>
        )}
        {footer}
      </View>
      {reason && (
        <View style={styles.reason}>
          <Banner tone="insight">{reason}</Banner>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  compact: { width: 220 },
  body: { padding: spacing.lg, gap: spacing.sm },
  bodyCompact: { padding: spacing.md, gap: spacing.xs },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  distance: { fontWeight: '700' },
  reason: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
