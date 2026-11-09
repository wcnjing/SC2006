import { createClient, type Session } from '@supabase/supabase-js';
import { beforeEach, expect, it, vi } from 'vitest';
import {
  sendDirectMessage,
  listDirectMessages,
  getDirectConversation,
  blockUser,
  unblockUser,
  listBlockedUsers,
  validateDirectMessageBody,
  type CommunityLinkClient,
  type Database,
} from '../src';

const me = '11111111-1111-4111-8111-111111111111';
const peer = '22222222-2222-4222-8222-222222222222';
const id = '33333333-3333-4333-8333-333333333333';
const older = '33333333-3333-4333-8333-333333333332';
const date = '2026-10-18T12:00:00.123456+00:00';
const row = {
  id,
  sender_id: me,
  recipient_id: peer,
  body: 'Hello',
  created_at: date,
  read_at: null,
  shared_post_id: null,
};
const fetchMock = vi.fn<typeof fetch>();
let client: CommunityLinkClient;
function respond(data: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}
function request() {
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
    data: { session: { user: { id: me } } as Session },
    error: null,
  });
});

it('sends only recipient/body/request ID through the permission-checked RPC', async () => {
  respond(row);
  expect(
    await sendDirectMessage(client, {
      recipientId: peer,
      body: '  Hello  ',
      requestId: id,
      ...({ sender_id: peer, created_at: date, read_at: date, shared_post_id: id } as object),
    }),
  ).toEqual(row);
  expect(request().url.pathname).toBe('/rest/v1/rpc/send_direct_message');
  expect(request().body).toEqual({ p_recipient: peer, p_body: 'Hello', p_request_id: id });
});

it('validates body, Unicode limits, IDs and self messaging without fetching', async () => {
  for (const body of [' \n\t ', 'x'.repeat(2001)])
    await expect(sendDirectMessage(client, { recipientId: peer, body })).rejects.toMatchObject({
      code: 'validation',
    });
  expect(validateDirectMessageBody('😀'.repeat(2000))).toBeNull();
  await expect(sendDirectMessage(client, { recipientId: me, body: 'Hello' })).rejects.toMatchObject(
    { code: 'validation' },
  );
  await expect(
    sendDirectMessage(client, { recipientId: peer, body: 'Hello', requestId: 'bad' }),
  ).rejects.toMatchObject({ code: 'validation' });
  await expect(blockUser(client, me)).rejects.toMatchObject({ code: 'validation' });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('requires authentication for message reads/writes and block management', async () => {
  vi.mocked(client.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });
  for (const run of [
    () => sendDirectMessage(client, { recipientId: peer, body: 'Hello' }),
    () => listDirectMessages(client, peer),
    () => getDirectConversation(client, peer),
    () => blockUser(client, peer),
    () => unblockUser(client, peer),
    () => listBlockedUsers(client),
  ])
    await expect(run()).rejects.toMatchObject({ code: 'unauthenticated' });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('lists just the current participant pair, chronologically, with precision-preserving pagination', async () => {
  respond([row, { ...row, id: older }, { ...row, id: me }]);
  const page = await listDirectMessages(client, peer, { limit: 2 });
  expect(page.messages.map((message) => message.id)).toEqual([older, id]);
  expect(page.nextCursor).toEqual({ createdAt: date, id: older });
  const filter = request().url.searchParams.get('or');
  expect(filter).toContain(`and(sender_id.eq.${me},recipient_id.eq.${peer})`);
  expect(filter).toContain(`and(sender_id.eq.${peer},recipient_id.eq.${me})`);
  expect(request().url.searchParams.get('order')).toBe('created_at.desc,id.desc');
  respond([]);
  await listDirectMessages(client, peer, { cursor: page.nextCursor });
  expect(request().url.searchParams.get('or')).toContain(`created_at.eq.${date},id.lt.${older}`);
});

it('maps conversation metadata without exposing peer account status or private profile fields', async () => {
  respond({
    id: peer,
    display_name: 'Mei',
    avatar_url: null,
    neighbourhood_id: 1,
    connected: false,
    blocked_by_me: true,
    can_send: false,
  });
  expect(await getDirectConversation(client, peer)).toEqual({
    profile: { id: peer, display_name: 'Mei', avatar_url: null, neighbourhood_id: 1 },
    connected: false,
    blockedByMe: true,
    canSend: false,
  });
  expect(request().url.pathname).toBe('/rest/v1/rpc/get_direct_conversation');
  respond(null);
  expect(await getDirectConversation(client, peer)).toBeNull();
});

it('blocks and unblocks through the RPC without accepting blocker identity or timestamps', async () => {
  respond(true);
  await blockUser(client, peer);
  expect(request().url.pathname).toBe('/rest/v1/rpc/set_user_block');
  expect(request().body).toEqual({ p_target_user: peer, p_blocked: true });
  respond(false);
  await unblockUser(client, peer);
  expect(request().body).toEqual({ p_target_user: peer, p_blocked: false });
});

it('lists only the caller’s blocks with public peer fields and a stable cursor', async () => {
  respond([
    { blocked_id: peer, created_at: date, profile: null },
    { blocked_id: me, created_at: date, profile: null },
  ]);
  const page = await listBlockedUsers(client, { limit: 1 });
  expect(page.nextCursor).toEqual({ id: peer, createdAt: date });
  expect(request().url.searchParams.get('blocker_id')).toBe(`eq.${me}`);
  expect(request().url.searchParams.get('select')).toContain(
    'profiles!blocks_blocked_id_fkey(id,display_name,avatar_url,neighbourhood_id)',
  );
  respond([]);
  await listBlockedUsers(client, { cursor: page.nextCursor });
  expect(request().url.searchParams.get('or')).toContain(`blocked_id.lt.${peer}`);
});

it('rejects invalid page sizes/cursors and forwards request cancellation', async () => {
  await expect(listDirectMessages(client, peer, { limit: 51 })).rejects.toMatchObject({
    code: 'validation',
  });
  await expect(
    listBlockedUsers(client, { cursor: { id, createdAt: `${date},id.gt.x` } }),
  ).rejects.toMatchObject({ code: 'validation' });
  expect(fetchMock).not.toHaveBeenCalled();
  const controller = new AbortController();
  respond([]);
  await listDirectMessages(client, peer, { signal: controller.signal });
  expect(request().init?.signal).toBe(controller.signal);
});

it('preserves server permission and conflicting-retry errors without mutating old messages', async () => {
  for (const code of ['42501', '40001']) {
    respond({ code, message: 'Cannot send' }, 409);
    await expect(
      sendDirectMessage(client, { recipientId: peer, body: 'Hello', requestId: id }),
    ).rejects.toMatchObject({ code });
  }
  expect(
    fetchMock.mock.calls.every(([url]) => String(url).includes('/rpc/send_direct_message')),
  ).toBe(true);
});
