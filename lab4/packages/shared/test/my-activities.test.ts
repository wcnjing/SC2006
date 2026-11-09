import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listMyActivityCollections,
  listMySavedActivities,
  listMyJoinedActivities,
  listMyActivityHistory,
} from '../src/api/myActivities';
import { activityRatingUnavailableReason } from '../src/api/activityRatings';
import type { Activity } from '../src/types';
import type { CommunityLinkClient } from '../src/api/client';

const now = Date.parse('2026-10-10T12:00:00Z');
const resident = 'resident-one';
const activity = (
  id: string,
  starts_at = '2026-10-11T12:00:00Z',
  status: Activity['status'] = 'scheduled',
) => ({ id, starts_at, ends_at: '2026-10-11T13:00:00Z', status, title: id }) as Activity;
function mockClient(
  options: {
    saved?: (Activity | null)[];
    participants?: { activity: Activity; user?: string; status?: string }[];
    signedIn?: boolean;
    role?: string;
    accountStatus?: string;
    profileId?: string;
    errorTable?: string;
    errorOffset?: number;
    pageSize?: number;
  } = {},
) {
  const queries: {
    table: string;
    eq: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
  }[] = [];
  const client = {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: options.signedIn === false ? null : { user: { id: resident } } },
      })),
    },
    from: vi.fn((table: string) => {
      const predicates: Record<string, unknown> = {};
      let offset = 0;
      const query = {
        table,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((key: string, value: unknown) => {
          predicates[key] = value;
          return query;
        }),
        order: vi.fn().mockReturnThis(),
        range: vi.fn((from: number) => {
          offset = from;
          return query;
        }),
        single: vi.fn(async () => ({
          data: {
            id: options.profileId ?? resident,
            role: options.role ?? 'resident',
            status: options.accountStatus ?? 'active',
          },
          error:
            table === options.errorTable
              ? { code: '42501', message: 'row-level security denied' }
              : null,
        })),
        then: (resolve: (result: unknown) => unknown) => {
          const rows =
            table === 'activity_bookmarks'
              ? (options.saved ?? []).map((activities) => ({ activities }))
              : (options.participants ?? [])
                  .filter(
                    (row) =>
                      (row.user ?? resident) === predicates.user_id &&
                      (row.status ?? 'joined') === predicates.status,
                  )
                  .map((row) => ({ activities: row.activity }));
          return Promise.resolve({
            data: rows.slice(offset, offset + (options.pageSize ?? 500)),
            error:
              table === options.errorTable && offset >= (options.errorOffset ?? 0)
                ? { code: '42501', message: 'row-level security denied' }
                : null,
          }).then(resolve);
        },
      };
      queries.push(query);
      return query;
    }),
  };
  return { client: client as unknown as CommunityLinkClient, queries };
}
beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(now));
afterEach(() => vi.restoreAllMocks());

