import { beforeEach, expect, it, vi } from 'vitest';
import { connectionRequestRef } from '@communitylink/shared';
import { createDemoBackend, DEMO_ACCOUNTS, DEMO_STORAGE_KEY } from '../src/demo/demoBackend';

const a = DEMO_ACCOUNTS[0],
  b = DEMO_ACCOUNTS[1],
  admin = DEMO_ACCOUNTS[2];
const id = '66666666-6666-4666-8666-666666666666';
const secondId = '77777777-7777-4777-8777-777777777777';
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
async function friends() {
  backend.signIn(a.email);
  const row = await backend.sendConnectionRequest(b.profile.id);
  backend.signIn(b.email);
  await backend.acceptConnectionRequest(connectionRequestRef(row));
  backend.signIn(a.email);
}

it('requires acceptance and privately persists two-way messages with duplicate-safe retries', async () => {
  backend.signIn(a.email);
  await expect(
    backend.sendDirectMessage({ recipientId: b.profile.id, body: 'Hello', requestId: id }),
  ).rejects.toMatchObject({ code: '42501' });
  await friends();
  const input = { recipientId: b.profile.id, body: '  Hello Mei  ', requestId: id };
  expect((await backend.sendDirectMessage(input)).body).toBe('Hello Mei');
  await backend.sendDirectMessage(input);
  await expect(
    backend.sendDirectMessage({ ...input, body: 'Changed draft' }),
  ).rejects.toMatchObject({ code: '40001' });
  backend.signIn(b.email);
  await backend.sendDirectMessage({
    recipientId: a.profile.id,
    body: 'Hello Yining',
    requestId: secondId,
  });
  expect(
    (await createDemoBackend(storage).listDirectMessages(a.profile.id)).messages.map(
      (row) => row.body,
    ),
  ).toEqual(['Hello Mei', 'Hello Yining']);
  backend.signIn(admin.email);
  expect((await backend.listDirectMessages(a.profile.id)).messages).toEqual([]);
  expect((await backend.getDirectConversation(a.profile.id))?.canSend).toBe(false);
});

it('blocking atomically removes friendships, hides history and blocks requests until reconnection', async () => {
  await friends();
  await backend.sendDirectMessage({
    recipientId: b.profile.id,
    body: 'Keep the history',
    requestId: id,
  });
  await backend.blockUser(b.profile.id);
  await backend.blockUser(b.profile.id);
  expect((await backend.listConnections()).connections).toEqual([]);
  expect((await backend.listDirectMessages(b.profile.id)).messages).toEqual([]);
  expect((await backend.listBlockedUsers()).users.map((row) => row.id)).toEqual([b.profile.id]);
  expect(await backend.getDirectConversation(b.profile.id)).toMatchObject({
    connected: false,
    blockedByMe: true,
    canSend: false,
  });
  expect(JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!).messages).toHaveLength(1);
  backend.signIn(b.email);
  expect((await backend.listBlockedUsers()).users).toEqual([]);
  expect((await backend.listConnections()).connections).toEqual([]);
  await expect(
    backend.sendDirectMessage({ recipientId: a.profile.id, body: 'Blocked', requestId: secondId }),
  ).rejects.toMatchObject({ code: '42501' });
  await expect(backend.sendConnectionRequest(a.profile.id)).rejects.toMatchObject({
    code: '42501',
  });
  backend.signIn(a.email);
  await backend.unblockUser(b.profile.id);
  await backend.unblockUser(b.profile.id);
  expect((await backend.getDirectConversation(b.profile.id))?.connected).toBe(false);
  expect((await backend.listDirectMessages(b.profile.id)).messages).toEqual([]);
  await friends();
  expect((await backend.listDirectMessages(b.profile.id)).messages[0].body).toBe(
    'Keep the history',
  );
});

