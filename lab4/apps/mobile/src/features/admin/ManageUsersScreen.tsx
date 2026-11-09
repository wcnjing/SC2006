import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
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
import { adminService, errorText, type ManagedUser } from '@/services';
import { colors, spacing } from '@/theme/tokens';

export default function ManageUsersScreen() {
  const t = useT();
  const { session, can } = useAuth();
  const allowed = can('user:suspend');
  const page = useAsync(() => (allowed ? adminService.listUsers() : Promise.resolve([])));
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | ManagedUser['status']>('all');
  const [visible, setVisible] = useState(20);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const busy = useRef(false);
  const users = (page.data ?? []).filter(
    (user) =>
      (filter === 'all' || user.status === filter) &&
      `${user.displayName} ${user.id}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  async function save() {
    if (!selected || busy.current || (selected.status === 'active' && !reason.trim())) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await adminService.setStatus(
        selected.id,
        selected.status === 'active' ? 'suspended' : 'active',
        reason,
      );
      setSelected(null);
      setConfirm(false);
      setSuccess(true);
      await page.reload();
    } catch (e) {
      setConfirm(false);
      setError(errorText(t, e));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <Screen
      header={<ScreenHeader title={t('admin.manageUsers')} />}
      contentStyle={styles.content}
      refreshing={page.refreshing}
      onRefresh={page.refresh}
    >
      {!allowed ? (
        <Banner tone="error">{t('error.forbidden')}</Banner>
      ) : (
        <>
          <AppText color={colors.textMuted}>{t('admin.usersHint')}</AppText>
          <TextField
            label={t('admin.userSearch')}
            value={search}
            leftIcon="search-outline"
            onChangeText={(value) => {
              setSearch(value);
              setVisible(20);
            }}
          />
          <SegmentedTabs
            value={filter}
            accessibilityLabel={t('admin.userStatus')}
            tabs={[
              { value: 'all', label: t('admin.allUsers') },
              { value: 'active', label: t('admin.activeUsers') },
              { value: 'suspended', label: t('admin.suspendedUsers') },
            ]}
            onChange={(value) => {
              setFilter(value);
              setVisible(20);
            }}
          />
          {success && <Banner tone="success">{t('admin.statusSaved')}</Banner>}
          {error && <Banner tone="error">{error}</Banner>}
          {page.error ? (
            <ErrorState message={errorText(t, page.error)} onRetry={page.reload} />
          ) : page.loading ? (
            <LoadingState />
          ) : (
            <>
              {users.length === 0 && (
                <EmptyState icon="people-outline" title={t('admin.noUsers')} />
              )}
              {users.slice(0, visible).map((user) => {
                const own = user.id === session?.account.accountId;
                const editing = selected?.id === user.id;
                return (
                  <Card key={user.id} variant="outline">
                    <View style={styles.card}>
                      <View style={styles.identity}>
                        <Avatar name={user.displayName} uri={user.avatarUrl} />
                        <View style={styles.name}>
                          <AppText variant="h3">{user.displayName}</AppText>
                          <AppText variant="caption" color={colors.textMuted}>
                            {t(`admin.role.${user.role}`)}
                          </AppText>
                        </View>
                        <Tag
                          label={t(
                            user.status === 'active' ? 'admin.activeUsers' : 'admin.suspendedUsers',
                          )}
                          tone={user.status === 'active' ? 'nature' : 'primary'}
                        />
                      </View>
                      <AppText variant="caption" color={colors.textMuted}>
                        {t('admin.userId', { id: user.id })}
                      </AppText>
                      {user.status === 'suspended' && user.reason && (
                        <Banner tone="warning">{user.reason}</Banner>
                      )}
                      {own ? (
                        <AppText variant="caption" color={colors.textMuted}>
                          {t('admin.ownAccount')}
                        </AppText>
                      ) : editing ? (
                        <>
                          {user.status === 'active' && (
                            <TextField
                              label={t('admin.suspensionReason')}
                              value={reason}
                              onChangeText={setReason}
                              multiline
                              maxLength={1000}
                              editable={!saving}
                            />
                          )}
                          <Button
                            label={t(
                              user.status === 'active' ? 'admin.suspend' : 'admin.reinstate',
                            )}
                            variant={user.status === 'active' ? 'danger' : 'primary'}
                            disabled={saving || (user.status === 'active' && !reason.trim())}
                            onPress={() => setConfirm(true)}
                          />
                          <Button
                            label={t('common.cancel')}
                            variant="secondary"
                            disabled={saving}
                            onPress={() => {
                              setSelected(null);
                              setError(null);
                            }}
                          />
                        </>
                      ) : (
                        <Button
                          label={t(user.status === 'active' ? 'admin.suspend' : 'admin.reinstate')}
                          variant="outline"
                          disabled={saving}
                          onPress={() => {
                            setSelected(user);
                            setReason('');
                            setError(null);
                            setSuccess(false);
                          }}
                        />
                      )}
                    </View>
                  </Card>
                );
              })}
              {users.length > visible && (
                <Button
                  label={t('admin.showMoreUsers')}
                  variant="secondary"
                  onPress={() => setVisible((count) => count + 20)}
                />
              )}
            </>
          )}
          <ConfirmDialog
            visible={confirm && !!selected}
            title={t(selected?.status === 'active' ? 'admin.suspendTitle' : 'admin.reinstateTitle')}
            body={t(selected?.status === 'active' ? 'admin.suspendBody' : 'admin.reinstateBody', {
              name: selected?.displayName ?? '',
            })}
            confirmLabel={t(selected?.status === 'active' ? 'admin.suspend' : 'admin.reinstate')}
            cancelLabel={t('common.cancel')}
            destructive={selected?.status === 'active'}
            loading={saving}
            onConfirm={() => void save()}
            onCancel={() => {
              if (!busy.current) setConfirm(false);
            }}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.sm },
  card: { gap: spacing.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  name: { flex: 1, minWidth: 120 },
});
