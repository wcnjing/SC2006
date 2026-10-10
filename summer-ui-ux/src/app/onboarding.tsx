import { StyleSheet } from 'react-native';

import { AppText, Button, Screen, ScreenHeader } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { ProfileForm } from '@/features/profile/ProfileForm';
import { useSaveProfile } from '@/features/profile/useSaveProfile';
import { colors, spacing } from '@/theme/tokens';

/**
 * Complete Your Profile (mockup 4.A, right). UC #1-01 CreateProfile, FR 2.1.
 * Reached right after Sign Up, or after a first Singpass login (alternative
 * flow: prefilled with the name Singpass returned).
 * Saving the profile changes the auth status to 'ready', and the root guard opens Home.
 */
export default function OnboardingScreen() {
  const { t } = useSettings();
  const { singpassPrefill, logout } = useAuth();
  const save = useSaveProfile();

  return (
    <Screen
      header={
        <ScreenHeader
          title={t('profile.completeTitle')}
          noBack
          right={
            <Button
              label={t('profile.logout')}
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={logout}
            />
          }
        />
      }
      contentStyle={styles.content}
    >
      <AppText color={colors.textMuted}>{t('profile.completeSubtitle')}</AppText>
      <ProfileForm
        mode="create"
        initial={{ displayName: singpassPrefill?.displayName }}
        submitLabel={t('profile.create')}
        onSubmit={async (v) => {
          await save(v);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
});
