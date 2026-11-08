import { canManageActivity } from '@communitylink/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  ScreenHeader,
  Section,
  TextField,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/SettingsContext';
import {
  ActivityForm,
  toActivityInput,
  toFormValues,
  type ActivityFormValues,
} from '@/features/activities/ActivityForm';
import { hasStarted } from '@/features/activities/format';
import { useAsync } from '@/lib/useAsync';
import { activityService, errorMessageKey, errorText } from '@/services';
import { spacing } from '@/theme/tokens';
import type { Activity } from '@/types/models';

/**
 * Edit / cancel activity (FR 11.2, UC UpdateActivity / CancelActivity).
 * Only the organiser who owns it (P2 canManageActivity), only while it is
 * scheduled and has not started. Edits send the loaded `updated_at`, so a
 * change made elsewhere in the meantime is rejected instead of overwritten.
 */
export default function EditActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const { session } = useAuth();
  const activity = useAsync(() => activityService.getActivity(id));

  const header = <ScreenHeader title={t('organiser.editTitle')} />;
  if (!activity.data) {
    return (
      <Screen header={header}>
        {activity.loading ? (
          <LoadingState />
        ) : activity.error ? (
          <ErrorState message={t(errorMessageKey(activity.error))} onRetry={activity.reload} />
        ) : (
          <EmptyState icon="calendar-clear-outline" title={t('detail.unavailableTitle')} />
        )}
      </Screen>
    );
  }
  const account = session?.account;
  const owner =
    !!account &&
    canManageActivity(
      { id: account.accountId, role: account.roles[0], status: account.status },
      account.accountId,
      activity.data,
    );
  if (!owner) {
    return (
      <Screen header={header}>
        <EmptyState icon="lock-closed-outline" title={t('organiser.notYours')} />
      </Screen>
    );
  }
  return <Editor activity={activity.data} />;
}

function Editor({ activity }: { activity: Activity }) {
  const t = useT();
  const [values, setValues] = useState<ActivityFormValues>(() => toFormValues(activity));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'cancel' | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const editable = activity.status === 'scheduled' && !hasStarted(activity);

  const run = async (kind: 'save' | 'cancel', action: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
      if (router.canGoBack()) router.back();
      else router.replace('/organiser');
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      header={<ScreenHeader title={t('organiser.editTitle')} />}
      contentStyle={styles.content}
      footer={
        editable && (
          <Button
            label={t('common.saveChanges')}
            loading={busy === 'save'}
            disabled={!!busy}
            onPress={() =>
              run('save', () =>
                activityService.update(
                  activity.id,
                  toActivityInput(values, activity),
                  activity.updated_at,
                ),
              )
            }
          />
        )
      }
    >
      {!editable && <Banner tone="info">{t('organiser.readOnly')}</Banner>}
      <Button
        label={t('organiser.viewPublic')}
        variant="ghost"
        icon="eye-outline"
        size="sm"
        fullWidth={false}
        onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}
      />
      <ActivityForm values={values} onChange={setValues} error={error} />

      {editable && (
        <Section title={t('organiser.cancelTitle')}>
          {cancelling ? (
            <Card variant="muted">
              <View style={styles.cancel}>
                <TextField
                  label={t('organiser.cancelReason')}
                  hint={t('organiser.cancelReasonHint')}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                />
                <Button
                  label={t('organiser.cancelConfirm')}
                  variant="danger"
                  loading={busy === 'cancel'}
                  disabled={!!busy}
                  onPress={() =>
                    run('cancel', () =>
                      activityService.cancel(activity.id, reason, activity.updated_at),
                    )
                  }
                />
                <Button
                  label={t('organiser.cancelKeep')}
                  variant="ghost"
                  onPress={() => setCancelling(false)}
                />
              </View>
            </Card>
          ) : (
            <Button
              label={t('organiser.cancelActivity')}
              variant="outline"
              icon="close-circle-outline"
              onPress={() => setCancelling(true)}
            />
          )}
        </Section>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.sm },
  cancel: { gap: spacing.md },
});
