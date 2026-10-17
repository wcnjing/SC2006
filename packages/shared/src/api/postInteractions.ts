import type { Comment, PostLike } from '../types';
import { requireUserId } from './auth';
import { ApiError, toApiError, unwrap, type CommunityLinkClient } from './client';
import { getPost, type PostAuthor, type PostFeedCursor } from './posts';

export const COMMENT_BODY_MAX_LENGTH = 1000;
export type CommunityComment = Comment & { author: PostAuthor | null };
export interface CommentPage {
  comments: CommunityComment[];
  nextCursor: PostFeedCursor | null;
}
export interface CommentListOptions {
  limit?: number;
  cursor?: PostFeedCursor | null;
  signal?: AbortSignal;
}
export interface CreateCommentInput {
  postId: string;
  body: string;
  requestId?: string;
}
export interface PostLikeState {
  likeCount: number;
  likedByMe: boolean;
}

const COMMENT_SELECT = '*, author:profiles!comments_author_id_fkey(id, display_name, avatar_url)';
const VISIBLE_COMMENT_SELECT = `${COMMENT_SELECT}, post:posts!inner(id, is_removed)`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validId(id: string) {
  if (!UUID.test(id)) throw new ApiError('Invalid post or comment ID.', 'validation');
}
export function validateCommentBody(body: string): string | null {
  if (!body.trim()) return 'Write a comment before sending.';
  if (Array.from(body.trim()).length > COMMENT_BODY_MAX_LENGTH)
    return `Comments must be ${COMMENT_BODY_MAX_LENGTH} characters or fewer.`;
  return null;
}
function commentBody(body: string): string {
  const error = validateCommentBody(body);
  if (error) throw new ApiError(error, 'validation');
  return body.trim();
}

/** Fetch the newest page, displayed chronologically. The cursor loads older comments. */
export async function listComments(
  client: CommunityLinkClient,
  postId: string,
  { limit = 20, cursor, signal }: CommentListOptions = {},
): Promise<CommentPage> {
  validId(postId);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new ApiError('Comment page size must be between 1 and 50.', 'validation');
  if (cursor) {
    validId(cursor.id);
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        cursor.createdAt,
      ) ||
      !Number.isFinite(Date.parse(cursor.createdAt))
    ) {
      throw new ApiError('Invalid comment cursor.', 'validation');
    }
  }
  let query = client
    .from('comments')
    .select(VISIBLE_COMMENT_SELECT)
    .eq('post_id', postId)
    .eq('is_removed', false)
    .eq('post.is_removed', false)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
  if (cursor)
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  const rows = unwrap(await (signal ? query.abortSignal(signal) : query));
  const comments = rows
    .slice(0, limit)
    .reverse()
    .map(({ post: _parent, ...comment }) => comment);
  const oldest = comments[0];
  return {
    comments,
    nextCursor:
      rows.length > limit && oldest ? { createdAt: oldest.created_at, id: oldest.id } : null,
  };
}

export async function createComment(
  client: CommunityLinkClient,
  input: CreateCommentInput,
): Promise<CommunityComment> {
  validId(input.postId);
  if (input.requestId !== undefined) validId(input.requestId);
  const body = commentBody(input.body);
  const authorId = await requireUserId(client);
  const result = await client
    .from('comments')
    .insert({
      ...(input.requestId ? { id: input.requestId } : {}),
      post_id: input.postId,
      author_id: authorId,
      body,
    })
    .select(COMMENT_SELECT)
    .single();
  if (result.error?.code === '23505' && input.requestId) {
    const response = await client
      .from('comments')
      .select(VISIBLE_COMMENT_SELECT)
      .eq('id', input.requestId)
      .eq('post_id', input.postId)
      .eq('author_id', authorId)
      .eq('is_removed', false)
      .eq('post.is_removed', false)
      .maybeSingle();
    const existing = unwrap(response);
    if (!existing)
      throw new ApiError(
        'This comment is unavailable. Refresh the comments before continuing.',
        'conflict',
      );
    if (existing.body !== body) return updateComment(client, existing.id, body);
    const { post: _parent, ...comment } = existing;
    return comment;
  }
  return unwrap(result);
}

export async function updateComment(
  client: CommunityLinkClient,
  id: string,
  body: string,
): Promise<CommunityComment> {
  validId(id);
  const normalized = commentBody(body);
  const authorId = await requireUserId(client);
  const comment = unwrap(
    await client
      .from('comments')
      .update({ body: normalized })
      .eq('id', id)
      .eq('author_id', authorId)
      .eq('is_removed', false)
      .select(COMMENT_SELECT)
      .maybeSingle(),
  );
  if (!comment)
    throw new ApiError('This comment is unavailable or you cannot edit it.', 'not_found');
  return comment;
}

export async function deleteComment(client: CommunityLinkClient, id: string): Promise<void> {
  validId(id);
  const authorId = await requireUserId(client);
  const deleted = unwrap(
    await client
      .from('comments')
      .delete()
      .eq('id', id)
      .eq('author_id', authorId)
      .eq('is_removed', false)
      .select('id')
      .maybeSingle(),
  );
  if (!deleted)
    throw new ApiError('This comment is unavailable or you cannot delete it.', 'not_found');
}

export async function getPostLikeState(
  client: CommunityLinkClient,
  postId: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<PostLikeState> {
  validId(postId);
  const userId = await requireUserId(client);
  if (!(await getPost(client, postId, { signal })))
    throw new ApiError('This post is unavailable.', 'not_found');
  const countQuery = client
    .from('post_likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);
  const mineQuery = client
    .from('post_likes')
    .select('user_id')
    .eq('post_id', postId)
    .eq('user_id', userId);
  const [count, mine] = await Promise.all([
    signal ? countQuery.abortSignal(signal) : countQuery,
    (signal ? mineQuery.abortSignal(signal) : mineQuery).maybeSingle(),
  ]);
  if (count.error) throw toApiError(count.error);
  const ownLike = unwrap(mine);
  return { likeCount: count.count ?? 0, likedByMe: ownLike !== null };
}

/** Set an explicit desired state, making repeated taps/retries idempotent. */
export async function setPostLiked(
  client: CommunityLinkClient,
  postId: string,
  liked: boolean,
): Promise<PostLikeState> {
  validId(postId);
  if (typeof liked !== 'boolean') throw new ApiError('Invalid like state.', 'validation');
  const userId = await requireUserId(client);
  if (!(await getPost(client, postId)))
    throw new ApiError('This post is unavailable.', 'not_found');
  if (liked) {
    const row: Pick<PostLike, 'post_id' | 'user_id'> = { post_id: postId, user_id: userId };
    unwrap(
      await client
        .from('post_likes')
        .upsert(row, { onConflict: 'post_id,user_id', ignoreDuplicates: true }),
    );
  } else {
    unwrap(await client.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId));
  }
  const state = await getPostLikeState(client, postId);
  if (state.likedByMe !== liked)
    throw new ApiError('Unable to change your like. Refresh and try again.', '42501');
  return state;
}
