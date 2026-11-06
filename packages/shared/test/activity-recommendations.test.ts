import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getActivityRecommendations,
  rankActivityRecommendations,
} from '../src/api/activityRecommendations';
import { getProfile, listNeighbourhoods } from '../src/api/profile';
import { listActivities } from '../src/api/activities';
import type { Activity, Profile } from '../src/types';
import type { CommunityLinkClient } from '../src/api/client';
vi.mock('../src/api/profile', () => ({ getProfile: vi.fn(), listNeighbourhoods: vi.fn() }));
vi.mock('../src/api/activities', async (original) => ({
  ...(await original<typeof import('../src/api/activities')>()),
  listActivities: vi.fn(),
}));
const now = Date.parse('2026-10-10T12:00:00Z');
const origin = { lat: 1.3, lng: 103.8, source: 'device' as const, label: 'your device location' };
const prefs = { interests: ['Sports'], accessibility_needs: ['Wheelchair_access'] };
const activity = (id: string, overrides: Partial<Activity> = {}): Activity =>
  ({
    id,
    title: id,
    category: 'sports',
    tags: [],
    accessibility_features: ['wheelchair access'],
    starts_at: '2026-10-11T12:00:00Z',
    ends_at: '2026-10-11T13:00:00Z',
    status: 'scheduled',
    capacity: null,
    lat: 1.3,
    lng: 103.8,
    is_outdoor: false,
    ...overrides,
  }) as Activity;
