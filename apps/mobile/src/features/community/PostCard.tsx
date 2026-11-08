import type { CommunityPost } from '@communitylink/shared';
import { router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Card } from '@/components/ui';
import { useT } from '@/context/SettingsContext';
import { colors, radii, spacing } from '@/theme/tokens';

import { formatAgo } from './format';

/** Feed card (mockup 4.D). The whole card opens the post; likes and comments are on the post screen. */
export function PostCard({ post }: { post: CommunityPost }) {
  const t = useT();
  const name = post.author?.display_name ?? t('community.unknownUser');
  const when = formatAgo(t, post.created_at);
  return (
    <Card
      variant="outline"
      onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
      accessibilityLabel={t('community.postA11y', { name, when, body: post.body })}
    >
      <View style={styles.body}>
        <AuthorLine name={name} uri={post.author?.avatar_url} when={when} />
        <AppText numberOfLines={6}>{post.body}</AppText>
        {post.image_url && <Image source={{ uri: post.image_url }} style={styles.image} />}
      </View>
    </Card>
  );
}

export function AuthorLine({
  name,
  uri,
  when,
  size = 40,
}: {
  name: string;
  uri?: string | null;
  when: string;
  size?: number;
}) {
  return (
    <View style={styles.author}>
      <Avatar name={name} uri={uri} size={size} />
      <View style={styles.flex}>
        <AppText variant="label" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {when}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: radii.md },
});
