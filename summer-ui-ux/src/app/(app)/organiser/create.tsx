import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Screen, ScreenHeader } from '@/components/ui';
import { useT } from '@/context/SettingsContext';
import { ActivityForm, toActivityInput, toFormValues } from '@/features/activities/ActivityForm';
import { activityService, errorText } from '@/services';
import { spacing } from '@/theme/tokens';

/** Create activity (FR 11.1, UC CreateActivity; P2 createActivity). */
export default function CreateActivityScreen() {
  const t = useT();
  const [values, setValues] = useState(toFormValues);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await activityService.create(toActivityInput(values));
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
