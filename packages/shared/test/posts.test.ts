import { createClient, type Session } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPost,
  deletePost,
  getPost,
  listPosts,
  updatePost,
  validatePostBody,
  type CommunityLinkClient,
  type Database,
} from '../src';

const userId = '11111111-1111-4111-8111-111111111111';
const postId = '22222222-2222-4222-8222-222222222222';
const date = '2026-10-17T12:00:00.123456+00:00';
const row = { id: postId, author_id: userId, body: 'Hello neighbours', created_at: date };
let client: CommunityLinkClient;
const fetchMock = vi.fn<typeof fetch>();

function respond(data: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function request() {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url: new URL(String(url)), body: init?.body ? JSON.parse(String(init.body)) : null };
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

describe('neighbourhood feed', () => {
  it('filters at the server, selects only public author fields and returns a stable cursor', async () => {
    respond([row, { ...row, id: userId }]);
    const page = await listPosts(client, { neighbourhoodId: 3, limit: 1 });
    expect(page.posts).toEqual([row]);
    expect(page.nextCursor).toEqual({ id: postId, createdAt: date });
    const params = request().url.searchParams;
    expect(params.get('neighbourhood_id')).toBe('eq.3');
    expect(params.get('is_removed')).toBe('eq.false');
    expect(params.get('order')).toBe('created_at.desc,id.desc');
    expect(params.get('limit')).toBe('2');
    expect(params.get('select')).toBe(
      '*,author:profiles!posts_author_id_fkey(id,display_name,avatar_url)',
    );
  });

  it('preserves microseconds and uses the ID to break timestamp ties', async () => {
    respond([row]);
    const page = await listPosts(client, {
      neighbourhoodId: 1,
      cursor: { createdAt: date, id: postId },
    });
    expect(request().url.searchParams.get('or')).toBe(
      `(created_at.lt.${date},and(created_at.eq.${date},id.lt.${postId}))`,
    );
    expect(page.nextCursor).toBeNull();
  });

  it('rejects invalid page sizes, neighbourhoods and injected cursors before querying', async () => {
    for (const options of [
      { neighbourhoodId: 0 },
      { neighbourhoodId: 1, limit: 0 },
      { neighbourhoodId: 1, limit: 51 },
      { neighbourhoodId: 1, cursor: { createdAt: `${date},id.gt.x`, id: postId } },
      { neighbourhoodId: 1, cursor: { createdAt: date, id: 'bad-id' } },
    ])
      await expect(listPosts(client, options)).rejects.toMatchObject({ code: 'validation' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null for an inaccessible post and never queries removed content', async () => {
    respond([]);
    expect(await getPost(client, postId)).toBeNull();
    expect(request().url.searchParams.get('is_removed')).toBe('eq.false');
  });
});

describe('post writes', () => {
  it('derives authorship from the session and sends only allowed input', async () => {
    respond(row);
    await createPost(client, {
      body: '  Hello neighbours  ',
      neighbourhoodId: 1,
      imageUrl: '  ',
      ...({ author_id: postId, is_removed: true } as object),
    });
    expect(request().body).toEqual({
      author_id: userId,
      body: 'Hello neighbours',
      neighbourhood_id: 1,
      image_url: null,
    });
  });

  it('validates blank/long posts, invalid neighbourhoods and unsafe image URLs', async () => {
    for (const input of [
      { body: ' \n\t ' },
      { body: 'a'.repeat(2001) },
      { neighbourhoodId: -1 },
      { imageUrl: 'file:///private.jpg' },
      { imageUrl: 'https://username:password@example.com/photo.jpg' },
    ])
      await expect(
        createPost(client, { body: 'hello', neighbourhoodId: 1, ...input }),
      ).rejects.toMatchObject({ code: 'validation' });
    expect(validatePostBody('😀'.repeat(2000))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('recovers a committed post after a lost response rather than inserting a duplicate', async () => {
    respond({ code: '23505', message: 'duplicate key' }, 409);
    const existing = { ...row, neighbourhood_id: 1, image_url: null };
    respond(existing);
    const result = await createPost(client, {
      body: row.body,
      neighbourhoodId: 1,
      requestId: postId,
    });
    expect(result).toEqual(existing);
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body)).id).toBe(postId);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('saves changes to the same draft after recovering a previous attempt', async () => {
    respond({ code: '23505', message: 'duplicate key' }, 409);
    respond({ ...row, neighbourhood_id: 1, image_url: null });
    respond({ ...row, body: 'Changed' });
    const updated = await createPost(client, {
      body: 'Changed',
      neighbourhoodId: 1,
      requestId: postId,
    });
    expect(updated.body).toBe('Changed');
    expect(request().body).toEqual({ body: 'Changed', image_url: null, neighbourhood_id: 1 });
    expect(request().url.searchParams.get('author_id')).toBe(`eq.${userId}`);
  });

  it('does not take over another author’s ID when recovering a draft', async () => {
    respond({ code: '23505', message: 'duplicate key' }, 409);
    respond({ ...row, author_id: postId });
    await expect(
      createPost(client, { body: 'hello', neighbourhoodId: 1, requestId: postId }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('requires login before writing', async () => {
    vi.mocked(client.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    await expect(createPost(client, { body: 'hello', neighbourhoodId: 1 })).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('restricts editing to the author and ignores protected fields', async () => {
    respond(row);
    await updatePost(client, postId, {
      body: ' Updated ',
      imageUrl: null,
      ...({ author_id: postId, is_removed: false, removed_reason: null } as object),
    });
    expect(request().body).toEqual({ body: 'Updated', image_url: null });
    expect(request().url.searchParams.get('author_id')).toBe(`eq.${userId}`);
    expect(request().url.searchParams.get('is_removed')).toBe('eq.false');
  });

  it('does not claim success when editing or deleting affects no visible own row', async () => {
    respond(null);
    await expect(updatePost(client, postId, { body: 'updated' })).rejects.toMatchObject({
      code: 'not_found',
    });
    respond(null);
    await expect(deletePost(client, postId)).rejects.toMatchObject({ code: 'not_found' });
    expect(request().url.searchParams.get('author_id')).toBe(`eq.${userId}`);
    expect(request().url.searchParams.get('select')).toBe('id');
  });

  it('preserves readable database permission errors', async () => {
    respond({ code: '42501', message: 'new row violates row-level security policy' }, 403);
    await expect(createPost(client, { body: 'hello', neighbourhoodId: 1 })).rejects.toMatchObject({
      code: '42501',
      message: 'You do not have permission to do that.',
    });
  });
});
