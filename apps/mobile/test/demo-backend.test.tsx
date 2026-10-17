import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoBackend, DEMO_ACCOUNTS, DEMO_STORAGE_KEY } from '../src/demo/demoBackend';

vi.mock('expo-crypto', () => ({ randomUUID: () => '44444444-4444-4444-8444-444444444444' }));
let storage: Storage;
let backend: ReturnType<typeof createDemoBackend>;
beforeEach(() => {
  const values = new Map<string, string>();
  storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  } as Storage;
  backend = createDemoBackend(storage);
});

describe('local demo posts', () => {
  it('requires a demo resident, persists posts and restores the selected resident', async () => {
    await expect(backend.listPosts({ neighbourhoodId: 1 })).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    backend.signIn(DEMO_ACCOUNTS[0].email);
    const post = await backend.createPost({ body: '  Local post  ', neighbourhoodId: 1 });
    expect(post.body).toBe('Local post');
    const restored = createDemoBackend(storage);
    expect(restored.getProfile()?.display_name).toBe('Yining');
    expect((await restored.getPost(post.id))?.body).toBe('Local post');
  });

  it('supports edits, idempotent retry and deletion while enforcing ownership', async () => {
    backend.signIn(DEMO_ACCOUNTS[0].email);
    const input = {
      body: 'Original',
      neighbourhoodId: 1,
      requestId: '44444444-4444-4444-8444-444444444444',
    };
    const first = await backend.createPost(input);
    expect((await backend.createPost({ ...input, body: 'Retried' })).id).toBe(first.id);
    backend.signIn(DEMO_ACCOUNTS[1].email);
    await expect(backend.updatePost(first.id, { body: 'Not mine' })).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(backend.deletePost(first.id)).rejects.toMatchObject({ code: 'not_found' });
    backend.signIn(DEMO_ACCOUNTS[0].email);
    expect((await backend.updatePost(first.id, { body: 'Edited' })).body).toBe('Edited');
    await backend.deletePost(first.id);
    expect(await backend.getPost(first.id)).toBeNull();
  });

  it('paginates neighbourhood feeds without duplicate IDs and supports empty neighbourhoods', async () => {
    backend.signIn(DEMO_ACCOUNTS[0].email);
    const first = await backend.listPosts({ neighbourhoodId: 1 });
    const second = await backend.listPosts({ neighbourhoodId: 1, cursor: first.nextCursor });
    expect(first.posts).toHaveLength(20);
    expect(second.posts).toHaveLength(4);
    expect(new Set([...first.posts, ...second.posts].map((post) => post.id)).size).toBe(24);
    expect(second.nextCursor).toBeNull();
    expect((await backend.listPosts({ neighbourhoodId: 4 })).posts).toEqual([]);
  });

  it('rejects invalid input without adding a partial post and resets only demo data', async () => {
    backend.signIn(DEMO_ACCOUNTS[0].email);
    for (const input of [
      { body: '   ', neighbourhoodId: 1 },
      { body: 'hello', neighbourhoodId: 99 },
      { body: 'hello', neighbourhoodId: 1, imageUrl: 'file:///photo.jpg' },
    ]) {
      await expect(backend.createPost(input)).rejects.toMatchObject({ code: 'validation' });
    }
    expect((await backend.listPosts({ neighbourhoodId: 1 })).posts).toHaveLength(20);
    storage.setItem('real-auth-session', 'preserve me');
    backend.reset();
    expect(backend.getProfile()).toBeNull();
    expect(storage.getItem('real-auth-session')).toBe('preserve me');
  });
});

