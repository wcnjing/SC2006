import { useRef, useState } from 'react';
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
  Tag,
  TextField,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/SettingsContext';
import { useAsync } from '@/lib/useAsync';
import { adminService, errorText, type ManagedUser } from '@/services';
import { spacing } from '@/theme/tokens';

export default function VerifyOrganisersScreen() {
  const t = useT();
  const { can } = useAuth();
  const allowed = can('user:set-role');
  const page = useAsync(() => (allowed ? adminService.listUsers() : Promise.resolve([])));
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [visible, setVisible] = useState(20);
  const busy = useRef(false);
  const users = (page.data ?? []).filter(
    (user) =>
      user.role !== 'admin' &&
      (user.displayName + ' ' + user.id).toLowerCase().includes(search.trim().toLowerCase()),
  );

  async function approve() {
    if (!selected || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await adminService.verifyOrganiser(selected.id);
      setSelected(null);
      setSuccess(true);
      await page.reload();
    } catch (e) {
      setSelected(null);
      setError(errorText(t, e));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <Screen
      header={<ScreenHeader title={t('admin.verifyOrganisers')} />}
      contentStyle={{ gap: spacing.md }}
      refreshing={page.refreshing}
      onRefresh={page.refresh}
    >
      {!allowed ? (
        <Banner tone="error">{t('error.forbidden')}</Banner>
      ) : (
        <>
          <AppText>{t('admin.verifyHint')}</AppText>
          <TextField
            label={t('admin.userSearch')}
            value={search}
            onChangeText={(value) => {
              setSearch(value);
              setVisible(20);
            }}
          />
          {success && <Banner tone="success">{t('admin.organiserApproved')}</Banner>}
          {error && <Banner tone="error">{error}</Banner>}
          {page.error ? (
            <ErrorState message={errorText(t, page.error)} onRetry={page.reload} />
          ) : page.loading ? (
            <LoadingState />
          ) : (
            <>
              {!users.length && <EmptyState icon="people-outline" title={t('admin.noUsers')} />}
              {users.slice(0, visible).map((user) => (
                <Card key={user.id} variant="outline">
                  <Avatar name={user.displayName} uri={user.avatarUrl} />
                  <AppText variant="h3">{user.displayName}</AppText>
                  <AppText variant="caption">{t('admin.userId', { id: user.id })}</AppText>
                  <Tag
                    label={t(
                      user.role === 'organiser'
                        ? 'detail.verifiedOrganiser'
                        : 'admin.role.resident',
                    )}
                  />
                  {user.status === 'suspended' ? (
                    <Tag label={t('admin.suspendedUsers')} />
                  ) : (
                    user.role === 'resident' && (
                      <Button
                        label={t('admin.approveOrganiser')}
                        disabled={saving}
                        onPress={() => {
                          setSelected(user);
                          setError(null);
                          setSuccess(false);
                        }}
                      />
                    )
                  )}
                </Card>
              ))}
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
            visible={!!selected}
            title={t('admin.approveOrganiser')}
            body={t('admin.verifyBody', { name: selected?.displayName ?? '' })}
            confirmLabel={t('admin.approveOrganiser')}
            cancelLabel={t('common.cancel')}
            loading={saving}
            onConfirm={() => void approve()}
            onCancel={() => {
              if (!busy.current) setSelected(null);
            }}
          />
        </>
      )}
    </Screen>
  );
}
