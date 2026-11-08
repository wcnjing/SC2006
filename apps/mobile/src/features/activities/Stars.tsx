import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/context/SettingsContext';
import { colors } from '@/theme/tokens';

/** Read-only 0–5 star display, rounded to the nearest half. Spoken as "4 out of 5 stars". */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const t = useT();
  const rounded = Math.round(value * 2) / 2;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('detail.stars', { count: rounded })}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={rounded >= i ? 'star' : rounded >= i - 0.5 ? 'star-half' : 'star-outline'}
          size={size}
          color={colors.star}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 1 } });
