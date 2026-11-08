import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Screen, ScreenHeader } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/SettingsContext';
import { ActivityForm, toActivityInput, toFormValues } from '@/features/activities/ActivityForm';
import { activityService, errorText } from '@/services';
import { saveActivityImages } from '@/services/supabase/uploads';
import { spacing } from '@/theme/tokens';

/** Create activity (FR 11.1, UC CreateActivity; P2 createActivity). */
export default function CreateActivityScreen() {
  const t = useT();
  const { session } = useAuth();
  const [values, setValues] = useState(toFormValues);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await activityService.create(toActivityInput(values));
      if (values.images.length) {
        const userId = session?.account.accountId;
        if (!userId) throw new Error('You must be signed in to upload activity images.');
        await saveActivityImages(userId, created.id, values.images);
      }
      router.replace({ pathname: '/activity/[id]', params: { id: created.id } });
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<ScreenHeader title={t('organiser.createTitle')} />}
      contentStyle={styles.content}
      footer={<Button label={t('organiser.publish')} icon="send" loading={busy} onPress={submit} />}
    >
      <ActivityForm values={values} onChange={setValues} error={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { paddingTop: spacing.sm } });
