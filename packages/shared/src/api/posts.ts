import type { Post, Profile, TablesUpdate } from '../types';
import { requireUserId } from './auth';
import { ApiError, unwrap, type CommunityLinkClient } from './client';

export const POST_BODY_MAX_LENGTH = 2000;

export type PostAuthor = Pick<Profile, 'id' | 'display_name' | 'avatar_url'>;
export type CommunityPost = Post & { author: PostAuthor | null };

// Fetch public presentation fields only, rather than the author's full profile.
const POST_SELECT = '*, author:profiles!posts_author_id_fkey(id, display_name, avatar_url)';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PostFeedCursor {
  createdAt: string;
  id: string;
}

export interface PostFeedPage {
  posts: CommunityPost[];
  nextCursor: PostFeedCursor | null;
}

export interface PostFeedOptions {
  neighbourhoodId: number;
  limit?: number;
  cursor?: PostFeedCursor | null;
  signal?: AbortSignal;
}

export interface CreatePostInput {
  body: string;
  neighbourhoodId: number;
  imageUrl?: string | null;
  /** Keep this UUID for the lifetime of a draft so retries cannot duplicate it. */
  requestId?: string;
}

export interface UpdatePostInput {
  body?: string;
  neighbourhoodId?: number;
  imageUrl?: string | null;
}

function validateId(id: string): void {
  if (!UUID.test(id)) throw new ApiError('Invalid post ID.', 'validation');
}

function validateNeighbourhood(id: number): void {
  if (!Number.isInteger(id) || id < 1 || id > 32767) {
    throw new ApiError('Choose a neighbourhood.', 'validation');
  }
}

export function validatePostBody(body: string): string | null {
  if (!body.trim()) return 'Write something before publishing your post.';
  // Postgres char_length counts Unicode code points, including emoji as one.
  if (Array.from(body.trim()).length > POST_BODY_MAX_LENGTH) {
    return `Posts must be ${POST_BODY_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export function validatePostImageUrl(value: string): string | null {
  if (!value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      value.trim().length <= 2048
    ) {
      return null;
    }
  } catch {
    // Show the same readable validation message for malformed or unsafe URLs.
  }
  return 'Use an HTTPS image URL without a username or password.';
}

function normalizedBody(body: string): string {
  const error = validatePostBody(body);
  if (error) throw new ApiError(error, 'validation');
  return body.trim();
}

function normalizedImage(value: string | null): string | null {
  const error = validatePostImageUrl(value ?? '');
  if (error) throw new ApiError(error, 'validation');
  return value?.trim() || null;
}

/** Latest visible posts in one neighbourhood. RLS also hides blocked authors. */
export async function listPosts(
  client: CommunityLinkClient,
  { neighbourhoodId, limit = 20, cursor, signal }: PostFeedOptions,
): Promise<PostFeedPage> {
  validateNeighbourhood(neighbourhoodId);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new ApiError('The feed page size must be between 1 and 50.', 'validation');
  }
  if (cursor) {
    validateId(cursor.id);
    // Keep the database's microseconds intact, and reject PostgREST filter syntax.
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        cursor.createdAt,
      ) ||
      !Number.isFinite(Date.parse(cursor.createdAt))
    ) {
      throw new ApiError('Invalid feed cursor.', 'validation');
    }
  }
  let query = client
    .from('posts')
    .select(POST_SELECT)
    .eq('neighbourhood_id', neighbourhoodId)
    .eq('is_removed', false)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }
  const rows = unwrap(await (signal ? query.abortSignal(signal) : query));
  const posts = rows.slice(0, limit);
  const last = posts.at(-1);
  return {
    posts,
    nextCursor: rows.length > limit && last ? { createdAt: last.created_at, id: last.id } : null,
  };
}

/** Returns null for a missing, removed or blocked post. */
export async function getPost(
  client: CommunityLinkClient,
  id: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<CommunityPost | null> {
  validateId(id);
  const query = client.from('posts').select(POST_SELECT).eq('id', id).eq('is_removed', false);
  return unwrap(await (signal ? query.abortSignal(signal) : query).maybeSingle());
}

export async function createPost(
  client: CommunityLinkClient,
  input: CreatePostInput,
): Promise<CommunityPost> {
  const body = normalizedBody(input.body);
  validateNeighbourhood(input.neighbourhoodId);
  const imageUrl = normalizedImage(input.imageUrl ?? null);
  if (input.requestId !== undefined) validateId(input.requestId);
  const authorId = await requireUserId(client);
  const result = await client
    .from('posts')
    .insert({
      ...(input.requestId ? { id: input.requestId } : {}),
      author_id: authorId,
      body,
      neighbourhood_id: input.neighbourhoodId,
      image_url: imageUrl,
    })
    .select(POST_SELECT)
    .single();
  if (result.error?.code === '23505' && input.requestId) {
    // A previous attempt may have committed before its response was lost.
    const existing = await getPost(client, input.requestId);
    if (!existing || existing.author_id !== authorId) {
      throw new ApiError(
        'This draft is unavailable. Refresh the feed before continuing.',
        'conflict',
      );
    }
    if (
      existing.body === body &&
      existing.image_url === imageUrl &&
      existing.neighbourhood_id === input.neighbourhoodId
    )
      return existing;
    // If the user edited the failed draft, save those changes to the same post.
    return updatePost(client, input.requestId, {
      body,
      imageUrl,
      neighbourhoodId: input.neighbourhoodId,
    });
  }
  return unwrap(result);
}

export async function updatePost(
  client: CommunityLinkClient,
  id: string,
  input: UpdatePostInput,
): Promise<CommunityPost> {
  validateId(id);
  // Explicitly construct the patch so callers cannot write protected columns.
  const patch: TablesUpdate<'posts'> = {};
  if (input.body !== undefined) patch.body = normalizedBody(input.body);
  if (input.neighbourhoodId !== undefined) {
    validateNeighbourhood(input.neighbourhoodId);
    patch.neighbourhood_id = input.neighbourhoodId;
  }
  if (input.imageUrl !== undefined) patch.image_url = normalizedImage(input.imageUrl);
  if (!Object.keys(patch).length) throw new ApiError('No changes to save.', 'validation');
  const authorId = await requireUserId(client);
  const post = unwrap(
    await client
      .from('posts')
      .update(patch)
      .eq('id', id)
      .eq('author_id', authorId)
      .eq('is_removed', false)
      .select(POST_SELECT)
      .maybeSingle(),
  );
  if (!post) throw new ApiError('This post is unavailable or you cannot edit it.', 'not_found');
  return post;
}

export async function deletePost(client: CommunityLinkClient, id: string): Promise<void> {
  validateId(id);
  const authorId = await requireUserId(client);
  const deleted = unwrap(
    await client
      .from('posts')
      .delete()
      .eq('id', id)
      .eq('author_id', authorId)
      .eq('is_removed', false)
      .select('id')
      .maybeSingle(),
  );
  if (!deleted)
    throw new ApiError('This post is unavailable or you cannot delete it.', 'not_found');
}
