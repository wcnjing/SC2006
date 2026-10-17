import { beforeEach, expect, it, vi } from 'vitest';
import { connectionRequestRef } from '@communitylink/shared';
import { createDemoBackend, DEMO_ACCOUNTS, DEMO_STORAGE_KEY } from '../src/demo/demoBackend';

let storage: Storage;
let backend: ReturnType<typeof createDemoBackend>;
const a = DEMO_ACCOUNTS[0],
  b = DEMO_ACCOUNTS[1],
  outsider = DEMO_ACCOUNTS[2];
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

it('sends, persists, lists privately and accepts into both residents’ friend lists', async () => {
  backend.signIn(a.email);
  const sent = await backend.sendConnectionRequest(b.profile.id);
  expect((await backend.sendConnectionRequest(b.profile.id)).created_at).toBe(sent.created_at);
  expect((await backend.listConnections({ view: 'outgoing' })).connections).toHaveLength(1);
  backend.signIn(b.email);
  const restored = createDemoBackend(storage);
  expect(
    (await restored.listConnections({ view: 'incoming' })).connections[0].requester?.display_name,
  ).toBe('Yining');
  const accepted = await restored.acceptConnectionRequest(connectionRequestRef(sent));
  expect(accepted.status).toBe('accepted');
  expect(accepted.responded_at).toBeTruthy();
  expect((await restored.acceptConnectionRequest(connectionRequestRef(sent))).responded_at).toBe(
    accepted.responded_at,
  );
  expect((await restored.listConnections({ view: 'friends' })).connections).toHaveLength(1);
  restored.signIn(a.email);
  expect((await restored.listConnections({ view: 'friends' })).connections).toHaveLength(1);
  restored.signIn(outsider.email);
  expect((await restored.listConnections()).connections).toEqual([]);
});

it('never auto-accepts a crossed request, and only the recipient may accept/reject', async () => {
  backend.signIn(a.email);
  const row = await backend.sendConnectionRequest(b.profile.id);
  await expect(backend.acceptConnectionRequest(connectionRequestRef(row))).rejects.toMatchObject({
    code: '42501',
  });
  await expect(backend.rejectConnectionRequest(connectionRequestRef(row))).rejects.toMatchObject({
    code: '42501',
  });
  backend.signIn(b.email);
  expect(await backend.sendConnectionRequest(a.profile.id)).toEqual(row);
  await expect(backend.cancelConnectionRequest(connectionRequestRef(row))).rejects.toMatchObject({
    code: '42501',
  });
  await backend.rejectConnectionRequest(connectionRequestRef(row));
  await backend.rejectConnectionRequest(connectionRequestRef(row));
  expect((await backend.listConnections()).connections).toEqual([]);
});

it('cancels pending requests but stale cancels/rejects cannot delete a new request or a friendship', async () => {
  backend.signIn(a.email);
  vi.useFakeTimers();
  try {
    const old = await backend.sendConnectionRequest(b.profile.id);
    await backend.cancelConnectionRequest(connectionRequestRef(old));
    await backend.cancelConnectionRequest(connectionRequestRef(old));
    const fresh = await backend.sendConnectionRequest(b.profile.id);
    expect(fresh.created_at).not.toBe(old.created_at);
    await expect(backend.cancelConnectionRequest(connectionRequestRef(old))).rejects.toMatchObject({
      code: '40001',
    });
    backend.signIn(b.email);
    await expect(backend.rejectConnectionRequest(connectionRequestRef(old))).rejects.toMatchObject({
      code: '40001',
    });
    await backend.acceptConnectionRequest(connectionRequestRef(fresh));
    await expect(
      backend.rejectConnectionRequest(connectionRequestRef(fresh)),
    ).rejects.toMatchObject({ code: '40001' });
    backend.signIn(a.email);
    await expect(
      backend.cancelConnectionRequest(connectionRequestRef(fresh)),
    ).rejects.toMatchObject({ code: '40001' });
  } finally {
    vi.useRealTimers();
  }
});

