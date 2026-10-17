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

describe('demo reports', () => {
  const requestId = '88888888-8888-4888-8888-888888888888';
  const postId = '33333333-3333-4333-8333-000000000001';
  const input = { targetType: 'post' as const, targetId: postId, reason: 'Spam', requestId };

  it('keeps reports private across residents and persists after content deletion', async () => {
    backend.signIn(DEMO_ACCOUNTS[0].email);
    const report = await backend.submitReport({ ...input, details: '  Unwanted advertising  ' });
    expect(report.status).toBe('open');
    expect(report.details).toBe('Unwanted advertising');
    const restored = createDemoBackend(storage);
    expect((await restored.listMyReports()).reports.map((row) => row.id)).toEqual([report.id]);
    restored.signIn(DEMO_ACCOUNTS[1].email);
    expect((await restored.listMyReports()).reports).toEqual([]);
    await expect(restored.submitReport(input)).rejects.toMatchObject({ code: 'conflict' });
    restored.signIn(DEMO_ACCOUNTS[0].email);
    await restored.deletePost(postId);
    expect((await restored.listMyReports()).reports[0].id).toBe(report.id);
    expect((await restored.submitReport({ ...input, details: 'Unwanted advertising' })).id).toBe(
      report.id,
    );
    expect((await restored.listMyReports()).reports).toHaveLength(1);
    await expect(restored.submitReport({ ...input, reason: 'Changed' })).rejects.toMatchObject({
      code: 'conflict',
    });
  });

  it('supports comment reports, rejects missing/removed parents and retains review outcomes', async () => {
    backend.signIn(DEMO_ACCOUNTS[0].email);
    const comment = await backend.createComment({ postId, body: 'Reported comment' });
    await backend.submitReport({ ...input, targetType: 'comment', targetId: comment.id });
    await backend.deleteComment(comment.id);
    await expect(
      backend.submitReport({
        ...input,
        targetType: 'comment',
        targetId: comment.id,
        requestId: '99999999-9999-4999-8999-999999999999',
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
    const state = JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!);
    state.reports[0].status = 'dismissed';
    state.reports[0].resolution_note = 'Reviewed; no policy violation';
    state.posts.find((row: { id: string }) => row.id === postId).is_removed = true;
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    expect((await backend.listMyReports()).reports[0]).toMatchObject({
      status: 'dismissed',
      resolution_note: 'Reviewed; no policy violation',
    });
    await expect(
      backend.submitReport({ ...input, requestId: '99999999-9999-4999-8999-999999999999' }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('validates reasons, details, target types, authentication and page bounds', async () => {
    await expect(backend.submitReport(input)).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(backend.listMyReports()).rejects.toMatchObject({ code: 'unauthenticated' });
    backend.signIn(DEMO_ACCOUNTS[0].email);
    for (const changes of [
      { reason: ' \n ' },
      { reason: 'x'.repeat(101) },
      { details: 'x'.repeat(1001) },
      { targetId: 'bad' },
      { requestId: 'bad' },
      { targetType: 'user' as 'post' },
    ])
      await expect(backend.submitReport({ ...input, ...changes })).rejects.toMatchObject({
        code: 'validation',
      });
    await expect(backend.listMyReports({ limit: 51 })).rejects.toMatchObject({
      code: 'validation',
    });
    expect((await backend.listMyReports()).reports).toEqual([]);
  });

  it('paginates tied timestamps without leaking another resident’s history', async () => {
    backend.signIn(DEMO_ACCOUNTS[0].email);
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 25; i++)
        await backend.submitReport({
          ...input,
          requestId: `88888888-8888-4888-8888-${String(i).padStart(12, '0')}`,
        });
    } finally {
      vi.useRealTimers();
    }
    backend.signIn(DEMO_ACCOUNTS[1].email);
    await backend.submitReport({ ...input, reason: 'Private to Mei' });
    backend.signIn(DEMO_ACCOUNTS[0].email);
    const first = await backend.listMyReports();
    const second = await backend.listMyReports({ cursor: first.nextCursor });
    expect(first.reports).toHaveLength(20);
    expect(second.reports).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    const rows = [...first.reports, ...second.reports];
    expect(new Set(rows.map((row) => row.id)).size).toBe(25);
    expect(rows.every((row) => row.reporter_id === DEMO_ACCOUNTS[0].profile.id)).toBe(true);
    expect(rows.map((row) => row.id)).toEqual(
      rows
        .map((row) => row.id)
        .sort()
        .reverse(),
    );
  });

  it('adds report storage without discarding older demo posts, comments or likes', async () => {
    backend.signIn(DEMO_ACCOUNTS[0].email);
    await backend.createComment({ postId, body: 'Keep this' });
    await backend.setPostLiked(postId, true);
    const state = JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!);
    delete state.reports;
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    const restored = createDemoBackend(storage);
    expect((await restored.listMyReports()).reports).toEqual([]);
    expect((await restored.listComments(postId)).comments[0].body).toBe('Keep this');
    expect((await restored.getPostLikeState(postId)).likedByMe).toBe(true);
    expect((await restored.getPost(postId))?.body).toBeTruthy();
  });
});
