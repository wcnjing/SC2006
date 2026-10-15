import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText, type IconName } from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';

/** Icon + text line: date, time, place (mockups 4.B, 4.F). */
export function MetaLine({
  icon,
  text,
  strong,
  lines = 2,
}: {
  icon: IconName;
  text: string;
  strong?: boolean;
  lines?: number;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={colors.textMuted} style={styles.icon} />
      <AppText
        variant={strong ? 'label' : 'caption'}
        color={strong ? colors.text : colors.textMuted}
        numberOfLines={lines}
        style={styles.text}
      >
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs + 2 },
  icon: { marginTop: 1 },
  text: { flex: 1 },
});
