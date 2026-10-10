import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import type { IconName } from './Button';

export type TagTone = 'nature' | 'sports' | 'arts' | 'access' | 'neutral' | 'primary';

const TONES: Record<TagTone, { bg: string; fg: string }> = {
  nature: colors.tagNature,
  sports: colors.tagSports,
  arts: colors.tagArts,
  access: colors.tagAccess,
  neutral: colors.tagNeutral,
  primary: { bg: colors.primarySoft, fg: colors.primaryPressed },
};

/** Small, non-interactive badge: category, "Outdoor", "Wheelchair Accessible", "Verified Organiser". */
export function Tag({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: TagTone;
  icon?: IconName;
}) {
  const c = TONES[tone];
  return (
    <View style={[styles.tag, { backgroundColor: c.bg }]}>
      {icon && <Ionicons name={icon} size={14} color={c.fg} />}
      <AppText variant="caption" color={c.fg} style={styles.text}>
        {label}
      </AppText>
    </View>
  );
}

/** Maps an activity category id to a tag tone. Unknown categories are neutral. */
export const toneForCategory = (categoryId: string): TagTone =>
  (
    ({ nature: 'nature', sports: 'sports', wellness: 'sports', arts: 'arts' }) as Record<
      string,
      TagTone
    >
  )[categoryId] ?? 'neutral';

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 1,
    borderRadius: radii.sm,
  },
  text: { fontWeight: '600' },
});