describe('demo comments and likes', () => {
  const postInput = {
    body: 'Discuss here',
    neighbourhoodId: 1,
    requestId: '55555555-5555-4555-8555-555555555555',
  };
  const requestId = '66666666-6666-4666-8666-666666666666';

  it('persists comment CRUD and protects other residents’ comments', async () => {
    backend.signIn(DEMO_ACCOUNTS[0].email);
    const post = await backend.createPost(postInput);
    const comment = await backend.createComment({ postId: post.id, body: '  Hello  ', requestId });
    expect(comment.body).toBe('Hello');
    expect(comment.author?.display_name).toBe('Yining');
    const retry = await backend.createComment({
      postId: post.id,
      body: 'Updated retry',
      requestId,
    });
    expect(retry.id).toBe(comment.id);
    expect((await backend.listComments(post.id)).comments).toHaveLength(1);
    const restored = createDemoBackend(storage);
    expect((await restored.listComments(post.id)).comments[0].body).toBe('Updated retry');
    restored.signIn(DEMO_ACCOUNTS[1].email);
    await expect(restored.updateComment(comment.id, 'Not mine')).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(restored.deleteComment(comment.id)).rejects.toMatchObject({ code: 'not_found' });
    restored.signIn(DEMO_ACCOUNTS[0].email);
    expect((await restored.updateComment(comment.id, 'Edited')).body).toBe('Edited');
    await restored.deleteComment(comment.id);
    expect((await restored.listComments(post.id)).comments).toEqual([]);
  });

  it('keeps one like per resident and unlikes without removing anyone else’s like', async () => {
    backend.signIn(DEMO_ACCOUNTS[0].email);
    const post = await backend.createPost(postInput);
    expect(await backend.getPostLikeState(post.id)).toEqual({ likeCount: 0, likedByMe: false });
    await backend.setPostLiked(post.id, true);
    expect(await backend.setPostLiked(post.id, true)).toEqual({ likeCount: 1, likedByMe: true });
    backend.signIn(DEMO_ACCOUNTS[1].email);
    expect(await backend.getPostLikeState(post.id)).toEqual({ likeCount: 1, likedByMe: false });
    await backend.setPostLiked(post.id, true);
    expect(await createDemoBackend(storage).getPostLikeState(post.id)).toEqual({
      likeCount: 2,
      likedByMe: true,
    });
    expect(await backend.setPostLiked(post.id, false)).toEqual({ likeCount: 1, likedByMe: false });
    expect(await backend.setPostLiked(post.id, false)).toEqual({ likeCount: 1, likedByMe: false });
  });

  it('paginates comments chronologically with ID tie breakers', async () => {
    backend.signIn(DEMO_ACCOUNTS[0].email);
    const post = await backend.createPost(postInput);
    for (let index = 0; index < 25; index++) {
      await backend.createComment({
        postId: post.id,
        body: `Comment ${index}`,
        requestId: `77777777-7777-4777-8777-${String(index).padStart(12, '0')}`,
      });
    }
    const first = await backend.listComments(post.id);
    const second = await backend.listComments(post.id, { cursor: first.nextCursor });
    expect(first.comments).toHaveLength(20);
    expect(second.comments).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    const comments = [...second.comments, ...first.comments];
    expect(comments.map((comment) => comment.body)).toEqual(
      Array.from({ length: 25 }, (_, i) => `Comment ${i}`),
    );
    expect(new Set(comments.map((comment) => comment.id)).size).toBe(25);
  });

  it('upgrades existing local data without losing posts, and cascades post deletion', async () => {
    backend.signIn(DEMO_ACCOUNTS[0].email);
    const post = await backend.createPost(postInput);
    const legacy = JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!);
    delete legacy.comments;
    delete legacy.likes;
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(legacy));
    const restored = createDemoBackend(storage);
    expect((await restored.getPost(post.id))?.body).toBe(postInput.body);
    expect(restored.getProfile()?.display_name).toBe('Yining');
    await restored.createComment({ postId: post.id, body: 'Hello', requestId });
    await restored.setPostLiked(post.id, true);
    await restored.deletePost(post.id);
    const state = JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!);
    expect(state.comments).toEqual([]);
    expect(state.likes).toEqual([]);
    await expect(restored.setPostLiked(post.id, true)).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      restored.createComment({ postId: post.id, body: 'Too late', requestId }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('validates comment bodies before saving', async () => {
    backend.signIn(DEMO_ACCOUNTS[0].email);
    const post = await backend.createPost(postInput);
    for (const body of [' \n\t ', 'x'.repeat(1001)]) {
      await expect(
        backend.createComment({ postId: post.id, body, requestId }),
      ).rejects.toMatchObject({ code: 'validation' });
    }
    expect((await backend.listComments(post.id)).comments).toEqual([]);
  });
});