const rank = (
  rows: Activity[],
  preferences = prefs,
  counts = new Map<string, number>(),
  joined = new Set<string>(),
  location: typeof origin | null = origin,
) => rankActivityRecommendations(rows, preferences, counts, joined, location, now);
afterEach(() => vi.useRealTimers());
describe('recommendation ranking', () => {
  it('explains interests, accessibility, distance and popularity without changing input', () => {
    const rows = [activity('a')];
    const copy = JSON.stringify(rows);
    const [result] = rank(rows, prefs, new Map([['a', 5]]));
    expect(result!.scores).toEqual({ interests: 60, proximity: 25, popularity: 7.5 });
    expect(result!.score).toBe(92.5);
    expect(result!.reasons.join(' ')).toMatch(/Matches your interests: sports/);
    expect(result!.reasons.join(' ')).toMatch(/all your accessibility requirements/);
    expect(result!.reasons.join(' ')).toMatch(/straight-line/);
    expect(result!.reasons.join(' ')).toMatch(/5 joined registrations/);
    expect(JSON.stringify(rows)).toBe(copy);
  });
  it.each([
    { status: 'cancelled' },
    { status: 'completed' },
    { starts_at: '2026-10-10T12:00:00Z' },
    { starts_at: '2026-10-09T12:00:00Z' },
    { starts_at: 'invalid' },
    { capacity: 0 },
    { accessibility_features: [] },
  ] as Partial<Activity>[])('excludes ineligible activities: %j', (overrides) =>
    expect(rank([activity('a', overrides)])).toEqual([]),
  );
  it('excludes full and already joined activities while keeping other eligible activities', () => {
    expect(
      rank(
        [activity('full', { capacity: 2 }), activity('joined'), activity('bookmark')],
        prefs,
        new Map([['full', 2]]),
        new Set(['joined']),
      ).map((row) => row.activity.id),
    ).toEqual(['bookmark']);
  });
  it('requires every accessibility need even when interest and popularity scores are high', () => {
    expect(
      rank(
        [activity('a')],
        { ...prefs, accessibility_needs: ['wheelchair access', 'hearing loop'] },
        new Map([['a', 100]]),
      ),
    ).toEqual([]);
  });
  it('normalises and deduplicates interests and matches tags and outdoors', () => {
    const [result] = rank([activity('a', { tags: ['Arts'], is_outdoor: true })], {
      interests: [' SPORTS ', 'sports', 'arts', 'outdoors', ''],
      accessibility_needs: [],
    });
    expect(result!.scores.interests).toBe(60);
  });
  it('falls back to proximity and popularity for absent interests', () => {
    const results = rank(
      [activity('far', { lat: 2 }), activity('near')],
      { interests: [' '], accessibility_needs: [] },
      new Map([['near', 5]]),
    );
    expect(results[0]!.activity.id).toBe('near');
    expect(results[0]!.scores).toEqual({ interests: 0, proximity: 60, popularity: 20 });
  });
  it('does not fabricate proximity for missing or invalid coordinates', () => {
    for (const point of [null, { ...origin, lat: 100 }]) {
      const [result] = rank([activity('a')], prefs, new Map(), new Set(), point);
      expect(result!.distanceKm).toBeNull();
      expect(result!.scores.proximity).toBe(0);
    }
    expect(rank([activity('a', { lat: null })])[0]!.distanceKm).toBeNull();
  });
  it('uses start time then stable id for ties', () => {
    expect(
      rank([
        activity('z'),
        activity('b', { starts_at: '2026-10-12T12:00:00Z' }),
        activity('a'),
      ]).map((row) => row.activity.id),
    ).toEqual(['a', 'z', 'b']);
  });
  it('ranks 10,000 representative activities within the three-second generation budget', () => {
    vi.useRealTimers();
    const rows = Array.from({ length: 10000 }, (_, i) =>
      activity(String(i), { lat: 1.3 + (i % 100) / 1000 }),
    );
    const start = performance.now();
    const results = rank(rows);
    const elapsed = performance.now() - start;
    expect(results).toHaveLength(10000);
    expect(elapsed).toBeLessThan(3000);
    console.info(
      `Recommendation ranking: 10,000 activities in ${elapsed.toFixed(1)} ms (local fixture, excludes network).`,
    );
  });
});
function client(
  pages: { activity_id: string; user_id: string }[][] = [],
  error: object | null = null,
  signedIn = true,
) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    abortSignal: vi.fn(async () => ({ data: pages.shift() ?? [], error })),
  };
  const from = vi.fn((_table: string) => query);
  return {
    value: {
      from,
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: signedIn ? { user: { id: 'resident' } } : null },
          error: null,
        })),
      },
    } as unknown as CommunityLinkClient,
    query,
    from,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.mocked(getProfile).mockResolvedValue({
    id: 'resident',
    role: 'resident',
    status: 'active',
    neighbourhood_id: 1,
    ...prefs,
  } as unknown as Profile);
  vi.mocked(listActivities).mockResolvedValue([activity('a')]);
  vi.mocked(listNeighbourhoods).mockResolvedValue([
    { id: 1, name: 'Central', lat: 1.3, lng: 103.8 },
  ]);
});
describe('read-only recommendation API', () => {
  it('uses the authenticated profile and neighbourhood centre with fully paginated joined counts', async () => {
    const mock = client([
      [{ activity_id: 'a', user_id: 'other' }],
      [{ activity_id: 'a', user_id: 'another' }],
      [],
    ]);
    const result = await getActivityRecommendations(mock.value);
    expect(getProfile).toHaveBeenCalledWith(mock.value, 'resident');
    expect(result.origin?.source).toBe('neighbourhood');
    expect(result.recommendations[0]!.joinedCount).toBe(2);
    expect(result.recommendations[0]!.reasons.join(' ')).toMatch(/approximate/);
    expect(mock.query.range.mock.calls).toEqual([
      [0, 499],
      [1, 500],
      [2, 501],
    ]);
    expect(mock.query.eq).toHaveBeenCalledWith('status', 'joined');
    expect(mock.from.mock.calls.every(([table]) => table === 'activity_participants')).toBe(true);
    expect(listActivities).toHaveBeenCalledWith(mock.value, { signal: expect.any(AbortSignal) });
  });
  it('excludes own registrations and full activities from live read snapshots', async () => {
    vi.mocked(listActivities).mockResolvedValue([activity('a', { capacity: 1 }), activity('b')]);
    const result = await getActivityRecommendations(
      client([
        [
          { activity_id: 'a', user_id: 'other' },
          { activity_id: 'b', user_id: 'resident' },
        ],
      ]).value,
    );
    expect(result.recommendations).toEqual([]);
  });
  it.each([
    ['organiser', 'active'],
    ['admin', 'active'],
    ['resident', 'suspended'],
  ])('rejects %s/%s before activity reads', async (role, status) => {
    vi.mocked(getProfile).mockResolvedValue({
      id: 'resident',
      role,
      status,
      ...prefs,
    } as unknown as Profile);
    await expect(getActivityRecommendations(client().value)).rejects.toMatchObject({
      code: 'forbidden',
    });
    expect(listActivities).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated users and mismatched profiles', async () => {
    await expect(getActivityRecommendations(client([], null, false).value)).rejects.toThrow();
    expect(getProfile).not.toHaveBeenCalled();
    vi.mocked(getProfile).mockResolvedValue({
      id: 'other',
      role: 'resident',
      status: 'active',
      ...prefs,
    } as unknown as Profile);
    await expect(getActivityRecommendations(client().value)).rejects.toMatchObject({
      code: 'forbidden',
    });
  });
  it('uses optional device coordinates without reading neighbourhoods', async () => {
    const result = await getActivityRecommendations(client().value, { deviceLocation: origin });
    expect(result.origin?.source).toBe('device');
    expect(listNeighbourhoods).not.toHaveBeenCalled();
  });
  it('reports missing preferences and location honestly', async () => {
    vi.mocked(getProfile).mockResolvedValue({
      id: 'resident',
      role: 'resident',
      status: 'active',
      neighbourhood_id: null,
      interests: [],
      accessibility_needs: [],
    } as unknown as Profile);
    const result = await getActivityRecommendations(client().value);
    expect(result.personalised).toBe(false);
    expect(result.origin).toBeNull();
  });
  it('rejects invalid device coordinates before reads', async () => {
    await expect(
      getActivityRecommendations(client().value, { deviceLocation: { lat: 91, lng: 0 } }),
    ).rejects.toMatchObject({ code: 'validation' });
    expect(getProfile).not.toHaveBeenCalled();
  });
  it('does not return partial recommendations after a registration read error', async () => {
    await expect(
      getActivityRecommendations(client([], { message: 'Server unavailable', code: '500' }).value),
    ).rejects.toThrow('Server unavailable');
  });
  it('limits results to twenty and bounds registration query size', async () => {
    vi.mocked(listActivities).mockResolvedValue(
      Array.from({ length: 205 }, (_, i) => activity(String(i))),
    );
    const mock = client();
    const result = await getActivityRecommendations(mock.value);
    expect(result.recommendations).toHaveLength(20);
    expect(mock.query.in.mock.calls.map(([, ids]) => ids.length)).toEqual([100, 100, 5]);
  });
  it('returns a timeout within three seconds and prevents late profile reads launching more queries', async () => {
    let resolve!: (value: Profile) => void;
    vi.mocked(getProfile).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const result = getActivityRecommendations(client().value);
    const assertion = expect(result).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
    resolve({ id: 'resident', role: 'resident', status: 'active', ...prefs } as unknown as Profile);
    await Promise.resolve();
    await Promise.resolve();
    expect(listActivities).not.toHaveBeenCalled();
  });
});
