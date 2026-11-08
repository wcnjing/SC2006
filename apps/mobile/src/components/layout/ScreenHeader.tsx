import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/IconButton';
import { useT } from '@/context/SettingsContext';
import { colors, spacing } from '@/theme/tokens';

type Props = {
  title: string;
  /** Hide the back arrow (e.g. Complete Profile, which has nowhere to go back to). */
  noBack?: boolean;
  onBack?: () => void;
  right?: ReactNode;
};

/**
 * Standard header for every non-tab-root screen: back arrow + dark bold
 * title, left-aligned (team decision; replaces the mockups' centred red titles).
 * Dialog map: "every non-tab screen returns to the screen that opened it via tapBack".
 */
export function ScreenHeader({ title, noBack, onBack, right }: Props) {
  const t = useT();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={styles.bar}>
      {!noBack && (
        <IconButton icon="arrow-back" size={26} label={t('common.back')} onPress={back} />
      )}
      <AppText
        variant="h2"
        heading
        numberOfLines={1}
        style={[styles.title, noBack && { marginLeft: spacing.sm }]}
      >
        {title}
      </AppText>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  title: { flex: 1 },
});
