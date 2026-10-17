import {
  ApiError,
  COMMENT_BODY_MAX_LENGTH,
  validateCommentBody,
  type CommunityComment,
} from '@communitylink/shared';
import { randomUUID } from 'expo-crypto';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import {
  createComment,
  deleteComment,
  getPostLikeState,
  setPostLiked,
  updateComment,
} from '../services/community';
import { colors } from '../theme/tokens';
import {
  CommunityButton,
  CommunityError,
  communityStyles as styles,
  communityText as text,
} from './communityUi';
import { useCommentThread } from './useCommentThread';
import { useCommunityQuery } from './useCommunityQuery';

function message(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function CommentRow({
  comment,
  disabled,
  onUpdate,
  onDelete,
}: {
  comment: CommunityComment;
  disabled: boolean;
  onUpdate: (comment: CommunityComment) => void;
  onDelete: (id: string) => void;
}) {
  const { profile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  async function save(remove: boolean) {
    if (busy.current || disabled) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      if (remove) {
        await deleteComment(supabase, comment.id);
        onDelete(comment.id);
      } else {
        onUpdate(await updateComment(supabase, comment.id, draft));
        setEditing(false);
      }
    } catch (error) {
      setError(message(error, text.commentError));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const canEdit = comment.author_id === profile?.id && profile.status === 'active';
  return (
    <View style={styles.card} testID="comment-row">
      <Text style={styles.label}>{comment.author?.display_name || text.authorFallback}</Text>
      <Text style={styles.muted}>{new Date(comment.created_at).toLocaleString()}</Text>
      {editing ? (
        <>
          <TextInput
            accessibilityLabel="Edit your comment"
            style={[styles.input, styles.multiline]}
            value={draft}
            onChangeText={setDraft}
            multiline
            editable={!saving && !disabled}
          />
          <Text style={styles.muted}>
            {Array.from(draft.trim()).length} / {COMMENT_BODY_MAX_LENGTH}
          </Text>
          <CommunityButton
            label={text.save}
            disabled={saving || disabled}
            onPress={() => void save(false)}
          />
          <CommunityButton
            label={text.cancelEdit}
            disabled={saving || disabled}
            onPress={() => {
              setEditing(false);
              setError(null);
            }}
            secondary
          />
        </>
      ) : (
        <Text style={styles.body} testID="comment-body">
          {comment.body}
        </Text>
      )}
      {canEdit && !editing && (
        <>
          <CommunityButton
            label={text.editComment}
            disabled={saving || disabled}
            onPress={() => {
              setDraft(comment.body);
              setEditing(true);
              setConfirmDelete(false);
              setError(null);
            }}
            secondary
          />
          {confirmDelete ? (
            <>
              <Text style={styles.body}>{text.confirmDeleteComment}</Text>
              <CommunityButton
                label={text.deleteCommentAction}
                disabled={saving || disabled}
                onPress={() => void save(true)}
              />
              <CommunityButton
                label={text.keepComment}
                disabled={saving || disabled}
                onPress={() => setConfirmDelete(false)}
                secondary
              />
            </>
          ) : (
            <CommunityButton
              label={text.deleteComment}
              disabled={saving || disabled}
              onPress={() => setConfirmDelete(true)}
              secondary
            />
          )}
        </>
      )}
      {error && <CommunityError>{error}</CommunityError>}
    </View>
  );
}

export function PostInteractions({
  postId,
  disabled = false,
}: {
  postId: string;
  disabled?: boolean;
}) {
  const { profile } = useAuth();
  const loadLikes = useCallback(
    (signal: AbortSignal) => getPostLikeState(supabase, postId, { signal }),
    [postId],
  );
  const likes = useCommunityQuery(loadLikes);
  const thread = useCommentThread(postId);
  const [liking, setLiking] = useState(false);
  const [likeError, setLikeError] = useState<string | null>(null);
  const likeBusy = useRef(false);
  const [body, setBody] = useState('');
  const [requestId, setRequestId] = useState(() => randomUUID());
  const [sending, setSending] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sendBusy = useRef(false);
  const cannotWrite = disabled || profile?.status !== 'active';

  async function like() {
    if (likeBusy.current || !likes.data || cannotWrite) return;
    likeBusy.current = true;
    setLiking(true);
    setLikeError(null);
    try {
      likes.replace(await setPostLiked(supabase, postId, !likes.data.likedByMe));
    } catch (error) {
      setLikeError(message(error, text.likeError));
    } finally {
      likeBusy.current = false;
      setLiking(false);
    }
  }
  async function send() {
    if (sendBusy.current || cannotWrite || thread.loading) return;
    const invalid = validateCommentBody(body);
    if (invalid) {
      setCommentError(invalid);
      return;
    }
    sendBusy.current = true;
    setSending(true);
    setCommentError(null);
    setNotice(null);
    try {
      thread.upsert(await createComment(supabase, { postId, body, requestId }));
      setBody('');
      setRequestId(randomUUID());
      setNotice(text.commentPosted);
    } catch (error) {
      setCommentError(message(error, text.commentError));
    } finally {
      sendBusy.current = false;
      setSending(false);
    }
  }
  return (
    <View style={styles.section}>
      {likes.loading ? (
        <ActivityIndicator accessibilityLabel="Loading likes" />
      ) : likes.error ? (
        <>
          <CommunityError>{likes.error}</CommunityError>
          <CommunityButton label={text.retryLikes} onPress={likes.retry} secondary />
        </>
      ) : (
        likes.data && (
          <>
            <Text testID="post-like-count" style={styles.label} accessibilityLiveRegion="polite">
              {likes.data.likeCount} {likes.data.likeCount === 1 ? 'like' : 'likes'}
            </Text>
            <CommunityButton
              label={likes.data.likedByMe ? text.unlike : text.like}
              selected={likes.data.likedByMe}
              secondary={!likes.data.likedByMe}
              disabled={cannotWrite || liking}
              onPress={() => void like()}
            />
          </>
        )
      )}
      {likeError && <CommunityError>{likeError}</CommunityError>}
      <Text accessibilityRole="header" style={styles.heading}>
        {text.comments}
      </Text>
      <CommunityButton
        label={text.refreshComments}
        onPress={thread.refresh}
        disabled={thread.loading || sending}
        secondary
      />
      {thread.hasMore && (
        <CommunityButton
          label={text.olderComments}
          onPress={thread.loadMore}
          disabled={thread.loading || sending}
          secondary
        />
      )}
      {thread.loading && <ActivityIndicator accessibilityLabel="Loading comments" />}
      {!thread.loading && !thread.error && !thread.comments.length && (
        <Text style={styles.body}>{text.emptyComments}</Text>
      )}
      {thread.comments.map((comment) => (
        <CommentRow
          key={comment.id}
          comment={comment}
          disabled={cannotWrite || thread.loading}
          onUpdate={thread.upsert}
          onDelete={thread.remove}
        />
      ))}
      {thread.error && (
        <>
          <CommunityError>{thread.error}</CommunityError>
          <CommunityButton label={text.retry} onPress={thread.retry} disabled={thread.loading} />
        </>
      )}
      <Text style={styles.label}>{text.commentLabel}</Text>
      <TextInput
        accessibilityLabel={text.commentLabel}
        style={[styles.input, styles.multiline]}
        placeholder={text.commentPlaceholder}
        placeholderTextColor={colors.textSubtle}
        multiline
        value={body}
        onChangeText={setBody}
        editable={!cannotWrite && !sending}
      />
      <Text style={styles.muted}>
        {Array.from(body.trim()).length} / {COMMENT_BODY_MAX_LENGTH}
      </Text>
      {commentError && <CommunityError>{commentError}</CommunityError>}
      {notice && (
        <Text style={styles.body} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      )}
      <CommunityButton
        label={sending ? text.sendingComment : text.sendComment}
        onPress={() => void send()}
        disabled={cannotWrite || sending || thread.loading}
      />
    </View>
  );
}
