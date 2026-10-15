import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Tag } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { colors, spacing } from '@/theme/tokens';
import type { Activity } from '@/types/models';

import { openActivity } from './ActivityCard';
import { ActivityImage } from './ActivityImage';
import { formatDistance, formatWhen } from './format';
import { MetaLine } from './MetaLine';

type Props = {
  activity: Activity;
  distanceKm?: number | null;
  /** Badges after the title, e.g. "Going", "Cancelled". */
  badges?: ReactNode;
  /** Extra buttons beside "View details" (Rate, Unsave). */
  actions?: ReactNode;
};

/**
 * List row with a square photo (mockup 4.F My Activities / 4.H weather
 * warning). The whole row is not one big button: "View details" and the
 * extra actions are separate, focusable controls.
 */
export function ActivityRow({ activity, distanceKm, badges, actions }: Props) {
  const { t, language } = useSettings();
  const when = formatWhen(activity, language);
  const distance = formatDistance(t, distanceKm);
  return (
    <View style={styles.row}>
      <ActivityImage category={activity.category} height={104} style={styles.image} />
      <View style={styles.body}>
        <AppText variant="label" numberOfLines={2} accessibilityRole="header">
          {activity.title}
        </AppText>
        {badges && <View style={styles.badges}>{badges}</View>}
        <MetaLine icon="calendar-outline" text={when.full} />
        <MetaLine
          icon="location-outline"
          text={[activity.location_name, distance].filter(Boolean).join(' · ')}
        />
        <View style={styles.actions}>
          <Button
            label={t('myActivities.viewDetails')}
            accessibilityLabel={`${t('myActivities.viewDetails')}: ${activity.title}`}
            size="sm"
            variant="outline"
            fullWidth={false}
            onPress={() => openActivity(activity.id)}
          />
          {actions}
        </View>
      </View>
    </View>
  );
}

export function StatusBadge({ label, tone }: { label: string; tone: 'success' | 'error' }) {
  return (
    <Tag
      label={label}
      tone={tone === 'success' ? 'nature' : 'primary'}
      icon={tone === 'success' ? 'checkmark-circle' : 'close-circle'}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  image: { width: 104 },
  body: { flex: 1, gap: spacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
});
