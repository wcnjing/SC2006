import { validateModerationReason, type ManagedUser } from '@communitylink/shared';
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  ListRow,
  LoadingState,
  Screen,
  ScreenHeader,
  SegmentedTabs,
  Tag,
  TextField,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/SettingsContext';
import { useAsync } from '@/lib/useAsync';
import { communityService, errorMessageKey, errorText } from '@/services';
import { colors, spacing } from '@/theme/tokens';

type Status = ManagedUser['status'];

/**
 * Manage users (FR 12.1.3, UC SuspendAccount): an admin suspends or reinstates
 * an account with a reason. P1's set_user_status changes the status and writes
 * the audit log; a suspended user is signed out on their next check.
 */
export default function ManageUsersScreen() {
  const t = useT();
  const { session } = useAuth();
  const [tab, setTab] = useState<Status>('active');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const users = useAsync(() => communityService.listUsers());

  const select = (u: ManagedUser | null) => {
    setSelected(u);
    setReason('');
    setReasonError(null);
  };

  const askSuspend = () => {
    const invalid = validateModerationReason(reason);
    setReasonError(invalid);
    if (!invalid) setConfirm(true);
  };

  const apply = async (u: ManagedUser, next: Status) => {
    setConfirm(false);
    setBusy(true);
    setStatus(null);
    try {
      await communityService.setUserStatus(
        u.id,
        next,
        next === 'suspended' ? reason.trim() : undefined,
      );
      const text = t(next === 'suspended' ? 'admin.suspendedToast' : 'admin.reinstatedToast', {
        name: u.display_name,
      });
      setStatus({ tone: 'success', text });
      AccessibilityInfo.announceForAccessibility(text);
      select(null);
      await users.revalidate();
    } catch (e) {
      setStatus({ tone: 'error', text: errorText(t, e) });
    } finally {
      setBusy(false);
    }
  };

  const q = query.trim().toLowerCase();
  const shown = (users.data ?? []).filter(
    (u) =>
      u.id !== session?.account.accountId &&
      u.status === tab &&
      u.display_name.toLowerCase().includes(q),
  );

  return (
    <Screen header={<ScreenHeader title={t('admin.manageUsers')} />} contentStyle={styles.content}>
      {status && <Banner tone={status.tone}>{status.text}</Banner>}

      {selected && (
        <Card variant="muted">
          <View style={styles.panel}>
            <View style={styles.head}>
              <Avatar name={selected.display_name} uri={selected.avatar_url} size={40} />
              <AppText variant="h3" heading style={styles.flex}>
                {selected.display_name}
              </AppText>
            </View>
            {selected.status === 'suspended' ? (
              <>
                {selected.suspended_reason && (
                  <AppText color={colors.textMuted}>
                    {t('admin.suspendedFor', { reason: selected.suspended_reason })}
                  </AppText>
                )}
                <Button
                  label={t('admin.reinstate')}
                  icon="refresh-outline"
                  loading={busy}
                  onPress={() => apply(selected, 'active')}
                />
              </>
            ) : (
              <>
                <TextField
                  label={t('admin.suspendReasonLabel')}
                  hint={t('admin.suspendReasonHint')}
                  value={reason}
                  onChangeText={setReason}
                  error={reasonError}
                  multiline
                />
                <Button
                  label={t('admin.suspend')}
                  variant="danger"
                  icon="ban-outline"
                  loading={busy}
                  onPress={askSuspend}
                />
              </>
            )}
            <Button
              label={t('common.cancel')}
              variant="outline"
              disabled={busy}
              onPress={() => select(null)}
            />
          </View>
        </Card>
      )}

      <SegmentedTabs
        accessibilityLabel={t('admin.usersTabs')}
        value={tab}
        onChange={(s) => {
          setTab(s);
          select(null);
        }}
        tabs={[
          { value: 'active', label: t('admin.usersActive') },
          { value: 'suspended', label: t('admin.usersSuspended') },
        ]}
      />
      <TextField label={t('admin.usersSearch')} value={query} onChangeText={setQuery} />

      {users.loading && !users.data ? (
        <LoadingState />
      ) : users.error && !users.data ? (
        <ErrorState message={t(errorMessageKey(users.error))} onRetry={users.reload} />
      ) : !shown.length ? (
        <EmptyState icon="people-outline" title={t('admin.usersEmpty')} />
      ) : (
        <View accessibilityRole="list">
          {shown.map((u, i) => (
            <View key={u.id} style={i > 0 && styles.sep}>
              <ListRow
                title={u.display_name}
                subtitle={u.suspended_reason ?? undefined}
                left={<Avatar name={u.display_name} uri={u.avatar_url} size={40} />}
                right={<Tag label={t(`admin.role.${u.role}`)} tone="neutral" />}
                onPress={() => select(u)}
              />
            </View>
          ))}
        </View>
      )}

      {selected && (
        <ConfirmDialog
          visible={confirm}
          title={t('admin.suspendTitle', { name: selected.display_name })}
          body={t('admin.suspendBody')}
          confirmLabel={t('admin.suspend')}
          cancelLabel={t('common.cancel')}
          destructive
          onConfirm={() => apply(selected, 'suspended')}
          onCancel={() => setConfirm(false)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.sm },
  panel: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  sep: { borderTopWidth: 1, borderTopColor: colors.divider },
});
