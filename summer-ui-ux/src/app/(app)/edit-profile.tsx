import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Screen, ScreenHeader } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { ProfileForm } from '@/features/profile/ProfileForm';
import { useSaveProfile } from '@/features/profile/useSaveProfile';
import { spacing } from '@/theme/tokens';

/** Edit Profile. UC #1-02 EditProfile, FR 2.2 (saved after confirmation via the Save button, FR 2.2.5). */
export default function EditProfileScreen() {
  const { t } = useSettings();
  const { session } = useAuth();
  const save = useSaveProfile();
  const profile = session?.profile;
  if (!profile) return null;

  return (
    <Screen header={<ScreenHeader title={t('profile.editTitle')} />} contentStyle={styles.content}>
      <ProfileForm
        mode="edit"
        initial={profile}
        submitLabel={t('common.saveChanges')}
        onSubmit={async (v) => {
          await save(v);
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md },
});
