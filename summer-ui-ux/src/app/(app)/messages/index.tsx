import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
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
import { colors, spacing } from '@/theme/tokens';

/**
 * Messages (FR 8.2; Dialog Map: Profile → Direct messages). P3 only allows
 * direct messages between connected residents, so the list is your friends.
 */
export default function MessagesScreen() {
  const t = useT();
  const me = useAuth().session?.account.accountId;
  const friends = useAsync(async () =>
    (await communityService.listConnections({ view: 'friends', limit: 50 })).connections
      .map((c) => (c.requester_id === me ? c.addressee : c.requester))
      .filter((p) => p !== null),
  );

  return (
    <Screen
      header={<ScreenHeader title={t('messages.title')} />}
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
          body={t('messages.emptyBody')}
          actionLabel={t('connect.findPeople')}
          onAction={() => router.push({ pathname: '/friend-requests', params: { tab: 'find' } })}
        />
      ) : (
        <View accessibilityRole="list">
          {friends.data.map((p, i) => (
            <View key={p.id} style={i > 0 && styles.sep}>
              <ListRow
                title={p.display_name}
                subtitle={t('messages.open')}
                left={<Avatar name={p.display_name} uri={p.avatar_url} size={44} />}
                onPress={() => router.push({ pathname: '/messages/[id]', params: { id: p.id } })}
              />
            </View>
          ))}
        </View>
      )}
      {!!friends.data?.length && (
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
});
