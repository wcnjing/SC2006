import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canManageActivity,
  cancelActivity,
  createActivity,
  listMyActivities,
  updateActivity,
  validateActivityInput,
  type ActivityInput,
} from '../src/api/activityManagement';
import type { CommunityLinkClient } from '../src/api/client';

const id = '11111111-1111-4111-8111-111111111111';
const organiser = '22222222-2222-4222-8222-222222222222';
const input: ActivityInput = {
  title: ' Walk ',
  description: ' Meet neighbours ',
  category: 'Fitness',
  location_name: ' Park ',
  address: null,
  starts_at: '2027-01-01T08:00:00+08:00',
  ends_at: '2027-01-01T09:00:00+08:00',
  capacity: 5,
  cost_cents: 0,
  is_outdoor: true,
  accessibility_features: ['wheelchair-access'],
  tags: ['Walk', 'Walk'],
  lat: 1.3,
  lng: 103.8,
};
const row = {
  ...input,
  id,
  organiser_id: organiser,
  source: 'organiser',
  status: 'scheduled',
  updated_at: 'version-one',
};
function mockClient(
  options: {
    role?: string;
    status?: string;
    signedIn?: boolean;
    activity?: unknown;
    joined?: number | null;
    error?: { code: string; message: string };
    mutation?: unknown;
    countError?: boolean;
  } = {},
) {
  const calls: { table: string; query: ReturnType<typeof makeQuery> }[] = [];
  let pages = 0;
  function makeQuery(table: string) {
    let writing = false;
    const result = () => ({
      data:
        table === 'profiles'
          ? { id: organiser, role: options.role ?? 'organiser', status: options.status ?? 'active' }
          : writing
            ? 'mutation' in options
              ? options.mutation
              : row
            : 'activity' in options
              ? options.activity
              : row,
      error: writing ? (options.error ?? null) : null,
    });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      insert: vi.fn((_payload: unknown) => {
        writing = true;
        return query;
      }),
      update: vi.fn((_payload: unknown) => {
        writing = true;
        return query;
      }),
      single: vi.fn(async () => result()),
      maybeSingle: vi.fn(async () => result()),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(
          table === 'activity_participants'
            ? {
                data: null,
                count: options.joined === undefined ? 3 : options.joined,
                error: options.countError ? { code: '42501', message: 'row-level security' } : null,
              }
            : { data: pages++ === 0 ? [row] : [], error: null },
        ).then(resolve),
    };
    return query;
  }
  const from = vi.fn((table: string) => {
    const query = makeQuery(table);
    calls.push({ table, query });
    return query;
  });
  const client = {
    from,
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: options.signedIn === false ? null : { user: { id: organiser } } },
      })),
    },
  } as unknown as CommunityLinkClient;
  return { client, calls, from };
}
beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-10T00:00:00Z')));

afterEach(() => vi.restoreAllMocks());

