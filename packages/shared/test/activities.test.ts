import { describe, expect, it, vi } from 'vitest';
import {
  filterActivities,
  getActivity,
  getActivityOrganiserName,
  listActivities,
} from '../src/api/activities';
import { ApiError, type CommunityLinkClient } from '../src/api/client';

const id = '11111111-1111-4111-8111-111111111111';
function mockClient(data: unknown, error: { message: string; code: string } | null = null) {
  let reads = 0;
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    then: (resolve: (result: unknown) => unknown) =>
      Promise.resolve({ data: Array.isArray(data) && reads++ > 0 ? [] : data, error }).then(
        resolve,
      ),
  };
  const from = vi.fn(() => query);
  return { client: { from } as unknown as CommunityLinkClient, from, query };
}

describe('activity discovery API', () => {
  it('reads upcoming scheduled activities in stable start-time order', async () => {
    const rows = [{ id, title: 'Community walk' }];
    const { client, from, query } = mockClient(rows);
    const before = Date.now();
    expect(await listActivities(client)).toEqual(rows);
    expect(from).toHaveBeenCalledWith('activities');
    expect(query.eq).toHaveBeenCalledWith('status', 'scheduled');
    expect(query.gte.mock.calls[0]![0]).toBe('starts_at');
    expect(Date.parse(query.gte.mock.calls[0]![1])).toBeGreaterThanOrEqual(before);
    expect(query.order.mock.calls.slice(0, 2)).toEqual([['starts_at'], ['id']]);
    expect(query.range.mock.calls).toEqual([
      [0, 499],
      [1, 500],
    ]);
    expect(query.gte.mock.calls[1]![1]).toBe(query.gte.mock.calls[0]![1]);
  });

  it('returns an empty list when no activities are available', async () => {
    expect(await listActivities(mockClient([]).client)).toEqual([]);
  });

  it('loads later pages even when the server row cap is smaller than requested', async () => {
    const { client, query } = mockClient([]);
    const pages = [[{ id: 'first', title: 'Walk' }], [{ id: 'last', title: 'Workshop' }], []];
    query.then = (resolve) =>
      Promise.resolve({ data: pages.shift() ?? [], error: null }).then(resolve);
    expect(await listActivities(client)).toEqual([
      { id: 'first', title: 'Walk' },
      { id: 'last', title: 'Workshop' },
    ]);
    expect(query.range.mock.calls).toEqual([
      [0, 499],
      [1, 500],
      [2, 501],
    ]);
  });

  it('rejects later-page errors rather than showing a misleading partial list', async () => {
    const { client, query } = mockClient([]);
    let page = 0;
    query.then = (resolve) =>
      Promise.resolve(
        page++ === 0
          ? { data: [{ id }], error: null }
          : { data: null, error: { code: '42501', message: 'permission denied' } },
      ).then(resolve);
    await expect(listActivities(client)).rejects.toMatchObject({ code: '42501' });
  });

  it('reads full details by ID without excluding cancelled activities', async () => {
    const row = { id, description: 'Full details', status: 'cancelled' };
    const { client, query } = mockClient(row);
    expect(await getActivity(client, id)).toEqual(row);
    expect(query.select).toHaveBeenCalledWith('*');
    expect(query.eq.mock.calls).toEqual([['id', id]]);
    expect(query.maybeSingle).toHaveBeenCalledOnce();
  });

  it('returns null for a missing or inaccessible activity', async () => {
    expect(await getActivity(mockClient(null).client, id)).toBeNull();
  });

  it('rejects invalid IDs before making a database request', async () => {
    const { client, from } = mockClient(null);
    await expect(getActivity(client, 'bad-id')).rejects.toMatchObject({
      code: 'validation',
    });
    expect(from).not.toHaveBeenCalled();
  });

  it.each(['list', 'details'])('preserves API error handling for %s', async (operation) => {
    const { client } = mockClient(null, {
      message: 'row-level security denied',
      code: '42501',
    });
    const request = operation === 'list' ? listActivities(client) : getActivity(client, id);
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({
      message: 'You do not have permission to do that.',
      code: '42501',
    });
  });
});

