import { createClient, type Session } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createComment,
  deleteComment,
  getPostLikeState,
  listComments,
  setPostLiked,
  updateComment,
  validateCommentBody,
  type CommunityLinkClient,
  type Database,
} from '../src';

const userId = '11111111-1111-4111-8111-111111111111';
const postId = '22222222-2222-4222-8222-222222222222';
const commentId = '33333333-3333-4333-8333-333333333333';
const olderId = '33333333-3333-4333-8333-333333333332';
const date = '2026-10-17T12:00:00.123456+00:00';
const post = { id: postId, is_removed: false };
const comment = {
  id: commentId,
  post_id: postId,
  author_id: userId,
  body: 'Hello',
  created_at: date,
  post,
  author: { id: userId, display_name: 'Yining', avatar_url: null },
};
const fetchMock = vi.fn<typeof fetch>();
let client: CommunityLinkClient;
function respond(data: unknown, status = 200, count?: number) {
  fetchMock.mockResolvedValueOnce(
    new Response(data === undefined ? null : JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...(count === undefined ? {} : { 'Content-Range': `0-0/${count}` }),
      },
    }),
  );
}
function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return {
    url: new URL(String(url)),
    init,
    body: init?.body ? JSON.parse(String(init.body)) : null,
  };
}
beforeEach(() => {
  fetchMock.mockReset();
  client = createClient<Database>('http://localhost:54321', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchMock },
  });
  vi.spyOn(client.auth, 'getSession').mockResolvedValue({
    data: { session: { user: { id: userId } } as Session },
    error: null,
  });
});

describe('comments', () => {
  it('loads chronological pages with stable cursors, visible parents and public author fields', async () => {
    respond([comment, { ...comment, id: olderId }, { ...comment, id: userId }]);
    const page = await listComments(client, postId, { limit: 2 });
    expect(page.comments.map((row) => row.id)).toEqual([olderId, commentId]);
    expect(page.comments[0]).not.toHaveProperty('post');
    expect(page.nextCursor).toEqual({ id: olderId, createdAt: date });
    const query = lastRequest().url.searchParams;
    expect(query.get('select')).toContain(
      'author:profiles!comments_author_id_fkey(id,display_name,avatar_url)',
    );
    expect(query.get('select')).toContain('post:posts!inner');
    expect(query.get('post_id')).toBe(`eq.${postId}`);
    expect(query.get('post.is_removed')).toBe('eq.false');
    expect(query.get('is_removed')).toBe('eq.false');
    expect(query.get('order')).toBe('created_at.desc,id.desc');
    respond([]);
    await listComments(client, postId, { cursor: page.nextCursor });
    expect(lastRequest().url.searchParams.get('or')).toBe(
      `(created_at.lt.${date},and(created_at.eq.${date},id.lt.${olderId}))`,
    );
  });

  it('rejects invalid IDs, page bounds and cursor syntax before querying', async () => {
    await expect(listComments(client, 'invalid')).rejects.toMatchObject({ code: 'validation' });
    await expect(listComments(client, postId, { limit: 51 })).rejects.toMatchObject({
      code: 'validation',
    });
    await expect(
      listComments(client, postId, { cursor: { createdAt: `${date},id.gt.x`, id: commentId } }),
    ).rejects.toMatchObject({ code: 'validation' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trims content and derives authorship without accepting protected fields', async () => {
    respond(comment);
    await createComment(client, {
      postId,
      body: '  Hello  ',
      requestId: commentId,
      ...({ author_id: postId, is_removed: true } as object),
    });
    expect(lastRequest().body).toEqual({
      id: commentId,
      post_id: postId,
      author_id: userId,
      body: 'Hello',
    });
  });

  it('validates whitespace, Unicode character limits and authentication before writing', async () => {
    for (const body of [' \n\t ', 'x'.repeat(1001)])
      await expect(createComment(client, { postId, body })).rejects.toMatchObject({
        code: 'validation',
      });
    expect(validateCommentBody('😀'.repeat(1000))).toBeNull();
    vi.mocked(client.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    await expect(createComment(client, { postId, body: 'hello' })).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('recovers the same comment after a lost response without duplicating it', async () => {
    respond({ code: '23505', message: 'duplicate key' }, 409);
    respond([comment]);
    const saved = await createComment(client, { postId, body: 'Hello', requestId: commentId });
    expect(saved.id).toBe(commentId);
    expect(lastRequest().url.searchParams.get('author_id')).toBe(`eq.${userId}`);
    expect(lastRequest().url.searchParams.get('post_id')).toBe(`eq.${postId}`);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not recover a draft belonging to someone else or removed content', async () => {
    respond({ code: '23505', message: 'duplicate key' }, 409);
    respond([]);
    await expect(
      createComment(client, { postId, body: 'Hello', requestId: commentId }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('edits only the body of an own comment and treats unavailable writes as failures', async () => {
    respond(comment);
    await updateComment(client, commentId, '  Edited  ');
    expect(lastRequest().body).toEqual({ body: 'Edited' });
    expect(lastRequest().url.searchParams.get('author_id')).toBe(`eq.${userId}`);
    expect(lastRequest().url.searchParams.get('is_removed')).toBe('eq.false');
    respond(null);
    await expect(updateComment(client, commentId, 'Edited')).rejects.toMatchObject({
      code: 'not_found',
    });
    respond(null);
    await expect(deleteComment(client, commentId)).rejects.toMatchObject({ code: 'not_found' });
    expect(lastRequest().url.searchParams.get('author_id')).toBe(`eq.${userId}`);
  });
});

describe('likes', () => {
  it('returns the exact count and current resident state without exposing other liker profiles', async () => {
    respond([post]);
    respond(undefined, 200, 3);
    respond([{ user_id: userId }]);
    expect(await getPostLikeState(client, postId)).toEqual({ likeCount: 3, likedByMe: true });
    expect(fetchMock.mock.calls[1]![1]?.method).toBe('HEAD');
    expect(lastRequest().url.searchParams.get('user_id')).toBe(`eq.${userId}`);
    expect(lastRequest().url.searchParams.get('select')).toBe('user_id');
  });

  it('sets liked using duplicate-ignore insertion and reads the confirmed result', async () => {
    respond([post]);
    respond(null, 201);
    respond([post]);
    respond(undefined, 200, 1);
    respond([{ user_id: userId }]);
    expect(await setPostLiked(client, postId, true)).toEqual({ likeCount: 1, likedByMe: true });
    const [, init] = fetchMock.mock.calls[1]!;
    expect(JSON.parse(String(init?.body))).toEqual({ post_id: postId, user_id: userId });
    expect(new Headers(init?.headers).get('Prefer')).toContain('resolution=ignore-duplicates');
  });

  it('unlikes only the current resident and verifies the resulting state', async () => {
    respond([post]);
    respond(null);
    respond([post]);
    respond(undefined, 200, 1);
    respond([]);
    expect(await setPostLiked(client, postId, false)).toEqual({ likeCount: 1, likedByMe: false });
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(init?.method).toBe('DELETE');
    expect(new URL(String(url)).searchParams.get('user_id')).toBe(`eq.${userId}`);
  });

  it('rejects hidden/removed posts before changing a like', async () => {
    respond([]);
    await expect(setPostLiked(client, postId, true)).rejects.toMatchObject({ code: 'not_found' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not claim an unlike succeeded when the database refused deletion', async () => {
    respond([post]);
    respond(null);
    respond([post]);
    respond(undefined, 200, 1);
    respond([{ user_id: userId }]);
    await expect(setPostLiked(client, postId, false)).rejects.toMatchObject({ code: '42501' });
  });
});
