import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoBackend, DEMO_ACCOUNTS } from '../src/demo/demoBackend';

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
