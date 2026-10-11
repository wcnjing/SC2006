import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createActivityDiscoverySession,
  likeActivity,
  listSwipeActivities,
  recordActivityInteraction,
  skipActivity,
  type ActivityDiscoveryAction,
} from '../src/api/activityDiscovery';
import { listActivities } from '../src/api/activities';
import type { Activity } from '../src/types';
import type { CommunityLinkClient } from '../src/api/client';
vi.mock('../src/api/activities', async (original) => ({
  ...(await original<typeof import('../src/api/activities')>()),
  listActivities: vi.fn(),
}));
const now = Date.parse('2026-10-10T12:00:00Z');
const resident = '22222222-2222-4222-8222-222222222222';
const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const activity = (n: number, overrides: Partial<Activity> = {}): Activity =>
  ({
    id: id(n),
    title: 'Sports day',
    description: 'Neighbourhood games',
    tags: ['sports'],
    category: 'sports',
    location_name: 'Central Park',
    address: null,
    accessibility_features: ['wheelchair'],
    is_outdoor: true,
    lat: 1.3,
    lng: 103.8,
    starts_at: '2026-10-11T12:00:00Z',
    ends_at: '2026-10-11T13:00:00Z',
    status: 'scheduled',
    capacity: 10,
    ...overrides,
  }) as Activity;
type Row = { activity_id: string; user_id: string; status?: 'skipped' | 'joined' | 'saved' };
type ErrorResult = { code: string; message: string };
function setup(
  options: {
    role?: string;
    status?: string;
    profileId?: string;
    signedIn?: boolean;
    participants?: Row[];
    bookmarks?: Row[];
    pageCap?: number;
    readError?: ErrorResult;
    rpcError?: ErrorResult;
    rpcData?: boolean | null;
    bookmarkError?: ErrorResult;
  } = {},
) {
  let user: string | null = options.signedIn === false ? null : resident;
  const bookmarks = [...(options.bookmarks ?? [])];
  const queries: { table: string; query: ReturnType<typeof makeQuery> }[] = [];
  function makeQuery(table: string) {
    let offset = 0;
    let end = 499;
    let writing = false;
    const conditions = new Map<string, unknown>();
    let statuses: string[] | undefined;
    const rows = () =>
      (table === 'activity_participants' ? (options.participants ?? []) : bookmarks)
        .filter(
          (row) =>
            [...conditions].every(([key, value]) => row[key as keyof Row] === value) &&
            (!statuses || statuses.includes(row.status!)),
        )
        .sort((a, b) => a.activity_id.localeCompare(b.activity_id));
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((key: string, value: unknown) => {
        conditions.set(key, value);
        return query;
      }),
      in: vi.fn((_key: string, value: string[]) => {
        statuses = value;
        return query;
      }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn((start: number, stop: number) => {
        offset = start;
        end = stop;
        return query;
      }),
      abortSignal: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({
        data: {
          id: options.profileId ?? user,
          role: options.role ?? 'resident',
          status: options.status ?? 'active',
        },
        error: null,
      })),
      maybeSingle: vi.fn(async () => ({
        data: rows()[0] ?? null,
        error: options.readError ?? null,
      })),
      insert: vi.fn((row: Row) => {
        writing = true;
        if (!options.bookmarkError) bookmarks.push(row);
        return query;
      }),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({
          data: writing
            ? null
            : rows().slice(offset, Math.min(end + 1, offset + (options.pageCap ?? 500))),
          error: writing ? (options.bookmarkError ?? null) : (options.readError ?? null),
        }).then(resolve),
    };
    return query;
  }
  const from = vi.fn((table: string) => {
    const query = makeQuery(table);
    queries.push({ table, query });
    return query;
  });
  const rpc = vi.fn(async (_name: string, _args: unknown) => ({
    data: options.rpcData === undefined ? true : options.rpcData,
    error: options.rpcError ?? null,
  }));
  const client = {
    from,
    rpc,
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: user ? { user: { id: user } } : null },
        error: null,
      })),
    },
  } as unknown as CommunityLinkClient;
  return {
    client,
    from,
    rpc,
    queries,
    bookmarks,
    setUser: (value: string | null) => {
      user = value;
    },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.mocked(listActivities).mockResolvedValue([activity(1), activity(2), activity(3)]);
});
afterEach(() => vi.useRealTimers());