it('rejects self/unknown/suspended users and blocked requests, and hides blocked directory entries', async () => {
  await expect(backend.sendConnectionRequest(b.profile.id)).rejects.toMatchObject({
    code: 'unauthenticated',
  });
  backend.signIn(a.email);
  await expect(backend.sendConnectionRequest(a.profile.id)).rejects.toMatchObject({
    code: 'validation',
  });
  await expect(
    backend.sendConnectionRequest('99999999-9999-4999-8999-999999999999'),
  ).rejects.toMatchObject({ code: 'P0002' });
  b.profile.status = 'suspended';
  try {
    await expect(backend.sendConnectionRequest(b.profile.id)).rejects.toMatchObject({
      code: 'P0002',
    });
    backend.signIn(b.email);
    await expect(backend.sendConnectionRequest(a.profile.id)).rejects.toMatchObject({
      code: '42501',
    });
  } finally {
    b.profile.status = 'active';
  }
  backend.signIn(a.email);
  const row = await backend.sendConnectionRequest(b.profile.id);
  const state = JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!);
  state.blocks.push({
    blocker_id: b.profile.id,
    blocked_id: a.profile.id,
    created_at: new Date().toISOString(),
  });
  storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  await expect(backend.sendConnectionRequest(b.profile.id)).rejects.toMatchObject({
    code: '42501',
  });
  expect((await backend.listConnections()).connections).toEqual([]);
  expect(
    (await backend.findConnectionPeople()).people.some(
      (person) => person.profile.id === b.profile.id,
    ),
  ).toBe(false);
  backend.signIn(b.email);
  await expect(backend.acceptConnectionRequest(connectionRequestRef(row))).rejects.toMatchObject({
    code: '42501',
  });
});

it('searches literal names and paginates people and timestamp-tied requests without duplicates', async () => {
  const initial = DEMO_ACCOUNTS.length;
  try {
    for (let i = 0; i < 25; i++)
      DEMO_ACCOUNTS.push({
        email: `person${i}@demo.local`,
        profile: {
          ...a.profile,
          id: `55555555-5555-4555-8555-${String(i).padStart(12, '0')}`,
          display_name: `Person ${i}%_`,
        },
      });
    backend.signIn(a.email);
    const first = await backend.findConnectionPeople({ query: 'person' });
    const second = await backend.findConnectionPeople({
      query: 'PERSON',
      cursor: first.nextCursor,
    });
    expect(first.people).toHaveLength(20);
    expect(second.people).toHaveLength(5);
    expect(new Set([...first.people, ...second.people].map((row) => row.profile.id)).size).toBe(25);
    expect((await backend.findConnectionPeople({ query: '%_' })).people).toHaveLength(20);
    for (const person of [...first.people, ...second.people])
      await backend.sendConnectionRequest(person.profile.id);
    const state = JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!);
    for (const row of state.connections) row.created_at = '2026-10-18T00:00:00.000Z';
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    const newest = await backend.listConnections({ view: 'outgoing' });
    const older = await backend.listConnections({ view: 'outgoing', cursor: newest.nextCursor });
    expect(newest.connections).toHaveLength(20);
    expect(older.connections).toHaveLength(5);
    expect(
      new Set([...newest.connections, ...older.connections].map((row) => row.addressee_id)).size,
    ).toBe(25);
    expect(older.nextCursor).toBeNull();
  } finally {
    DEMO_ACCOUNTS.length = initial;
  }
});

it('upgrades old storage and leaves all state unchanged when a request write fails', async () => {
  backend.signIn(a.email);
  const state = JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!);
  delete state.connections;
  delete state.blocks;
  delete state.connectionClock;
  storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  expect((await backend.listConnections()).connections).toEqual([]);
  expect((await backend.listPosts({ neighbourhoodId: 1 })).posts).toHaveLength(20);
  vi.spyOn(storage, 'setItem').mockImplementationOnce(() => {
    throw new Error('storage full');
  });
  await expect(backend.sendConnectionRequest(b.profile.id)).rejects.toThrow('storage full');
  expect((await backend.listConnections()).connections).toEqual([]);
});
