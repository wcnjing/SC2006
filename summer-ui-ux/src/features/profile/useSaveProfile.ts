import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { profileService } from '@/services';

import type { ProfileFormValues } from './ProfileForm';

/** Upload a new avatar if one was picked, then save the profile and update the session. */
export function useSaveProfile() {
  const { session, setProfile } = useAuth();
  const { language } = useSettings();

  return async (values: ProfileFormValues) => {
    if (!session) throw new Error('Not authenticated');
    const { accountId } = session.account;
    const pictureChanged = values.pictureUrl && values.pictureUrl !== session.profile?.pictureUrl;
    const pictureUrl = pictureChanged
      ? await profileService.uploadAvatar(accountId, values.pictureUrl!)
      : values.pictureUrl;
    const profile = await profileService.saveProfile(accountId, {
      ...values,
      pictureUrl,
      preferredLanguage: session.profile?.preferredLanguage ?? language,
    });
    setProfile(profile);
    return profile;
  };
}
