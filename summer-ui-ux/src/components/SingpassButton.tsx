import { StyleSheet } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { useT } from '@/context/SettingsContext';
import { colors } from '@/theme/tokens';

/** Outlined "Log in with singpass" button (FR 1.3.1), with the Singpass wordmark colouring. */
export function SingpassButton({ onPress }: { onPress: () => void }) {
  const t = useT();
  return (
    <Button label={t('login.singpassA11y')} variant="outline" onPress={onPress}>
      <AppText variant="button">
        {t('login.singpass')}{' '}
        <AppText variant="button" color={colors.singpass} style={styles.singpass}>
          singpass
        </AppText>
      </AppText>
    </Button>
  );
}

const styles = StyleSheet.create({
  singpass: { fontWeight: '800' },
});
