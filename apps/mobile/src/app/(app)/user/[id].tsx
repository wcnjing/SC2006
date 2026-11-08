import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  ScreenHeader,
} from '@/components/ui';
import { findNeighbourhoodByDbId } from '@/config/catalog';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/SettingsContext';
import { ConnectionActions, relationOf } from '@/features/community/ConnectionActions';
import type { TranslationKey } from '@/i18n/en';
import { useAsync } from '@/lib/useAsync';
import { communityService, errorMessageKey, errorText } from '@/services';
import { colors, spacing } from '@/theme/tokens';

/**
 * Another resident's profile (mockup 4.E; Dialog Map: tapUser). Public fields
 * only (P3's ConnectionProfile): name, photo, neighbourhood. Connect / accept /
 * message (FR 8.1–8.2), and block / unblock (UC BlockUser).
 */
export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const { session, hasRole } = useAuth();
  const me = session?.account.accountId;
  const iAmResident = hasRole('resident');
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [busy, setBusy] = useState(false);

  const page = useAsync(async () => {
    const [conversation, connections] = await Promise.all([
      communityService.getDirectConversation(id),
      iAmResident
        ? communityService.listConnections({ limit: 50 })
        : Promise.resolve({ connections: [] }),
    ]);
    const connection = connections.connections.find(
      (c) => c.requester_id === id || c.addressee_id === id,
    );
    return conversation && { ...conversation, connection: connection ?? null };
  });

  if (id === me) return <Redirect href="/profile" />;

  const header = <ScreenHeader title={page.data?.profile.display_name ?? t('user.title')} />;
  if (!page.data) {
    return (
      <Screen header={header}>
        {page.loading ? (
          <LoadingState />
        ) : page.error ? (
          <ErrorState message={t(errorMessageKey(page.error))} onRetry={page.reload} />
        ) : (
          <EmptyState icon="person-outline" title={t('user.unavailable')} />
        )}
      </Screen>
    );
  }

  const { profile, blockedByMe, connection, role, canSend } = page.data;
  // Friendships are resident <-> resident only; organisers and residents
  // instead message each other through an upcoming activity.
  const canBeFriends = iAmResident && role === 'resident';
  const hood = findNeighbourhoodByDbId(profile.neighbourhood_id);
  const relation = relationOf(connection, me);

  const done = (error?: unknown, text = t('connect.updated')) => {
    const message = error ? errorText(t, error) : text;
    setStatus({ tone: error ? 'error' : 'success', text: message });
    AccessibilityInfo.announceForAccessibility(message);
    page.revalidate();
  };
  const setBlocked = async (block: boolean) => {
    setBusy(true);
    setConfirmBlock(false);
    try {
      await (block ? communityService.blockUser(id) : communityService.unblockUser(id));
      done(undefined, t(block ? 'user.blocked' : 'user.unblocked', { name: profile.display_name }));
    } catch (e) {
      done(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={header} contentStyle={styles.content}>
      <View style={styles.head}>
        <Avatar name={profile.display_name} uri={profile.avatar_url} size={96} />
        <View style={styles.flex}>
          <AppText variant="h1" heading numberOfLines={2}>
            {profile.display_name}
          </AppText>
          {hood && <AppText color={colors.textMuted}>{t(hood.labelKey as TranslationKey)}</AppText>}
          {relation === 'friends' && (
            <AppText variant="caption" color={colors.success}>
              {t('user.connected')}
            </AppText>
          )}
        </View>
      </View>

      {status && <Banner tone={status.tone}>{status.text}</Banner>}
      <Button
        label={t('report.userTitle')}
        icon="flag-outline"
        variant="outline"
        onPress={() => router.push({ pathname: '/report-user', params: { id } })}
      />

      {blockedByMe ? (
        <Banner tone="warning">{t('user.youBlocked')}</Banner>
      ) : canBeFriends ? (
        <ConnectionActions
          userId={id}
          name={profile.display_name}
          connection={connection}
          me={me}
          onDone={done}
        />
      ) : canSend ? (
        <Button
          label={t('user.message')}
          icon="chatbubble-outline"
          onPress={() => router.push({ pathname: '/messages/[id]', params: { id } })}
        />
      ) : (
        <AppText color={colors.textMuted}>{t('user.activityContact')}</AppText>
      )}

      <Button
        label={t(blockedByMe ? 'user.unblock' : 'user.block')}
        icon={blockedByMe ? 'lock-open-outline' : 'ban-outline'}
        variant={blockedByMe ? 'outline' : 'ghost'}
        loading={busy}
        onPress={() => (blockedByMe ? setBlocked(false) : setConfirmBlock(true))}
      />
      {!blockedByMe && (
        <Button
          label={t('user.blockedList')}
          variant="ghost"
          size="sm"
          onPress={() => router.push('/blocked-users')}
        />
      )}

      <ConfirmDialog
        visible={confirmBlock}
        title={t('user.blockTitle', { name: profile.display_name })}
        body={t('user.blockBody')}
        confirmLabel={t('user.block')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={busy}
        onConfirm={() => setBlocked(true)}
        onCancel={() => setConfirmBlock(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: spacing.xs },
});
