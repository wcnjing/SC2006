import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useT } from '@/context/SettingsContext';
import { colors, spacing } from '@/theme/tokens';

/**
 * Placeholder brand mark until the real logo file is added. To use the real
 * logo, put it at assets/logo.png and replace the icon View with an <Image>.
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <View
      style={[styles.mark, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons name="people" size={size * 0.62} color={colors.primary} />
    </View>
  );
}

export function Wordmark({ size = 32, large }: { size?: number; large?: boolean }) {
  const t = useT();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="header"
      accessibilityLabel={t('app.name')}
    >
      <LogoMark size={size} />
      <AppText variant={large ? 'display' : 'h2'} color={large ? colors.text : colors.primary}>
        {t('app.name')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
