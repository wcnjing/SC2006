import { router } from 'expo-router';
import { Linking, Platform, StyleSheet } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { useT } from '@/context/SettingsContext';
import { authService } from '@/services';
import { colors } from '@/theme/tokens';

/**
 * FR 1.3.2: send the user to Singpass. With Xavier's Mockpass bridge
 * configured (Supabase backend), this opens the Mockpass login page, which
 * returns to /mockpass/callback. Otherwise it opens the in-app mock consent screen.
 */
export function openSingpass() {
  const url = authService.singpassStartUrl();
  if (!url) return router.push('/singpass');
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(url);
  else Linking.openURL(url);
}

/** Outlined "Log in with singpass" button (FR 1.3.1), with the Singpass wordmark colouring. */
export function SingpassButton({ onPress = openSingpass }: { onPress?: () => void }) {
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
