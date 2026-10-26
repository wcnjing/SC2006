import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  AppHeader,
  AppText,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  Screen,
} from '@/components/ui';
import { findNeighbourhood } from '@/config/catalog';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { PostCard } from '@/features/community/PostCard';
import type { TranslationKey } from '@/i18n/en';
import { useAsync } from '@/lib/useAsync';
import { communityService, errorMessageKey } from '@/services';
import { colors, spacing } from '@/theme/tokens';

/**
 * Community (mockup 4.D; Dialog Map 3 Community tab). FR 7.1: the latest
 * posts in the user's neighbourhood (P3 listPosts), newest first. Friends
 * and Messages are one tap away in the title row.
 */
export default function CommunityScreen() {
  const { t } = useSettings();
  const { session } = useAuth();
  const hood = findNeighbourhood(session?.profile?.neighbourhoodId);

  const feed = useAsync(async () =>
    hood ? (await communityService.listPosts({ neighbourhoodId: hood.dbId, limit: 50 })).posts : [],
  );

  return (
    <Screen
      inTabs
      header={<AppHeader />}
      contentStyle={styles.content}
      refreshing={feed.refreshing}
      onRefresh={feed.refresh}
    >
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <AppText variant="h1" heading>
            {t('community.title')}
          </AppText>
          {hood && (
            <AppText color={colors.textMuted}>
              {t('community.subtitle', { place: t(hood.labelKey as TranslationKey) })}
            </AppText>
          )}
        </View>
        <IconButton
          icon="people-outline"
          label={t('community.friends')}
          onPress={() => router.push('/friend-requests')}
        />
        <IconButton
          icon="chatbubble-ellipses-outline"
          label={t('community.messages')}
          onPress={() => router.push('/messages')}
        />
      </View>

      <Button
        label={t('community.newPost')}
        icon="create-outline"
        onPress={() => router.push('/post/create')}
      />

      {feed.loading && !feed.data ? (
        <LoadingState />
      ) : feed.error && !feed.data ? (
        <ErrorState message={t(errorMessageKey(feed.error))} onRetry={feed.reload} />
      ) : !feed.data?.length ? (
        <EmptyState
          icon="chatbubbles-outline"
          title={t('community.emptyTitle')}
          body={t('community.emptyBody')}
        />
      ) : (
        <View accessibilityRole="list" style={styles.list}>
          {feed.data.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
  list: { gap: spacing.md },
});