it('hides blocked posts/comments both ways while preserving unrelated content and admin review', async () => {
  backend.signIn(admin.email);
  const post = await backend.createPost({
    body: 'Third-party post',
    neighbourhoodId: 1,
    requestId: id,
  });
  backend.signIn(b.email);
  await backend.createComment({ postId: post.id, body: 'Comment from Mei', requestId: secondId });
  backend.signIn(a.email);
  await backend.blockUser(b.profile.id);
  expect((await backend.listComments(post.id)).comments).toEqual([]);
  expect(
    (await backend.listPosts({ neighbourhoodId: 1 })).posts.every(
      (row) => row.author_id !== b.profile.id,
    ),
  ).toBe(true);
  expect(await backend.getPost('33333333-3333-4333-8333-000000000002')).toBeNull();
  backend.signIn(b.email);
  expect(await backend.getPost('33333333-3333-4333-8333-000000000001')).toBeNull();
  backend.signIn(admin.email);
  expect((await backend.listComments(post.id)).comments).toHaveLength(1);
});

it('unblocking removes only the caller’s block, including when both users blocked each other', async () => {
  await friends();
  await backend.blockUser(b.profile.id);
  backend.signIn(b.email);
  await backend.blockUser(a.profile.id);
  backend.signIn(a.email);
  await backend.unblockUser(b.profile.id);
  expect((await backend.listBlockedUsers()).users).toEqual([]);
  await expect(backend.sendConnectionRequest(b.profile.id)).rejects.toMatchObject({
    code: '42501',
  });
  backend.signIn(b.email);
  expect((await backend.listBlockedUsers()).users).toHaveLength(1);
});

it('rejects invalid content, self blocks, anonymous and suspended writes', async () => {
  await expect(backend.blockUser(b.profile.id)).rejects.toMatchObject({ code: 'unauthenticated' });
  await friends();
  for (const body of [' \n ', 'x'.repeat(2001)])
    await expect(
      backend.sendDirectMessage({ recipientId: b.profile.id, body, requestId: id }),
    ).rejects.toMatchObject({ code: 'validation' });
  await expect(backend.blockUser(a.profile.id)).rejects.toMatchObject({ code: 'validation' });
  b.profile.status = 'suspended';
  try {
    await expect(
      backend.sendDirectMessage({ recipientId: b.profile.id, body: 'No', requestId: id }),
    ).rejects.toMatchObject({ code: '42501' });
  } finally {
    b.profile.status = 'active';
  }
  a.profile.status = 'suspended';
  try {
    await expect(backend.blockUser(b.profile.id)).rejects.toMatchObject({ code: '42501' });
    await expect(backend.unblockUser(b.profile.id)).rejects.toMatchObject({ code: '42501' });
  } finally {
    a.profile.status = 'active';
  }
});

it('paginates tied messages and does not partially remove a friendship on storage failure', async () => {
  await friends();
  for (let i = 0; i < 25; i++)
    await backend.sendDirectMessage({
      recipientId: b.profile.id,
      body: `Message ${i}`,
      requestId: `66666666-6666-4666-8666-${String(i).padStart(12, '0')}`,
    });
  const state = JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!);
  for (const message of state.messages) message.created_at = '2026-10-18T00:00:00.000Z';
  storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  const first = await backend.listDirectMessages(b.profile.id);
  const older = await backend.listDirectMessages(b.profile.id, { cursor: first.nextCursor });
  expect(first.messages).toHaveLength(20);
  expect(older.messages).toHaveLength(5);
  expect([...older.messages, ...first.messages].map((row) => row.body)).toEqual(
    Array.from({ length: 25 }, (_, i) => `Message ${i}`),
  );
  vi.spyOn(storage, 'setItem').mockImplementationOnce(() => {
    throw new Error('storage full');
  });
  await expect(backend.blockUser(b.profile.id)).rejects.toThrow('storage full');
  expect((await backend.listConnections({ view: 'friends' })).connections).toHaveLength(1);
  expect((await backend.listBlockedUsers()).users).toEqual([]);
});

it('adds message storage to existing demo data without discarding friendships or posts', async () => {
  await friends();
  const state = JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!);
  delete state.messages;
  storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  const restored = createDemoBackend(storage);
  expect((await restored.listDirectMessages(b.profile.id)).messages).toEqual([]);
  expect((await restored.listConnections({ view: 'friends' })).connections).toHaveLength(1);
  expect((await restored.listPosts({ neighbourhoodId: 1 })).posts).toHaveLength(20);
});