describe('swipe deck batches', () => {
  it('reuses upcoming activity API and only own participant/bookmark reads', async () => {
    const mock = setup({
      participants: [
        { activity_id: id(1), user_id: resident, status: 'skipped' },
        { activity_id: id(2), user_id: 'other', status: 'skipped' },
      ],
      bookmarks: [{ activity_id: id(2), user_id: 'other' }],
    });
    expect((await listSwipeActivities(mock.client)).map((row) => row.id)).toEqual([id(2), id(3)]);
    expect(listActivities).toHaveBeenCalledWith(mock.client, { signal: undefined });
    const queries = mock.queries.filter(({ table }) => table !== 'profiles');
    expect(
      queries.every(({ query }) =>
        query.eq.mock.calls.some(([key, value]) => key === 'user_id' && value === resident),
      ),
    ).toBe(true);
    expect(
      queries.find(({ table }) => table === 'activity_participants')?.query.in,
    ).toHaveBeenCalledWith('status', ['skipped', 'joined']);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('excludes persisted Skip, joined, bookmarked and session-handled cards together', async () => {
    vi.mocked(listActivities).mockResolvedValue([
      activity(1),
      activity(2),
      activity(3),
      activity(4),
      activity(5),
    ]);
    const mock = setup({
      participants: [
        { activity_id: id(1), user_id: resident, status: 'skipped' },
        { activity_id: id(2), user_id: resident, status: 'joined' },
      ],
      bookmarks: [{ activity_id: id(3), user_id: resident }],
    });
    expect(
      (await listSwipeActivities(mock.client, { excludedActivityIds: [id(4)] })).map(
        (row) => row.id,
      ),
    ).toEqual([id(5)]);
  });
  it('fully pages exclusions even below requested server row limits', async () => {
    const mock = setup({
      pageCap: 1,
      participants: [1, 2].map((n) => ({
        activity_id: id(n),
        user_id: resident,
        status: 'skipped',
      })),
      bookmarks: [{ activity_id: id(3), user_id: resident }],
    });
    expect(await listSwipeActivities(mock.client)).toEqual([]);
    expect(
      mock.queries
        .filter(({ table }) => table === 'activity_participants')
        .map(({ query }) => query.range.mock.calls[0]),
    ).toEqual([
      [0, 499],
      [1, 500],
      [2, 501],
    ]);
    expect(mock.queries.filter(({ table }) => table === 'activity_bookmarks')).toHaveLength(2);
  });
  it.each([
    { status: 'cancelled' },
    { status: 'completed' },
    { starts_at: '2026-10-10T12:00:00Z' },
    { starts_at: '2026-10-09T12:00:00Z' },
    { starts_at: 'bad' },
  ] as Partial<Activity>[])('rejects stale non-upcoming rows: %j', async (overrides) => {
    vi.mocked(listActivities).mockResolvedValue([activity(1, overrides)]);
    expect(await listSwipeActivities(setup().client)).toEqual([]);
  });
  it('combines existing keyword/category/location/date/accessibility/setting/distance filters', async () => {
    vi.mocked(listActivities).mockResolvedValue([
      activity(1),
      activity(2, { category: 'arts' }),
      activity(3, { location_name: 'West', lat: 2 }),
    ]);
    expect(
      (
        await listSwipeActivities(setup().client, {
          filters: {
            keyword: 'games',
            category: 'sports',
            location: 'central',
            dateFrom: '2026-10-11',
            dateTo: '2026-10-11',
            accessibility: ['wheelchair'],
            environment: 'outdoor',
            distance: { origin: { lat: 1.3, lng: 103.8 }, maxKm: 1 },
          },
        })
      ).map((row) => row.id),
    ).toEqual([id(1)]);
  });
  it('returns an empty batch for valid filters with no matches', async () =>
    expect(
      await listSwipeActivities(setup().client, { filters: { keyword: 'nonexistent' } }),
    ).toEqual([]));
  it('does not forbid bookmarking full activities; joining keeps its existing capacity check', async () => {
    vi.mocked(listActivities).mockResolvedValue([activity(1, { capacity: 0 })]);
    expect(await listSwipeActivities(setup().client)).toHaveLength(1);
  });
  it('defaults to twenty and supports one-card batches', async () => {
    vi.mocked(listActivities).mockResolvedValue(Array.from({ length: 25 }, (_, i) => activity(i)));
    expect(await listSwipeActivities(setup().client)).toHaveLength(20);
    expect(await listSwipeActivities(setup().client, { limit: 1 })).toHaveLength(1);
  });
  it.each([0, -1, 101, 1.2, NaN])('rejects invalid batch size %s before reads', async (limit) => {
    const mock = setup();
    await expect(listSwipeActivities(mock.client, { limit })).rejects.toMatchObject({
      code: 'validation',
    });
    expect(mock.from).not.toHaveBeenCalled();
  });
  it('rejects invalid filters instead of pretending no activities matched', async () =>
    await expect(
      listSwipeActivities(setup().client, { filters: { dateFrom: '2026-02-30' } }),
    ).rejects.toMatchObject({ code: 'validation' }));
  it('propagates read errors instead of returning partially filtered results', async () => {
    await expect(
      listSwipeActivities(setup({ readError: { code: '500', message: 'Read failed' } }).client),
    ).rejects.toThrow('Read failed');
    vi.mocked(listActivities).mockRejectedValue(new Error('Activity read failed'));
    await expect(listSwipeActivities(setup().client)).rejects.toThrow('Activity read failed');
  });
  it('passes cancellation signals to every paginated query', async () => {
    const controller = new AbortController();
    const mock = setup();
    await listSwipeActivities(mock.client, { signal: controller.signal });
    expect(listActivities).toHaveBeenCalledWith(mock.client, { signal: controller.signal });
    expect(
      mock.queries
        .filter(({ table }) => table !== 'profiles')
        .every(({ query }) => query.abortSignal.mock.calls[0]?.[0] === controller.signal),
    ).toBe(true);
  });
});

describe('Like, Save and secure Skip contracts', () => {
  it('Skip only calls auth-derived RPC, with no direct participant write or bookmark change', async () => {
    const mock = setup();
    await skipActivity(mock.client, id(1));
    expect(mock.rpc).toHaveBeenCalledWith('skip_activity', { target_activity: id(1) });
    expect(mock.queries.map(({ table }) => table)).toEqual(['profiles']);
  });
  it.each(['like', 'save'] as const)(
    '%s only calls the independent bookmark API',
    async (action) => {
      const mock = setup({
        participants: [{ activity_id: id(1), user_id: resident, status: 'joined' }],
      });
      await recordActivityInteraction(mock.client, id(1), action);
      expect(mock.bookmarks).toEqual([{ activity_id: id(1), user_id: resident }]);
      expect(mock.rpc).not.toHaveBeenCalled();
      expect(mock.queries.map(({ table }) => table)).toEqual(['profiles', 'activity_bookmarks']);
    },
  );
  it('Like is the existing Save API with its duplicate-write confirmation', async () => {
    const mock = setup({
      bookmarks: [{ activity_id: id(1), user_id: resident }],
      bookmarkError: { code: '23505', message: 'Duplicate' },
    });
    await expect(likeActivity(mock.client, id(1))).resolves.toBeUndefined();
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('does not swallow a unique conflict unless the own bookmark exists', async () =>
    await expect(
      likeActivity(setup({ bookmarkError: { code: '23505', message: 'Duplicate' } }).client, id(1)),
    ).rejects.toMatchObject({ code: '23505' }));
  it.each(['PGRST202', '42883'])('explains missing RPC %s with no fallback write', async (code) => {
    const mock = setup({ rpcError: { code, message: 'Function not found' } });
    await expect(skipActivity(mock.client, id(1))).rejects.toMatchObject({
      code: 'skip_unavailable',
    });
    expect(mock.queries.every(({ table }) => table === 'profiles')).toBe(true);
  });
  it.each([false, null])(
    'does not claim success for unconfirmed Skip %s',
    async (rpcData) =>
      await expect(skipActivity(setup({ rpcData }).client, id(1))).rejects.toMatchObject({
        code: 'conflict',
      }),
  );
  it.each([
    { code: '42501', message: 'An active resident account is required.' },
    { code: 'P0001', message: 'Already joined. Skip cannot cancel your registration.' },
    { code: 'P0001', message: 'Only upcoming scheduled activities can be skipped.' },
    { code: 'P0002', message: 'Activity not found.' },
    { code: '40001', message: 'Retry transaction' },
    { code: '500', message: 'Server failed' },
  ])(
    'propagates server rejection %j',
    async (rpcError) =>
      await expect(skipActivity(setup({ rpcError }).client, id(1))).rejects.toMatchObject(rpcError),
  );
  it.each(['organiser', 'admin'])(
    'rejects %s reads/writes before resident operations',
    async (role) => {
      for (const action of [
        (client: CommunityLinkClient) => listSwipeActivities(client),
        (client: CommunityLinkClient) => skipActivity(client, id(1)),
        (client: CommunityLinkClient) => likeActivity(client, id(1)),
        (client: CommunityLinkClient) => createActivityDiscoverySession(client),
      ]) {
        const mock = setup({ role });
        await expect(action(mock.client)).rejects.toMatchObject({
          code: 'forbidden',
        });
        expect(mock.rpc).not.toHaveBeenCalled();
        expect(mock.queries.map(({ table }) => table)).toEqual(['profiles']);
      }
    },
  );
  it('rejects suspended residents and mismatched profiles', async () => {
    for (const options of [{ status: 'suspended' }, { profileId: 'other' }]) {
      const mock = setup(options);
      await expect(skipActivity(mock.client, id(1))).rejects.toMatchObject({ code: 'forbidden' });
      expect(mock.rpc).not.toHaveBeenCalled();
    }
  });
  it('rejects unauthenticated residents before profile reads', async () => {
    const mock = setup({ signedIn: false });
    await expect(skipActivity(mock.client, id(1))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    expect(mock.from).not.toHaveBeenCalled();
  });
  it('rejects invalid IDs and unrecognised decisions before writes', async () => {
    const mock = setup();
    await expect(skipActivity(mock.client, 'bad')).rejects.toMatchObject({ code: 'validation' });
    await expect(
      recordActivityInteraction(mock.client, id(1), 'join' as ActivityDiscoveryAction),
    ).rejects.toMatchObject({ code: 'validation' });
    expect(mock.from).not.toHaveBeenCalled();
  });
});

describe('headless resident browsing sessions', () => {
  it('keeps a confirmed Skip out of the same session even if a registration transition removed the persisted row', async () => {
    const mock = setup();
    const session = await createActivityDiscoverySession(mock.client);
    await session.act(id(1), 'skip');
    expect(session.excludedActivityIds).toEqual([id(1)]);
    expect((await session.load()).map((row) => row.id)).toEqual([id(2), id(3)]);
    const fresh = await createActivityDiscoverySession(mock.client, session.excludedActivityIds);
    expect((await fresh.load()).map((row) => row.id)).toEqual([id(2), id(3)]);
  });
  it('fresh sessions exclude persisted Skip after refresh without in-memory state', async () => {
    const session = await createActivityDiscoverySession(
      setup({ participants: [{ activity_id: id(1), user_id: resident, status: 'skipped' }] })
        .client,
    );
    expect((await session.load()).map((row) => row.id)).toEqual([id(2), id(3)]);
  });
  it('coalesces duplicate Skip clicks but rejects a conflicting Like while Skip is pending', async () => {
    const mock = setup();
    const session = await createActivityDiscoverySession(mock.client);
    const first = session.act(id(1), 'skip');
    const second = session.act(id(1), 'skip');
    expect(first).toBe(second);
    await expect(session.act(id(1), 'like')).rejects.toMatchObject({ code: 'busy' });
    await first;
    expect(mock.rpc).toHaveBeenCalledOnce();
  });
  it('coalesces Like and Save as the same bookmark action', async () => {
    const mock = setup();
    const session = await createActivityDiscoverySession(mock.client);
    const first = session.act(id(1), 'like');
    expect(session.act(id(1), 'save')).toBe(first);
    await first;
    expect(mock.bookmarks).toHaveLength(1);
  });
  it('a failed action remains available and can be retried rather than pretending persistence', async () => {
    const mock = setup({ rpcError: { code: '500', message: 'Server failed' } });
    const session = await createActivityDiscoverySession(mock.client);
    await expect(session.act(id(1), 'skip')).rejects.toThrow('Server failed');
    expect(session.excludedActivityIds).toEqual([]);
    expect(await session.load()).toHaveLength(3);
    mock.rpc.mockResolvedValue({ data: true, error: null });
    await session.act(id(1), 'skip');
    expect(session.excludedActivityIds).toEqual([id(1)]);
  });
  it('does not revive a card if a stale fetch completes after its Skip succeeds', async () => {
    let resolve!: (rows: Activity[]) => void;
    vi.mocked(listActivities).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const session = await createActivityDiscoverySession(setup().client);
    const loading = session.load();
    await session.act(id(1), 'skip');
    resolve([activity(1), activity(2)]);
    expect((await loading).map((row) => row.id)).toEqual([id(2)]);
  });
  it('does not return pending cards while a write is unresolved, including one-card batches', async () => {
    const mock = setup();
    let resolve!: (result: { data: boolean; error: null }) => void;
    mock.rpc.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const session = await createActivityDiscoverySession(mock.client);
    const action = session.act(id(1), 'skip');
    expect((await session.load()).map((row) => row.id)).toEqual([id(2), id(3)]);
    expect((await session.load({ limit: 1 })).map((row) => row.id)).toEqual([id(2)]);
    resolve({ data: true, error: null });
    await action;
  });
  it('rejects reuse after resident change and after sign-out', async () => {
    const mock = setup();
    const session = await createActivityDiscoverySession(mock.client);
    mock.setUser('another');
    await expect(session.load()).rejects.toMatchObject({ code: 'forbidden' });
    await expect(session.act(id(1), 'skip')).rejects.toMatchObject({ code: 'forbidden' });
    expect(mock.rpc).not.toHaveBeenCalled();
    mock.setUser(null);
    await expect(session.load()).rejects.toMatchObject({ code: 'unauthenticated' });
  });
  it('rejects a stale load if the resident changes before it completes', async () => {
    let resolve!: (rows: Activity[]) => void;
    vi.mocked(listActivities).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const mock = setup();
    const session = await createActivityDiscoverySession(mock.client);
    const loading = session.load();
    await vi.waitFor(() => expect(listActivities).toHaveBeenCalled());
    mock.setUser('another');
    resolve([activity(1)]);
    await expect(loading).rejects.toMatchObject({ code: 'forbidden' });
  });
  it('does not remove an independent bookmark when a subsequent Skip succeeds', async () => {
    const mock = setup();
    const session = await createActivityDiscoverySession(mock.client);
    await session.act(id(1), 'save');
    await session.act(id(1), 'skip');
    expect(mock.bookmarks).toEqual([{ activity_id: id(1), user_id: resident }]);
    expect(mock.rpc).toHaveBeenCalledWith('skip_activity', { target_activity: id(1) });
    expect(session.excludedActivityIds).toEqual([id(1)]);
  });
  it('does not mark an old session successful if the resident changes during the write', async () => {
    const mock = setup();
    let resolve!: (result: { data: boolean; error: null }) => void;
    mock.rpc.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const session = await createActivityDiscoverySession(mock.client);
    const action = session.act(id(1), 'skip');
    await vi.waitFor(() => expect(mock.rpc).toHaveBeenCalled());
    mock.setUser('another');
    resolve({ data: true, error: null });
    await expect(action).rejects.toMatchObject({ code: 'forbidden' });
    expect(session.excludedActivityIds).toEqual([]);
  });
  it('returns exclusion snapshots that cannot mutate internal session state', async () => {
    const session = await createActivityDiscoverySession(setup().client);
    (session.excludedActivityIds as string[]).push(id(1));
    expect(session.excludedActivityIds).toEqual([]);
  });
});