describe('resident My Activities collections', () => {
  it('keeps Save and Join independent, including overlap, and returns activity details', async () => {
    const savedOnly = activity('saved');
    const both = activity('both');
    const joinedOnly = activity('joined');
    const { client } = mockClient({
      saved: [savedOnly, both],
      participants: [{ activity: both }, { activity: joinedOnly }],
    });
    const result = await listMyActivityCollections(client);
    expect(result.saved).toEqual([
      { activity: both, saved: true, joined: true },
      { activity: savedOnly, saved: true, joined: false },
    ]);
    expect(result.joined).toEqual([
      { activity: both, saved: true, joined: true },
      { activity: joinedOnly, saved: false, joined: true },
    ]);
    expect(result.history).toEqual([]);
  });
  it('splits at the exact scheduled start and retains concluded and cancelled history', async () => {
    const future = activity('future', new Date(now + 1).toISOString());
    const boundary = activity('boundary', new Date(now).toISOString());
    const past = {
      ...activity('past', new Date(now - 1).toISOString(), 'completed'),
      ends_at: new Date(now - 1).toISOString(),
    };
    const cancelledPast = activity('cancelled-past', new Date(now - 2).toISOString(), 'cancelled');
    const cancelledFuture = activity(
      'cancelled-future',
      new Date(now + 1).toISOString(),
      'cancelled',
    );
    const { client } = mockClient({
      saved: [cancelledFuture, cancelledPast, past],
      participants: [future, boundary, past, cancelledPast, cancelledFuture].map((activity) => ({
        activity,
      })),
    });
    const result = await listMyActivityCollections(client);
    expect(result.joined.map((card) => card.activity.id)).toEqual(['future']);
    expect(result.history.map((card) => card.activity.id)).toEqual([
      'boundary',
      'past',
      'cancelled-past',
    ]);
    expect(result.saved).toHaveLength(3);
    const concluded = result.history.find((card) => card.activity.id === 'past')!;
    expect(activityRatingUnavailableReason({ ...concluded, rating: null }, now)).toBeNull();
    const cancelled = result.history.find((card) => card.activity.id === 'cancelled-past')!;
    expect(activityRatingUnavailableReason({ ...cancelled, rating: null }, now)).toContain(
      'Cancelled',
    );
    expect(activityRatingUnavailableReason({ ...result.history[0]!, rating: null }, now)).toContain(
      'concluded',
    );
  });
  it('reads only own joined participation, excluding skips, legacy saves and other residents', async () => {
    const { client, queries } = mockClient({
      participants: [
        { activity: activity('mine') },
        { activity: activity('other'), user: 'resident-two' },
        { activity: activity('skip'), status: 'skipped' },
        { activity: activity('legacy'), status: 'saved' },
      ],
    });
    expect(
      (await listMyActivityCollections(client)).joined.map((card) => card.activity.id),
    ).toEqual(['mine']);
    for (const query of queries.filter((query) => query.table !== 'profiles')) {
      expect(query.eq).toHaveBeenCalledWith('user_id', resident);
      expect(query.select).toHaveBeenCalledWith('activities!inner(*)');
    }
  });
  it.each([listMySavedActivities, listMyJoinedActivities, listMyActivityHistory])(
    'returns empty arrays for empty collections',
    async (list) => {
      expect(await list(mockClient().client)).toEqual([]);
    },
  );
  it.each([
    { signedIn: false },
    { role: 'organiser' },
    { role: 'admin' },
    { accountStatus: 'suspended' },
    { profileId: 'resident-two' },
  ])('rejects unauthorised collection reads %j before reading personal tables', async (options) => {
    const { client, queries } = mockClient(options);
    await expect(listMyActivityCollections(client)).rejects.toThrow();
    expect(queries.every((query) => query.table === 'profiles')).toBe(true);
  });
  it.each(['profiles', 'activity_bookmarks', 'activity_participants'])(
    'propagates %s read errors instead of false empty success',
    async (errorTable) => {
      await expect(listMyActivityCollections(mockClient({ errorTable }).client)).rejects.toThrow();
    },
  );
  it('paginates through small server caps and skips unavailable relations without truncating', async () => {
    const rows = [activity('a'), activity('b'), activity('c')];
    const { client, queries } = mockClient({
      saved: [null, ...rows, rows[0]!],
      participants: rows.map((activity) => ({ activity })),
      pageSize: 1,
    });
    const result = await listMyActivityCollections(client);
    expect(result.saved).toHaveLength(3);
    expect(result.joined).toHaveLength(3);
    expect(
      queries
        .filter((query) => query.table === 'activity_bookmarks')
        .map((query) => query.range.mock.calls[0]![0]),
    ).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it('rejects later-page errors instead of returning partial collections', async () => {
    await expect(
      listMyActivityCollections(
        mockClient({
          saved: [activity('a'), activity('b')],
          pageSize: 1,
          errorTable: 'activity_bookmarks',
          errorOffset: 1,
        }).client,
      ),
    ).rejects.toThrow();
  });
  it('individual collection helpers return the corresponding cards', async () => {
    const past = activity('past', new Date(now - 1).toISOString());
    const options = {
      saved: [activity('saved')],
      participants: [{ activity: activity('joined') }, { activity: past }],
    };
    expect((await listMySavedActivities(mockClient(options).client))[0]!.saved).toBe(true);
    expect((await listMyJoinedActivities(mockClient(options).client))[0]!.activity.id).toBe(
      'joined',
    );
    expect((await listMyActivityHistory(mockClient(options).client))[0]!.activity.id).toBe('past');
  });
});