describe('activity search and filters', () => {
  const activities = [
    {
      title: 'Community walk',
      description: 'Meet your neighbours',
      tags: ['Exercise'],
      category: 'Fitness',
      location_name: 'Park',
      address: '10 North Road',
    },
    {
      title: 'Art workshop',
      description: 'Paint together',
      tags: ['Creative'],
      category: 'Arts',
      location_name: 'Community Hall',
      address: null,
    },
    {
      title: 'Yoga',
      description: 'Stretch together',
      tags: [],
      category: 'Fitness',
      location_name: 'Community Hall',
      address: '20 South Road',
    },
  ];

  it.each([
    [' WALK ', 'Community walk'],
    ['paint', 'Art workshop'],
    ['creative', 'Art workshop'],
  ])('searches titles, descriptions and tags with %s', (keyword, title) => {
    expect(filterActivities(activities, { keyword }).map((activity) => activity.title)).toEqual([
      title,
    ]);
  });

  it('filters by exact category, ignoring case and surrounding whitespace', () => {
    expect(filterActivities(activities, { category: ' FITNESS ' })).toEqual([
      activities[0],
      activities[2],
    ]);
    expect(filterActivities(activities, { category: 'Fit' })).toEqual([]);
  });

  it('matches venue names or addresses and handles null addresses', () => {
    expect(filterActivities(activities, { location: ' HALL ' })).toEqual([
      activities[1],
      activities[2],
    ]);
    expect(filterActivities(activities, { location: 'north' })).toEqual([activities[0]]);
  });

  it('combines keyword, category and location with AND', () => {
    expect(
      filterActivities(activities, { keyword: 'together', category: 'Fitness', location: 'hall' }),
    ).toEqual([activities[2]]);
    expect(filterActivities(activities, { keyword: 'paint', category: 'Fitness' })).toEqual([]);
  });

  it('restores the full list in its original order when filters are cleared', () => {
    expect(filterActivities(activities, {})).toEqual(activities);
    expect(filterActivities(activities, { keyword: '  ', category: '', location: ' ' })).toEqual(
      activities,
    );
  });

  it('treats SQL and query punctuation as literal search text', () => {
    expect(filterActivities(activities, { keyword: '%_(),"' })).toEqual([]);
  });

  it('handles an empty input list without mutating its source', () => {
    expect(filterActivities([], { keyword: 'walk' })).toEqual([]);
    const copy = structuredClone(activities);
    filterActivities(activities, { category: 'Fitness' });
    expect(activities).toEqual(copy);
  });
});

describe('neighbourhood relationship filtering', () => {
  const activity = {
    title: 'Walk',
    description: 'Neighbours',
    tags: [],
    category: 'Fitness',
    location_name: 'Park',
    address: 'Road',
    starts_at: '2027-01-01T00:00:00Z',
    accessibility_features: ['wheelchair-access'],
    is_outdoor: true,
    lat: 1.3,
    lng: 103.8,
    neighbourhood_id: 1,
  };
  const activities = [
    activity,
    { ...activity, neighbourhood_id: 2 },
    { ...activity, neighbourhood_id: null },
  ];
  it('matches the foreign key exactly, excludes missing IDs and restores all on clear', () => {
    expect(filterActivities(activities, { neighbourhoodId: 1 })).toEqual([activity]);
    expect(filterActivities(activities, { neighbourhoodId: 3 })).toEqual([]);
    expect(filterActivities(activities, {})).toEqual(activities);
    expect(filterActivities([], { neighbourhoodId: 1 })).toEqual([]);
  });
  it('combines neighbourhood with every existing filter using AND', () => {
    const filters = {
      neighbourhoodId: 1,
      keyword: 'walk',
      category: 'Fitness',
      location: 'road',
      dateFrom: '2027-01-01',
      dateTo: '2027-01-01',
      accessibility: ['wheelchair-access'],
      environment: 'outdoor' as const,
      distance: { origin: { lat: 1.3, lng: 103.8 }, maxKm: 5 },
    };
    expect(filterActivities(activities, filters)).toEqual([activity]);
    for (const patch of [
      { keyword: 'art' },
      { category: 'Arts' },
      { location: 'hall' },
      { dateFrom: '2027-01-02', dateTo: '2027-01-02' },
      { accessibility: ['hearing-loop'] },
      { environment: 'indoor' as const },
      { distance: { origin: { lat: 0, lng: 0 }, maxKm: 5 } },
    ]) {
      expect(filterActivities(activities, { ...filters, ...patch })).toEqual([]);
    }
  });
});

describe('activity organiser display name', () => {
  const organiserActivity = { source: 'organiser' as const, organiser_id: id };
  it('reads only display_name through the existing organiser profile relationship', async () => {
    const { client, from, query } = mockClient({
      display_name: ' Community Host ',
      email: 'private@example.com',
      phone: 'private',
    });
    expect(await getActivityOrganiserName(client, organiserActivity)).toBe('Community Host');
    expect(from).toHaveBeenCalledWith('profiles');
    expect(query.select).toHaveBeenCalledWith('display_name');
    expect(query.eq).toHaveBeenCalledWith('id', id);
  });
  it.each([
    { source: 'dataset' as const, organiser_id: null },
    { source: 'dataset' as const, organiser_id: id },
    { source: 'organiser' as const, organiser_id: null },
  ])('does not invent names or query a profile for %j', async (activity) => {
    const { client, from } = mockClient(null);
    expect(await getActivityOrganiserName(client, activity)).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
  it.each([null, { display_name: '   ' }])(
    'returns no name for missing or blank profiles %j',
    async (profile) => {
      expect(
        await getActivityOrganiserName(mockClient(profile).client, organiserActivity),
      ).toBeNull();
    },
  );
  it('preserves permission and server errors for the screen to handle', async () => {
    for (const code of ['42501', '500']) {
      await expect(
        getActivityOrganiserName(
          mockClient(null, { code, message: 'Read failed' }).client,
          organiserActivity,
        ),
      ).rejects.toBeInstanceOf(ApiError);
    }
  });
});
