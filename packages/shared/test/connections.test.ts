import { createClient, type Session } from '@supabase/supabase-js';
import { beforeEach, expect, it, vi } from 'vitest';
import {
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  cancelConnectionRequest,
  listConnections,
  findConnectionPeople,
  connectionRequestRef,
  type CommunityLinkClient,
  type Database,
} from '../src';

const me = '11111111-1111-4111-8111-111111111111';
const peer = '22222222-2222-4222-8222-222222222222';
const another = '33333333-3333-4333-8333-333333333333';
const date = '2026-10-18T12:00:00.123456+00:00';
const row = {
  requester_id: me,
  addressee_id: peer,
  created_at: date,
  status: 'pending' as const,
  responded_at: null,
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
function session(id: string | null) {
  vi.mocked(client.auth.getSession).mockResolvedValue(
    id
      ? {
          data: { session: { user: { id } } as Session },
          error: null,
        }
      : { data: { session: null }, error: null },
  );
}
beforeEach(() => {
  fetchMock.mockReset();
  client = createClient<Database>('http://localhost:54321', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchMock },
  });
  vi.spyOn(client.auth, 'getSession');
  session(me);
});

it('sends only the target to the RPC, leaving sender/status/timestamps to the database', async () => {
  respond(row);
  expect(await sendConnectionRequest(client, peer)).toEqual(row);
  expect(request().url.pathname).toBe('/rest/v1/rpc/send_connection_request');
  expect(request().body).toEqual({ p_target_user: peer });
});