describe('organiser activity validation', () => {
  it('normalises details, dates and lists', () => {
    const clean = validateActivityInput(input);
    expect(clean.title).toBe('Walk');
    expect(clean.location_name).toBe('Park');
    expect(clean.starts_at).toBe('2027-01-01T00:00:00.000Z');
    expect(clean.tags).toEqual(['Walk']);
  });
  it.each([
    { title: 'ab' },
    { title: 'a'.repeat(121) },
    { description: ' ' },
    { category: ' ' },
    { location_name: ' ' },
    { starts_at: 'invalid' },
    { starts_at: '2027-02-30T08:00:00Z' },
    { starts_at: '2027-01-01' },
    { starts_at: '2027-01-01T24:00:00Z' },
    { ends_at: 'invalid' },
    { starts_at: '2026-01-01T00:00:00Z' },
    { ends_at: input.starts_at },
    { capacity: 0 },
    { capacity: -1 },
    { capacity: 1.2 },
    { capacity: 2147483648 },
    { cost_cents: -1 },
    { cost_cents: 0.5 },
    { cost_cents: Infinity },
    { lat: null },
    { lng: 181 },
    { lat: NaN },
  ])('rejects invalid details %j', (patch) => {
    expect(() => validateActivityInput({ ...input, ...patch })).toThrow();
  });
  it('accepts unlimited capacity and absent coordinates', () => {
    expect(
      validateActivityInput({ ...input, capacity: null, lat: null, lng: null }).capacity,
    ).toBeNull();
  });
});
describe('organiser activity API', () => {
  it('creates an activity with authenticated ownership and allow-listed columns', async () => {
    const { client, calls } = mockClient();
    await createActivity(client, {
      ...input,
      organiser_id: 'attacker',
      status: 'completed',
      source: 'dataset',
      id: 'injected',
    } as ActivityInput);
    const payload = calls.find((call) => call.table === 'activities')!.query.insert.mock
      .calls[0]![0];
    expect(payload).toMatchObject({
      organiser_id: organiser,
      source: 'organiser',
      status: 'scheduled',
      title: 'Walk',
    });
    expect(payload).not.toHaveProperty('id');
  });
  it.each(['resident', 'admin'])(
    'rejects %s accounts for P2 organiser operations',
    async (role) => {
      const { client, calls } = mockClient({ role });
      for (const action of [
        () => createActivity(client, input),
        () => updateActivity(client, id, input),
        () => cancelActivity(client, id, 'Rain'),
        () => listMyActivities(client),
      ])
        await expect(action()).rejects.toThrow('active organiser');
      expect(calls.every((call) => call.table === 'profiles')).toBe(true);
    },
  );
  it('rejects suspended organisers and absent sessions', async () => {
    await expect(createActivity(mockClient({ status: 'suspended' }).client, input)).rejects.toThrow(
      'active organiser',
    );
    await expect(createActivity(mockClient({ signedIn: false }).client, input)).rejects.toThrow(
      'logged in',
    );
  });
  it.each([{ organiser_id: 'other' }, { source: 'dataset' }])(
    'rejects editing or cancelling another/dataset activity',
    async (patch) => {
      const { client, calls } = mockClient({ activity: { ...row, ...patch } });
      await expect(updateActivity(client, id, input)).rejects.toThrow('own organiser');
      await expect(cancelActivity(client, id, 'Rain')).rejects.toThrow('own organiser');
      expect(calls.every((call) => !call.query.update.mock.calls.length)).toBe(true);
    },
  );
  it.each(['cancelled', 'completed'])('rejects management of %s activities', async (status) => {
    const { client } = mockClient({ activity: { ...row, status } });
    await expect(updateActivity(client, id, input)).rejects.toThrow('scheduled');
    await expect(cancelActivity(client, id, 'Rain')).rejects.toThrow('scheduled');
  });
  it('rejects editing a started activity even when moving its new start into the future', async () => {
    const { client } = mockClient({ activity: { ...row, starts_at: '2026-01-01T00:00:00Z' } });
    await expect(updateActivity(client, id, input)).rejects.toThrow('after they start');
  });
  it('checks joined count and allows capacity equal to count or unlimited', async () => {
    await expect(updateActivity(mockClient({ joined: 6 }).client, id, input)).rejects.toThrow(
      '6 joined',
    );
    await expect(updateActivity(mockClient({ joined: 5 }).client, id, input)).resolves.toEqual(row);
    await expect(
      updateActivity(mockClient({ joined: 6 }).client, id, { ...input, capacity: null }),
    ).resolves.toEqual(row);
  });
  it('fails safely when joined count cannot be verified', async () => {
    await expect(updateActivity(mockClient({ joined: null }).client, id, input)).rejects.toThrow(
      'verify',
    );
    await expect(
      updateActivity(mockClient({ countError: true }).client, id, input),
    ).rejects.toThrow('permission');
  });
  it('uses ownership, status, start-time and version predicates on updates', async () => {
    const { client, calls } = mockClient();
    await updateActivity(client, id, input);
    const query = calls.find((call) => call.query.update.mock.calls.length)!.query;
    expect(query.eq.mock.calls).toEqual([
      ['id', id],
      ['organiser_id', organiser],
      ['status', 'scheduled'],
      ['updated_at', 'version-one'],
    ]);
    expect(query.gt).toHaveBeenCalledWith('starts_at', expect.any(String));
    expect(query.update.mock.calls[0]![0]).not.toHaveProperty('organiser_id');
  });
  it('cancels separately with a trimmed reason, without touching registrations or bookmarks', async () => {
    const { client, calls } = mockClient();
    await cancelActivity(client, id, ' Rain ');
    const query = calls.find((call) => call.query.update.mock.calls.length)!.query;
    expect(query.update).toHaveBeenCalledWith({ status: 'cancelled', cancelled_reason: 'Rain' });
    expect(
      calls.some((call) => ['activity_participants', 'activity_bookmarks'].includes(call.table)),
    ).toBe(false);
    await expect(cancelActivity(client, id, ' ')).rejects.toThrow('reason');
  });
  it.each(['2026-01-01T00:00:00Z', '2026-10-10T08:00:00+08:00'])(
    'rejects cancellation at or after the scheduled start %s without writing',
    async (starts_at) => {
      const { client, calls } = mockClient({ activity: { ...row, starts_at } });
      await expect(cancelActivity(client, id, 'Venue closed')).rejects.toThrow(
        'already started and cannot be cancelled',
      );
      expect(calls.every(({ query }) => query.update.mock.calls.length === 0)).toBe(true);
    },
  );
  it('allows cancellation immediately before start and includes a start-time write predicate', async () => {
    vi.mocked(Date.now).mockReturnValue(Date.parse(row.starts_at) - 1);
    const { client, calls } = mockClient();
    await cancelActivity(client, id, 'Rain');
    const query = calls.find(({ query }) => query.update.mock.calls.length)!.query;
    expect(query.gt).toHaveBeenCalledWith('starts_at', new Date(Date.now()).toISOString());
  });
  it('surfaces the server cancellation start-time rejection', async () => {
    const { client } = mockClient({
      error: {
        code: 'P0001',
        message: 'This activity has already started and cannot be cancelled.',
      },
    });
    await expect(cancelActivity(client, id, 'Rain')).rejects.toThrow('already started');
  });
  it('reports stale form versions and RLS-filtered zero-row mutations', async () => {
    await expect(updateActivity(mockClient().client, id, input, 'old-version')).rejects.toThrow(
      'changed',
    );
    await expect(cancelActivity(mockClient().client, id, 'Rain', 'old-version')).rejects.toThrow(
      'changed',
    );
    await expect(updateActivity(mockClient({ mutation: null }).client, id, input)).rejects.toThrow(
      'changed',
    );
    await expect(cancelActivity(mockClient({ mutation: null }).client, id, 'Rain')).rejects.toThrow(
      'changed',
    );
  });
  it('surfaces database business-rule rejections instead of claiming success', async () => {
    const { client } = mockClient({
      error: { code: 'P0001', message: 'Capacity is below existing registrations.' },
    });
    await expect(updateActivity(client, id, input)).rejects.toThrow('below existing');
  });
  it('lists only authenticated organiser-owned activities with pagination', async () => {
    const { client, calls } = mockClient();
    expect(await listMyActivities(client)).toEqual([row]);
    const queries = calls.filter((call) => call.table === 'activities');
    expect(queries[0]!.query.eq.mock.calls).toEqual([
      ['organiser_id', organiser],
      ['source', 'organiser'],
    ]);
    expect(queries.map((call) => call.query.range.mock.calls[0])).toEqual([
      [0, 499],
      [1, 500],
    ]);
  });
  it('requires matching session/profile identity and active ownership in the UI', () => {
    const profile = { id: organiser, role: 'organiser' as const, status: 'active' as const };
    expect(
      canManageActivity(profile, organiser, { organiser_id: organiser, source: 'organiser' }),
    ).toBe(true);
    expect(canManageActivity(profile, 'other')).toBe(false);
    expect(canManageActivity(profile, undefined)).toBe(false);
    expect(
      canManageActivity(profile, organiser, { organiser_id: 'other', source: 'organiser' }),
    ).toBe(false);
    expect(canManageActivity(null, organiser)).toBe(false);
  });
});
