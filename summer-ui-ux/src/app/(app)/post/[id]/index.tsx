import { validateCommentBody } from '@communitylink/shared';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextInputContentSizeChangeEventData,
} from 'react-native';

import {
  AppText,
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  ImageViewer,
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
import { uploadImage } from '@/services/supabase/uploads';
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
  const [commentImage, setCommentImage] = useState<string | null>(null);
  const [uploadingCommentImage, setUploadingCommentImage] = useState(false);
  const [commentComposerHeight, setCommentComposerHeight] = useState(40);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<'like' | 'comment' | 'delete' | null>(null);
  const commentsRef = useRef<ScrollView>(null);
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

  useEffect(() => {
    if (page.data?.comments.length) requestAnimationFrame(() => commentsRef.current?.scrollToEnd());
  }, [page.data?.comments.length]);

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
    const error = commentImage ? null : validateCommentBody(comment);
    setCommentError(error);
    if (error) return;
    run(
      'comment',
      async () => {
        await communityService.createComment({
          postId: id,
          body: comment,
          imageUrl: commentImage,
        });
        setComment('');
        setCommentImage(null);
      },
      t('post.commented'),
    );
  };

  const handleCommentChange = (value: string) => {
    setComment(value);
    if (!value.trim()) setCommentComposerHeight(40);
  };

  const handleCommentKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (event.nativeEvent.key === 'Enter' && !event.nativeEvent.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const chooseCommentImage = async () => {
    if (!me) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingCommentImage(true);
    setCommentError(null);
    try {
      setCommentImage(await uploadImage('community-images', me, result.assets[0].uri));
    } catch (e) {
      setStatus({ tone: 'error', text: errorText(t, e) });
    } finally {
      setUploadingCommentImage(false);
    }
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
      scroll={false}
      refreshing={page.refreshing}
      onRefresh={page.refresh}
      footer={
        <View style={styles.composerWrap}>
          {!!commentImage && (
            <View style={styles.preview}>
              <ImageViewer
                uri={commentImage}
                style={styles.previewImage}
                label="Preview attached image"
              />
              <IconButton
                icon="close-circle"
                label="Remove attached image"
                color={colors.error}
                onPress={() => setCommentImage(null)}
              />
            </View>
          )}
          <View style={styles.composer}>
            <IconButton
              icon="image-outline"
              label="Attach image"
              disabled={uploadingCommentImage}
              onPress={chooseCommentImage}
            />
            <View style={styles.flex}>
              <TextField
                label={t('post.addComment')}
                value={comment}
                onChangeText={handleCommentChange}
                error={commentError}
                compact
                multiline
                style={{ height: commentComposerHeight }}
                onContentSizeChange={(
                  event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
                ) => {
                  if (comment.trim()) {
                    setCommentComposerHeight(
                      Math.min(120, Math.max(40, event.nativeEvent.contentSize.height)),
                    );
                  }
                }}
                onKeyPress={handleCommentKeyPress}
              />
            </View>
            <Button
              label={t('post.send')}
              icon="send"
              fullWidth={false}
              loading={busy === 'comment'}
              disabled={!!busy || uploadingCommentImage}
              style={styles.sendButton}
              onPress={send}
            />
          </View>
        </View>
      }
    >
      <View style={styles.postContent}>
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
        {!!post.image_url && (
          <ImageViewer uri={post.image_url} style={styles.image} label="Open post image" />
        )}

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
      </View>

      <ScrollView
        ref={commentsRef}
        style={styles.comments}
        contentContainerStyle={styles.commentsContent}
        onContentSizeChange={() => commentsRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator
      >
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
                  {c.body ? <AppText>{String(c.body)}</AppText> : null}
                  {c.image_url ? (
                    <ImageViewer
                      uri={c.image_url}
                      style={styles.commentImage}
                      label="Open comment image"
                    />
                  ) : null}
                </View>
              );
            })
          )}
        </Section>
      </ScrollView>

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
  content: { flex: 1, gap: spacing.lg, paddingTop: spacing.sm },
  flex: { flex: 1 },
  postContent: { gap: spacing.lg },
  comments: { flex: 1, minHeight: 0 },
  commentsContent: { paddingBottom: spacing.md },
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: radii.md },
  likeRow: { flexDirection: 'row' },
  comment: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  commentImage: { width: 220, height: 160, borderRadius: radii.md },
  composerWrap: { gap: spacing.sm },
  preview: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  previewImage: { width: 96, height: 72, borderRadius: radii.sm },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  sendButton: { alignSelf: 'flex-end' },
});
