import { StyleSheet, View } from 'react-native';

import { Tag } from '@/components/ui';
import { useT } from '@/context/SettingsContext';
import type { Activity } from '@/types/models';

import { accessLabel } from './format';

const ACCESS_ICONS: Record<
  string,
  'accessibility-outline' | 'ear-outline' | 'eye-outline' | 'walk-outline' | 'people-outline'
> = {
  'wheelchair-access': 'accessibility-outline',
  'elderly-friendly': 'people-outline',
  'hearing-support': 'ear-outline',
  'visual-support': 'eye-outline',
  'low-intensity': 'walk-outline',
};

/**
 * Accessibility features + indoor/outdoor (FR 3.1.7), as in mockups 4.B/4.C.
 * `limit` keeps small cards to one line; the detail screen shows all.
 */
export function ActivityTags({
  activity,
  limit,
}: {
  activity: Pick<Activity, 'accessibility_features' | 'is_outdoor'>;
  limit?: number;
}) {
  const t = useT();
  const access = limit
    ? activity.accessibility_features.slice(0, limit)
    : activity.accessibility_features;
  return (
    <View style={styles.row}>
      {access.map((id) => (
        <Tag
          key={id}
          label={accessLabel(t, id)}
          tone="access"
          icon={ACCESS_ICONS[id] ?? 'accessibility-outline'}
        />
      ))}
      <Tag
        label={t(activity.is_outdoor ? 'activity.outdoor' : 'activity.indoor')}
        tone="neutral"
        icon={activity.is_outdoor ? 'sunny-outline' : 'home-outline'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
