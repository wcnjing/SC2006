import { router, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  ListRow,
  LoadingState,
  Screen,
  ScreenHeader,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/SettingsContext';
import { useAsync } from '@/lib/useAsync';
import { communityService, errorMessageKey } from '@/services';
import {
  markChatNotificationsRead,
  markConversationRead,
  subscribeToUserMessages,
} from '@/services/notifications';
import { colors, spacing } from '@/theme/tokens';

/**
 * Messages (FR 8.2; Dialog Map: Profile → Direct messages). Lists your
 * friends (resident <-> resident) plus organiser <-> resident activity chats.
 * Organisers have no friends, so they only see activity chats.
 */
export default function MessagesScreen() {
  const t = useT();
  const segments = useSegments() as readonly string[];
  const { session, hasRole } = useAuth();
  const me = session?.account.accountId;
  const resident = hasRole('resident');
  const friends = useAsync(async () => {
    const [connections, activityChats] = await Promise.all([
      resident
        ? communityService.listConnections({ view: 'friends', limit: 50 })
        : Promise.resolve({ connections: [] }),
      communityService.listActivityConversations(),
    ]);
    const friendProfiles = connections.connections
      .map((c) => (c.requester_id === me ? c.addressee : c.requester))
      .filter((p) => p !== null);
    const seen = new Set(friendProfiles.map((p) => p.id));
    const people = [...friendProfiles, ...activityChats.filter((p) => !seen.has(p.id))];
    return Promise.all(
      people.map(async (profile) => ({
        profile,
        messages: (await communityService.listDirectMessages(profile.id, { limit: 50 })).messages,
      })),
    );
  });

  useEffect(() => {
    const unsubscribe = subscribeToUserMessages(me, friends.revalidate);
    return unsubscribe ?? undefined;
  }, [me, friends.revalidate]);

  return (
    <Screen
      header={<ScreenHeader title={t('messages.title')} noBack={segments.includes('(tabs)')} />}
      contentStyle={styles.content}
      refreshing={friends.refreshing}
      onRefresh={friends.refresh}
    >
      {friends.loading && !friends.data ? (
        <LoadingState />
      ) : friends.error && !friends.data ? (
        <ErrorState message={t(errorMessageKey(friends.error))} onRetry={friends.reload} />
      ) : !friends.data?.length ? (
        <EmptyState
          icon="chatbubbles-outline"
          title={t('messages.empty')}
          body={resident ? t('messages.emptyBody') : t('messages.emptyOrganiserBody')}
          actionLabel={resident ? t('connect.findPeople') : undefined}
          onAction={
            resident
              ? () => router.push({ pathname: '/friend-requests', params: { tab: 'find' } })
              : undefined
          }
        />
      ) : (
        <View accessibilityRole="list">
          {friends.data.map(({ profile: p, messages }, i) => {
            const latest = messages.at(-1);
            const unread = messages.some(
              (message) => message.recipient_id === me && !message.read_at,
            );
            return (
              <View key={p.id} style={[i > 0 && styles.sep, unread && styles.unread]}>
                <ListRow
                  title={p.display_name}
                  subtitle={latest ? (latest.body ?? t('messages.open')) : t('messages.open')}
                  left={<Avatar name={p.display_name} uri={p.avatar_url} size={44} />}
                  right={
                    unread ? (
                      <View style={styles.unreadBadge}>
                        <AppText variant="caption" color={colors.onPrimary}>
                          Unread
                        </AppText>
                      </View>
                    ) : undefined
                  }
                  onPress={async () => {
                    await Promise.all([
                      markConversationRead(p.id),
                      markChatNotificationsRead(p.id),
                    ]);
                    router.push({ pathname: '/messages/[id]', params: { id: p.id } });
                  }}
                />
              </View>
            );
          })}
        </View>
      )}
      {resident && !!friends.data?.length && (
        <Button
          label={t('connect.findPeople')}
          variant="outline"
          icon="person-add-outline"
          onPress={() => router.push({ pathname: '/friend-requests', params: { tab: 'find' } })}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.sm },
  sep: { borderTopWidth: 1, borderTopColor: colors.divider },
  unread: { backgroundColor: colors.primarySoft, borderRadius: 10 },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
});
