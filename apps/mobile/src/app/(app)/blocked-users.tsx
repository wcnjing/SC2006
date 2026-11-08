import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  ScreenHeader,
} from '@/components/ui';
import { useT } from '@/context/SettingsContext';
import { PersonRow } from '@/features/community/PersonRow';
import { useAsync } from '@/lib/useAsync';
import { communityService, errorMessageKey, errorText } from '@/services';
import { spacing } from '@/theme/tokens';

/** Blocked users (UC BlockUser; P3 listBlockedUsers / unblockUser). */
export default function BlockedUsersScreen() {
  const t = useT();
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const list = useAsync(async () => (await communityService.listBlockedUsers({ limit: 50 })).users);

  const unblock = async (userId: string, name: string) => {
    setBusy(userId);
    try {
      await communityService.unblockUser(userId);
      const text = t('user.unblocked', { name });
      setStatus({ tone: 'success', text });
      AccessibilityInfo.announceForAccessibility(text);
      await list.revalidate();
    } catch (e) {
      setStatus({ tone: 'error', text: errorText(t, e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen header={<ScreenHeader title={t('blocked.title')} />} contentStyle={styles.content}>
      {status && <Banner tone={status.tone}>{status.text}</Banner>}
      {list.loading && !list.data ? (
        <LoadingState />
      ) : list.error && !list.data ? (
        <ErrorState message={t(errorMessageKey(list.error))} onRetry={list.reload} />
      ) : !list.data?.length ? (
        <EmptyState icon="ban-outline" title={t('blocked.empty')} body={t('blocked.emptyBody')} />
      ) : (
        <View accessibilityRole="list">
          {list.data.map(
            (u) =>
              u.profile && (
                <PersonRow key={u.id} person={u.profile}>
                  <Button
                    label={t('user.unblock')}
                    accessibilityLabel={`${t('user.unblock')}: ${u.profile.display_name}`}
                    size="sm"
                    variant="outline"
                    fullWidth={false}
                    loading={busy === u.id}
                    disabled={!!busy}
                    onPress={() => unblock(u.id, u.profile!.display_name)}
                  />
                </PersonRow>
              ),
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { gap: spacing.lg, paddingTop: spacing.sm } });