it('preserves incoming direction when a crossed send returns an existing request', async () => {
  respond({ ...row, requester_id: peer, addressee_id: me });
  expect((await sendConnectionRequest(client, peer)).requester_id).toBe(peer);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('accepts with the exact request timestamp and never supplies an acceptance timestamp', async () => {
  session(peer);
  respond({ ...row, status: 'accepted' });
  expect((await acceptConnectionRequest(client, connectionRequestRef(row))).status).toBe(
    'accepted',
  );
  expect(request().url.pathname).toBe('/rest/v1/rpc/manage_connection_request');
  expect(request().body).toEqual({
    p_requester: me,
    p_addressee: peer,
    p_created_at: date,
    p_action: 'accept',
  });
});

it('rejects incoming and cancels outgoing requests; repeated deletions may return no row', async () => {
  session(peer);
  respond(null);
  await expect(rejectConnectionRequest(client, connectionRequestRef(row))).resolves.toBeUndefined();
  expect(request().body.p_action).toBe('reject');
  session(me);
  respond(null);
  await expect(cancelConnectionRequest(client, connectionRequestRef(row))).resolves.toBeUndefined();
  expect(request().body.p_action).toBe('cancel');
});

it('denies incorrect actors, self requests, malformed references and anonymous callers before fetching', async () => {
  await expect(sendConnectionRequest(client, me)).rejects.toMatchObject({ code: 'validation' });
  await expect(sendConnectionRequest(client, 'bad')).rejects.toMatchObject({ code: 'validation' });
  await expect(acceptConnectionRequest(client, connectionRequestRef(row))).rejects.toMatchObject({
    code: '42501',
  });
  await expect(rejectConnectionRequest(client, connectionRequestRef(row))).rejects.toMatchObject({
    code: '42501',
  });
  session(peer);
  await expect(cancelConnectionRequest(client, connectionRequestRef(row))).rejects.toMatchObject({
    code: '42501',
  });
  await expect(
    acceptConnectionRequest(client, {
      ...connectionRequestRef(row),
      createdAt: `${date},status.eq.accepted`,
    }),
  ).rejects.toMatchObject({ code: 'validation' });
  session(null);
  await expect(sendConnectionRequest(client, peer)).rejects.toMatchObject({
    code: 'unauthenticated',
  });
  await expect(listConnections(client)).rejects.toMatchObject({ code: 'unauthenticated' });
  await expect(findConnectionPeople(client)).rejects.toMatchObject({ code: 'unauthenticated' });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('returns incoming/outgoing/friend filters with an explicit participant scope and public profiles', async () => {
  for (const view of ['incoming', 'outgoing', 'friends', 'all'] as const) {
    respond([]);
    await listConnections(client, { view });
    const params = request().url.searchParams;
    expect(params.get('select')).toContain(
      'connections_requester_id_fkey(id,display_name,avatar_url,neighbourhood_id)',
    );
    expect(params.get('select')).not.toContain('bio');
    if (view === 'incoming') expect(params.get('addressee_id')).toBe(`eq.${me}`);
    if (view === 'outgoing') expect(params.get('requester_id')).toBe(`eq.${me}`);
    if (view === 'friends' || view === 'all')
      expect(params.get('or')).toContain(`requester_id.eq.${me},addressee_id.eq.${me}`);
    if (view !== 'all')
      expect(params.get('status')).toBe(view === 'friends' ? 'eq.accepted' : 'eq.pending');
  }
});

it('uses all composite-key fields for tied timestamps while preserving timestamp precision', async () => {
  respond([row, { ...row, addressee_id: another }]);
  const first = await listConnections(client, { limit: 1 });
  expect(first.nextCursor).toEqual(connectionRequestRef(row));
  respond([]);
  await listConnections(client, { cursor: first.nextCursor });
  const filter = request().url.searchParams.get('or');
  expect(filter).toContain(`created_at.lt.${date}`);
  expect(filter).toContain(`requester_id.lt.${me}`);
  expect(filter).toContain(`requester_id.eq.${me},addressee_id.lt.${peer}`);
  expect(request().url.searchParams.get('order')).toBe(
    'created_at.desc,requester_id.desc,addressee_id.desc',
  );
});

it('maps public directory rows and the caller’s relationship without extra profile requests', async () => {
  respond([
    {
      id: peer,
      display_name: 'Auntie Mei',
      avatar_url: null,
      neighbourhood_id: 1,
      requester_id: me,
      addressee_id: peer,
      connection_status: 'pending',
      connection_created_at: date,
      responded_at: null,
    },
    { id: another, display_name: 'Another', avatar_url: null, neighbourhood_id: null },
  ]);
  const controller = new AbortController();
  const page = await findConnectionPeople(client, {
    query: '  Mei%_  ',
    limit: 1,
    signal: controller.signal,
  });
  expect(page.people[0]).toEqual({
    profile: { id: peer, display_name: 'Auntie Mei', avatar_url: null, neighbourhood_id: 1 },
    connection: row,
  });
  expect(page.nextCursor).toBe(peer);
  expect(request().body).toEqual({ p_query: 'Mei%_', p_limit: 2 });
  expect(request().init?.signal).toBe(controller.signal);
  respond([]);
  await findConnectionPeople(client, { cursor: page.nextCursor });
  expect(request().body.p_after).toBe(peer);
});

it('validates searches and page cursors without sending malformed filters', async () => {
  await expect(findConnectionPeople(client, { query: 'x'.repeat(51) })).rejects.toMatchObject({
    code: 'validation',
  });
  await expect(findConnectionPeople(client, { cursor: 'bad' })).rejects.toMatchObject({
    code: 'validation',
  });
  await expect(listConnections(client, { limit: 51 })).rejects.toMatchObject({
    code: 'validation',
  });
  await expect(listConnections(client, { view: 'bad' as 'incoming' })).rejects.toMatchObject({
    code: 'validation',
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('preserves database permission, stale-request and missing-request errors', async () => {
  session(peer);
  for (const code of ['42501', '40001', 'P0002']) {
    respond({ code, message: 'Request refused' }, 409);
    await expect(acceptConnectionRequest(client, connectionRequestRef(row))).rejects.toMatchObject({
      code,
    });
  }
});
