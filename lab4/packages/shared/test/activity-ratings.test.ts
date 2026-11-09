import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activityRatingUnavailableReason,
  averageActivityRating,
  getMyActivityRatingEligibility,
  listActivityRatings,
  listMyConcludedActivities,
  submitActivityRating,
  validateActivityRating,
  type ActivityRatingEligibility,
} from '../src/api/activityRatings';
import type { Activity, ActivityRating } from '../src/types';
import type { CommunityLinkClient } from '../src/api/client';

const activityId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const now = Date.parse('2026-10-10T12:00:00Z');
const activity = {
  id: activityId,
  ends_at: '2026-10-10T11:00:00Z',
  status: 'completed',
} as Activity;
const rating: ActivityRating = {
  activity_id: activityId,
  user_id: userId,
  rating: 4,
  comment: 'Friendly event',
  created_at: '2026-10-10T12:00:00Z',
};
function mockClient(
  options: {
    signedIn?: boolean;
    role?: string;
    accountStatus?: string;
    profileId?: string;
    activity?: Activity | null;
    participation?: string | null;
    existing?: ActivityRating | null;
    pages?: ActivityRating[][];
    readError?: string;
    readErrorPage?: number;
    concludedPages?: { activities: Activity }[][];
    insertError?: { code: string; message: string };
    inserted?: ActivityRating | null;
  } = {},
) {
  const queries: { table: string; query: ReturnType<typeof makeQuery> }[] = [];
  let pageIndex = 0;
  function makeQuery(table: string) {
    let writing = false;
    const result = () => ({
      data:
        table === 'profiles'
          ? {
              id: options.profileId ?? userId,
              role: options.role ?? 'resident',
              status: options.accountStatus ?? 'active',
            }
          : table === 'activities'
            ? 'activity' in options
              ? options.activity
              : activity
            : table === 'activity_participants'
              ? options.participation === null
                ? null
                : { status: options.participation ?? 'joined' }
              : writing
                ? 'inserted' in options
                  ? options.inserted
                  : rating
                : (options.existing ?? null),
      error: writing
        ? (options.insertError ?? null)
        : options.readError === table
          ? { code: '42501', message: 'row-level security violation' }
          : null,
    });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      insert: vi.fn((_payload: unknown) => {
        writing = true;
        return query;
      }),
      single: vi.fn(async () => result()),
      maybeSingle: vi.fn(async () => result()),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({
          data:
            table === 'activity_participants'
              ? ((options.concludedPages ?? [[{ activities: activity }], []])[pageIndex++] ?? [])
              : ((options.pages ?? [[rating], []])[pageIndex++] ?? []),
          error:
            options.readError === table || options.readErrorPage === pageIndex - 1
              ? { code: '42501', message: 'row-level security violation' }
              : null,
        }).then(resolve),
    };
    return query;
  }
  const from = vi.fn((table: string) => {
    const query = makeQuery(table);
    queries.push({ table, query });
    return query;
  });
  const client = {
    from,
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: options.signedIn === false ? null : { user: { id: userId } } },
      })),
    },
  } as unknown as CommunityLinkClient;
  return { client, queries, from };
}
beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(now));
afterEach(() => vi.restoreAllMocks());

