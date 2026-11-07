import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  EmptyState,
  ErrorState,
  ListRow,
  LoadingState,
  Screen,
  ScreenHeader,
} from '@/components/ui';
import { useNotifications } from '@/context/NotificationsContext';
import { useSettings } from '@/context/SettingsContext';
import { errorText } from '@/services';
import { colors, spacing } from '@/theme/tokens';

function payloadText(payload: unknown, key: 'title' | 'body' | 'route'): string | undefined {
  if (!payload || typeof payload !== 'object' || !(key in payload)) return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

export default function NotificationsScreen() {
  const { t } = useSettings();
  const { notifications, loading, error, refresh, markRead, clear } = useNotifications();

  return (
    <Screen
      header={<ScreenHeader title={t('home.notifications')} />}
      contentStyle={styles.content}
      refreshing={loading}
      onRefresh={refresh}
    >
      {loading && !notifications.length ? (
        <LoadingState />
      ) : error && !notifications.length ? (
        <ErrorState message={errorText(t, error)} onRetry={refresh} />
      ) : !notifications.length ? (
        <EmptyState
          icon="notifications-outline"
          title="No notifications"
          body="You are all caught up."
        />
      ) : (
        <>
          <Button
            label="Clear notifications"
            icon="trash-outline"
            variant="danger"
            onPress={clear}
          />
          <View accessibilityRole="list">
            {notifications.map((notification, index) => {
              const route = payloadText(notification.payload, 'route');
              const unread = !notification.read_at;
              return (
                <View
                  key={notification.id}
                  style={[index > 0 && styles.separator, unread && styles.unreadNotification]}
                >
                  <ListRow
                    title={payloadText(notification.payload, 'title') ?? 'Notification'}
                    subtitle={payloadText(notification.payload, 'body')}
                    subtitleTone={notification.read_at ? 'muted' : 'alert'}
                    left={
                      <View style={styles.date}>
                        {unread && <View style={styles.unreadDot} />}
                        <AppText variant="caption" color={colors.textMuted}>
                          {new Date(notification.created_at).toLocaleDateString()}
                        </AppText>
                      </View>
                    }
                    onPress={async () => {
                      await markRead(notification);
                      if (route) router.push(route as Parameters<typeof router.push>[0]);
                    }}
                  />
                </View>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.sm },
  separator: { borderTopWidth: 1, borderTopColor: colors.divider },
  unreadNotification: { backgroundColor: colors.primarySoft, borderRadius: 10 },
  date: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
