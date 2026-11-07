import { validateCommentBody } from '@communitylink/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Image, Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  Screen,
  ScreenHeader,
  Section,
  TextField,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { formatAgo } from '@/features/community/format';
import { AuthorLine } from '@/features/community/PostCard';
import { useAsync } from '@/lib/useAsync';
import { communityService, errorMessageKey, errorText } from '@/services';
import { markCommunityPostNotificationsRead } from '@/services/notifications';
import { colors, radii, spacing } from '@/theme/tokens';

/**
 * Post (FR 8.3, UC LikePost / AddComment; Dialog Map: tapPost). The author can
 * edit or delete it; everyone else can report it (FR 8.4). Comments: newest at
 * the bottom; delete your own, report anyone else's.
 */
export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useSettings();
  const { session } = useAuth();
  const me = session?.account.accountId;

  useEffect(() => {
    void markCommunityPostNotificationsRead(id);
  }, [id]);

  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<'like' | 'comment' | 'delete' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: 'post' | 'comment';
    id: string;
  } | null>(null);

  const page = useAsync(async () => {
    const post = await communityService.getPost(id);
    if (!post) return null;
    const [likes, comments] = await Promise.all([
      communityService.getPostLikeState(id),
      communityService.listComments(id, { limit: 50 }),
    ]);
    return { post, likes, comments: comments.comments };
  });

  const run = async (
    kind: NonNullable<typeof busy>,
    action: () => Promise<void>,
    done?: string,
  ) => {
    setBusy(kind);
    setStatus(null);
    try {
      await action();
      if (done) {
        setStatus({ tone: 'success', text: done });
        AccessibilityInfo.announceForAccessibility(done);
      }
      await page.revalidate();
    } catch (e) {
      setStatus({ tone: 'error', text: errorText(t, e) });
    } finally {
      setBusy(null);
    }
  };

  const data = page.data;
  const mine = !!data && data.post.author_id === me;
  const header = (
    <ScreenHeader
      title={t('post.title')}
      right={
        data &&
        (mine ? (
          <>
            <IconButton
              icon="create-outline"
              label={t('post.edit')}
              onPress={() => router.push({ pathname: '/post/[id]/edit', params: { id } })}
            />
            <IconButton
              icon="trash-outline"
              label={t('post.delete')}
              onPress={() => setConfirmDelete({ kind: 'post', id })}
            />
          </>
        ) : (
          <IconButton
            icon="flag-outline"
            label={t('post.report')}
            onPress={() => router.push({ pathname: '/post/[id]/report', params: { id } })}
          />
        ))
      }
    />
  );

  if (!data) {
    return (
      <Screen header={header}>
        {page.loading ? (
          <LoadingState />
        ) : page.error ? (
          <ErrorState message={t(errorMessageKey(page.error))} onRetry={page.reload} />
        ) : (
          <EmptyState
            icon="document-outline"
            title={t('post.unavailable')}
            body={t('post.unavailableBody')}
            actionLabel={t('common.back')}
            onAction={() => router.back()}
          />
        )}
      </Screen>
    );
  }

  const { post, likes, comments } = data;
  const authorName = post.author?.display_name ?? t('community.unknownUser');
  const openUser = (userId: string) =>
    userId !== me && router.push({ pathname: '/user/[id]', params: { id: userId } });

  const send = () => {
    const error = validateCommentBody(comment);
    setCommentError(error);
    if (error) return;
    run(
      'comment',
      async () => {
        await communityService.createComment({ postId: id, body: comment });
        setComment('');
      },
      t('post.commented'),
    );
  };

  const remove = () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    if (target.kind === 'post') {
      run('delete', async () => {
        await communityService.deletePost(target.id);
        if (router.canGoBack()) router.back();
        else router.replace('/community');
      });
    } else {
      run('delete', () => communityService.deleteComment(target.id), t('post.commentDeleted'));
    }
  };

  return (
    <Screen
      header={header}
      contentStyle={styles.content}
      refreshing={page.refreshing}
      onRefresh={page.refresh}
      footer={
        <View style={styles.composer}>
          <View style={styles.flex}>
            <TextField
              label={t('post.addComment')}
              value={comment}
              onChangeText={setComment}
              error={commentError}
              multiline
            />
          </View>
          <Button
            label={t('post.send')}
            icon="send"
            fullWidth={false}
            loading={busy === 'comment'}
            disabled={!!busy}
            onPress={send}
          />
        </View>
      }
    >
      <Pressable
        accessibilityRole={mine ? undefined : 'button'}
        accessibilityLabel={mine ? undefined : t('post.openAuthor', { name: authorName })}
        disabled={mine}
        onPress={() => openUser(post.author_id)}
      >
        <AuthorLine
          name={authorName}
          uri={post.author?.avatar_url}
          when={formatAgo(t, post.created_at)}
          size={48}
        />
      </Pressable>
      <AppText>{post.body}</AppText>
      {post.image_url && <Image source={{ uri: post.image_url }} style={styles.image} />}

      <View style={styles.likeRow}>
        <Button
          label={t('post.likes', { count: likes.likeCount })}
          accessibilityLabel={t(likes.likedByMe ? 'post.unlikeA11y' : 'post.likeA11y', {
            count: likes.likeCount,
          })}
          icon={likes.likedByMe ? 'heart' : 'heart-outline'}
          variant={likes.likedByMe ? 'primary' : 'outline'}
          size="sm"
          fullWidth={false}
          loading={busy === 'like'}
          disabled={!!busy}
          onPress={() =>
            run('like', async () => {
              await communityService.setPostLiked(id, !likes.likedByMe);
            })
          }
        />
      </View>

      {status && <Banner tone={status.tone}>{status.text}</Banner>}

      <Section title={t('post.comments', { count: comments.length })}>
        {comments.length === 0 ? (
          <AppText color={colors.textMuted}>{t('post.noComments')}</AppText>
        ) : (
          comments.map((c) => {
            const name = c.author?.display_name ?? t('community.unknownUser');
            return (
              <View key={c.id} style={styles.comment}>
                <View style={styles.commentHead}>
                  <Pressable
                    style={styles.flex}
                    accessibilityRole={c.author_id === me ? undefined : 'button'}
                    disabled={c.author_id === me}
                    onPress={() => openUser(c.author_id)}
                  >
                    <AuthorLine
                      name={name}
                      uri={c.author?.avatar_url}
                      when={formatAgo(t, c.created_at)}
                      size={32}
                    />
                  </Pressable>
                  {c.author_id === me ? (
                    <IconButton
                      icon="trash-outline"
                      label={t('post.deleteComment')}
                      onPress={() => setConfirmDelete({ kind: 'comment', id: c.id })}
                    />
                  ) : (
                    <IconButton
                      icon="flag-outline"
                      label={t('post.reportComment', { name })}
                      onPress={() =>
                        router.push({
                          pathname: '/post/[id]/report',
                          params: { id, comment: c.id },
                        })
                      }
                    />
                  )}
                </View>
                <AppText>{c.body}</AppText>
              </View>
            );
          })
        )}
      </Section>

      <ConfirmDialog
        visible={!!confirmDelete}
        title={t(
          confirmDelete?.kind === 'comment' ? 'post.deleteCommentTitle' : 'post.deleteTitle',
        )}
        body={t('post.deleteBody')}
        confirmLabel={t('post.deleteConfirm')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={busy === 'delete'}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.sm },
  flex: { flex: 1 },
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: radii.md },
  likeRow: { flexDirection: 'row' },
  comment: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
});