describe('activity rating validation', () => {
  it.each([1, 2, 3, 4, 5])('accepts %s stars and trims optional feedback', (stars) => {
    expect(validateActivityRating({ rating: stars, comment: ' Good ' })).toEqual({
      rating: stars,
      comment: 'Good',
    });
  });
  it.each([0, 6, -1, 1.5, NaN, Infinity])('rejects invalid stars %s', (rating) => {
    expect(() => validateActivityRating({ rating })).toThrow('1 to 5');
  });
  it.each([undefined, null, '', ' \n '])('stores absent/blank feedback as null', (comment) => {
    expect(validateActivityRating({ rating: 3, comment }).comment).toBeNull();
  });
  it('matches the database 1000-code-point limit including Unicode', () => {
    expect(validateActivityRating({ rating: 5, comment: '😀'.repeat(1000) }).comment).toBe(
      '😀'.repeat(1000),
    );
    expect(() => validateActivityRating({ rating: 5, comment: '😀'.repeat(1001) })).toThrow(
      '1,000',
    );
    expect(() => validateActivityRating({ rating: 5, comment: 'x'.repeat(1001) })).toThrow('1,000');
  });
});
describe('rating eligibility', () => {
  const eligible: ActivityRatingEligibility = { activity, joined: true, rating: null };
  it('allows an ended scheduled or completed activity, not a future completed flag', () => {
    expect(activityRatingUnavailableReason(eligible, now)).toBeNull();
    expect(
      activityRatingUnavailableReason(
        { ...eligible, activity: { ...activity, status: 'scheduled' } },
        now,
      ),
    ).toBeNull();
    expect(
      activityRatingUnavailableReason(
        { ...eligible, activity: { ...activity, ends_at: '2026-10-11T00:00:00Z' } },
        now,
      ),
    ).toContain('concluded');
  });
  it('matches the strict ends_at < now boundary and rejects invalid end times', () => {
    expect(
      activityRatingUnavailableReason(
        { ...eligible, activity: { ...activity, ends_at: new Date(now).toISOString() } },
        now,
      ),
    ).toContain('concluded');
    expect(
      activityRatingUnavailableReason(
        { ...eligible, activity: { ...activity, ends_at: new Date(now - 1).toISOString() } },
        now,
      ),
    ).toBeNull();
    expect(
      activityRatingUnavailableReason(
        { ...eligible, activity: { ...activity, ends_at: 'invalid' } },
        now,
      ),
    ).toContain('concluded');
  });
  it('rejects cancellation, absent registration and duplicate ratings', () => {
    expect(
      activityRatingUnavailableReason(
        { ...eligible, activity: { ...activity, status: 'cancelled' } },
        now,
      ),
    ).toContain('Cancelled');
    expect(activityRatingUnavailableReason({ ...eligible, joined: false }, now)).toContain(
      'joined',
    );
    expect(activityRatingUnavailableReason({ ...eligible, rating }, now)).toContain(
      'already rated',
    );
  });
});
describe('ratings API', () => {
  it('inserts a rating for the authenticated resident, without changing registrations or bookmarks', async () => {
    const { client, queries } = mockClient();
    expect(
      await submitActivityRating(client, activityId, {
        rating: 4,
        comment: ' Friendly event ',
        user_id: 'attacker',
      } as { rating: number; comment: string }),
    ).toEqual(rating);
    const write = queries.find((call) => call.query.insert.mock.calls.length)!;
    expect(write.table).toBe('activity_ratings');
    expect(write.query.insert).toHaveBeenCalledWith({
      activity_id: activityId,
      user_id: userId,
      rating: 4,
      comment: 'Friendly event',
    });
    expect(
      queries.filter((call) => call.table === 'activity_participants')[0]!.query.eq.mock.calls,
    ).toEqual([
      ['activity_id', activityId],
      ['user_id', userId],
    ]);
    expect(queries.some((call) => call.table === 'activity_bookmarks')).toBe(false);
  });
  it.each(['organiser', 'admin'])(
    'rejects %s writes even with a legacy joined row',
    async (role) => {
      const { client, queries } = mockClient({ role });
      await expect(submitActivityRating(client, activityId, { rating: 4 })).rejects.toThrow(
        'active resident',
      );
      expect(queries.every((call) => call.table === 'profiles')).toBe(true);
    },
  );
  it('rejects suspended residents, mismatched profile IDs and unauthenticated writes', async () => {
    await expect(
      submitActivityRating(mockClient({ accountStatus: 'suspended' }).client, activityId, {
        rating: 4,
      }),
    ).rejects.toThrow('active resident');
    await expect(
      submitActivityRating(mockClient({ profileId: 'other' }).client, activityId, { rating: 4 }),
    ).rejects.toThrow('active resident');
    await expect(
      submitActivityRating(mockClient({ signedIn: false }).client, activityId, { rating: 4 }),
    ).rejects.toThrow('logged in');
  });
  it.each([null, 'saved', 'skipped'])(
    'rejects non-joined participation %s',
    async (participation) => {
      const { client, queries } = mockClient({ participation });
      await expect(submitActivityRating(client, activityId, { rating: 4 })).rejects.toThrow(
        'joined',
      );
      expect(queries.every((call) => !call.query.insert.mock.calls.length)).toBe(true);
    },
  );
  it('rejects missing, future and cancelled activities before writing', async () => {
    await expect(
      submitActivityRating(mockClient({ activity: null }).client, activityId, { rating: 4 }),
    ).rejects.toThrow('not found');
    await expect(
      submitActivityRating(
        mockClient({ activity: { ...activity, ends_at: '2027-01-01T00:00:00Z' } }).client,
        activityId,
        { rating: 4 },
      ),
    ).rejects.toThrow('concluded');
    await expect(
      submitActivityRating(
        mockClient({ activity: { ...activity, status: 'cancelled' } }).client,
        activityId,
        { rating: 4 },
      ),
    ).rejects.toThrow('Cancelled');
  });
  it('rejects existing and concurrent duplicate ratings without overwriting them', async () => {
    const existing = mockClient({ existing: rating });
    await expect(submitActivityRating(existing.client, activityId, { rating: 1 })).rejects.toThrow(
      'already rated',
    );
    expect(existing.queries.every((call) => !call.query.insert.mock.calls.length)).toBe(true);
    const concurrent = mockClient({ insertError: { code: '23505', message: 'duplicate key' } });
    await expect(
      submitActivityRating(concurrent.client, activityId, { rating: 1 }),
    ).rejects.toThrow('already rated');
  });
  it.each(['profiles', 'activities', 'activity_participants', 'activity_ratings'])(
    'surfaces %s read failures',
    async (readError) => {
      await expect(
        submitActivityRating(mockClient({ readError }).client, activityId, { rating: 4 }),
      ).rejects.toThrow('permission');
    },
  );
  it('surfaces RLS/server insert failures and absent confirmation data', async () => {
    await expect(
      submitActivityRating(
        mockClient({ insertError: { code: '42501', message: 'row-level security violation' } })
          .client,
        activityId,
        { rating: 4 },
      ),
    ).rejects.toThrow('permission');
    await expect(
      submitActivityRating(
        mockClient({ insertError: { code: 'XX000', message: 'Server unavailable' } }).client,
        activityId,
        { rating: 4 },
      ),
    ).rejects.toThrow('Server unavailable');
    await expect(
      submitActivityRating(mockClient({ inserted: null }).client, activityId, { rating: 4 }),
    ).rejects.toThrow('confirm');
  });
  it('returns current eligibility and own persisted rating', async () => {
    expect(
      await getMyActivityRatingEligibility(mockClient({ existing: rating }).client, activityId),
    ).toEqual({ activity, joined: true, rating });
  });
  it('validates activity IDs and inputs before accessing the database', async () => {
    const { client, from } = mockClient();
    await expect(submitActivityRating(client, 'invalid', { rating: 4 })).rejects.toThrow(
      'Invalid activity ID',
    );
    await expect(submitActivityRating(client, activityId, { rating: 6 })).rejects.toThrow('1 to 5');
    expect(from).not.toHaveBeenCalled();
  });
  it('reads all rating pages with stable ordering, even under a low server row cap', async () => {
    const second = { ...rating, user_id: 'another', rating: 2 };
    const { client, queries } = mockClient({ pages: [[rating], [second], []] });
    const ratings = await listActivityRatings(client, activityId);
    expect(ratings).toEqual([rating, second]);
    expect(averageActivityRating(ratings)).toBe(3);
    expect(queries.map((call) => call.query.range.mock.calls[0])).toEqual([
      [0, 499],
      [1, 500],
      [2, 501],
    ]);
    expect(queries[0]!.query.order.mock.calls).toEqual([
      ['created_at', { ascending: false }],
      ['user_id'],
    ]);
    expect(queries[0]!.query.eq).toHaveBeenCalledWith('activity_id', activityId);
  });
  it('allows signed-in organisers/admins to read but does not bypass anonymous read restrictions', async () => {
    for (const role of ['organiser', 'admin'])
      expect(await listActivityRatings(mockClient({ role }).client, activityId)).toEqual([rating]);
    await expect(
      listActivityRatings(mockClient({ signedIn: false }).client, activityId),
    ).rejects.toThrow('logged in');
    await expect(
      listActivityRatings(mockClient({ readError: 'activity_ratings' }).client, activityId),
    ).rejects.toThrow('permission');
  });
  it('does not return a partial review set/average when a later page fails', async () => {
    await expect(
      listActivityRatings(
        mockClient({ pages: [[rating], [rating]], readErrorPage: 1 }).client,
        activityId,
      ),
    ).rejects.toThrow('permission');
  });
  it('provides a paginated path to the resident own concluded, non-cancelled joined activities', async () => {
    const { client, queries } = mockClient();
    expect(await listMyConcludedActivities(client)).toEqual([activity]);
    const pages = queries.filter((call) => call.table === 'activity_participants');
    expect(pages[0]!.query.select).toHaveBeenCalledWith('activities!inner(*)');
    expect(pages[0]!.query.eq.mock.calls).toEqual([
      ['user_id', userId],
      ['status', 'joined'],
    ]);
    expect(pages[0]!.query.lt).toHaveBeenCalledWith('activities.ends_at', expect.any(String));
    expect(pages[0]!.query.neq).toHaveBeenCalledWith('activities.status', 'cancelled');
    expect(pages.map((call) => call.query.range.mock.calls[0])).toEqual([
      [0, 499],
      [1, 500],
    ]);
    await expect(
      listMyConcludedActivities(mockClient({ role: 'organiser' }).client),
    ).rejects.toThrow('active resident');
  });
  it('distinguishes no ratings from a numeric average', async () => {
    expect(await listActivityRatings(mockClient({ pages: [[]] }).client, activityId)).toEqual([]);
    expect(averageActivityRating([])).toBeNull();
    expect(averageActivityRating([{ rating: 1 }, { rating: 5 }, { rating: 4 }])).toBeCloseTo(
      10 / 3,
    );
  });
});
