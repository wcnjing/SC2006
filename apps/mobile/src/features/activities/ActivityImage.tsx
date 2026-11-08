import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { IconName } from '@/components/ui';
import { CATEGORY_ICONS, CATEGORY_IMAGES } from '@/config/catalog';
import { colors, radii } from '@/theme/tokens';

import { toneForCategory } from '@/components/ui';

const FALLBACK_BG: Record<string, string> = {
  nature: colors.tagNature.bg,
  sports: colors.tagSports.bg,
  arts: colors.tagArts.bg,
};

type Props = {
  category: string;
  /** Image height; width fills the parent unless `style` sets it. */
  height: number;
  rounded?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Activity photo. Decorative (hidden from screen readers): every card that
 * uses it already speaks the title, so the photo adds nothing for them.
 * Falls back to a category-coloured icon tile when there is no image or it
 * fails to load (offline, blocked CDN).
 */
export function ActivityImage({ category, height, rounded = true, style }: Props) {
  const [failed, setFailed] = useState(false);
  const uri = CATEGORY_IMAGES[category];
  const frame = [styles.frame, { height }, rounded && styles.rounded, style];

  if (!uri || failed) {
    const tone = toneForCategory(category);
    return (
      <View
        style={[
          ...frame,
          styles.fallback,
          { backgroundColor: FALLBACK_BG[tone] ?? colors.surfaceMuted },
        ]}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <Ionicons
          name={(CATEGORY_ICONS[category] ?? 'calendar-outline') as IconName}
          size={Math.min(56, height / 2.5)}
          color={colors.textMuted}
        />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={frame as never}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessible={false}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', backgroundColor: colors.surfaceMuted },
  rounded: { borderRadius: radii.lg, overflow: 'hidden' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
