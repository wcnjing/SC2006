import { createElement } from 'react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityList } from '../src/activities/ActivityList';
import ActivityDetails from '../src/app/activities/[id]';

const state = vi.hoisted(() => ({
  data: null as unknown,
  loading: false,
  error: null as string | null,
  retry: vi.fn(),
  organiser: {
    data: null as string | null,
    loading: false,
    error: null as string | null,
    retry: vi.fn(),
  },
  neighbourhoods: {
    data: [
      { id: 1, name: 'Bishan' },
      { id: 2, name: 'Tampines' },
    ],
    loading: false,
    error: null as string | null,
    retry: vi.fn(),
  },
}));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useState: vi.fn(actual.useState) };
});
vi.mock('../src/activities/useActivityQuery', () => ({
  useActivityQuery: (load: () => Promise<unknown>) =>
    load.name === 'loadNeighbourhoods'
      ? state.neighbourhoods
      : load.name === 'loadOrganiser'
        ? state.organiser
        : state,
}));
vi.mock('../src/activities/OrganiserActivityLinks', () => ({ OrganiserActivityLinks: () => null }));
vi.mock('../src/activities/ActivityRecommendations', () => ({
  ActivityRecommendationLink: () => null,
}));
vi.mock('../src/activities/ActivityRatings', () => ({
  ActivityRatings: () => null,
  ActivityRatingLinks: () => null,
}));
vi.mock('../src/activities/ActivityActions', () => ({
  ActivityActions: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '11111111-1111-4111-8111-111111111111' }),
  Link: ({ href, children }: { href: string | { params: { id: string } }; children: string }) =>
    createElement(
      'a',
      {
        href: typeof href === 'string' ? href : `/activities/${href.params.id}`,
      },
      children,
    ),
}));

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  state.data = null;
  state.loading = false;
  state.error = null;
  state.organiser.data = null;
  state.organiser.loading = false;
  state.organiser.error = null;
  state.neighbourhoods.loading = false;
  state.neighbourhoods.error = null;
  state.neighbourhoods.retry.mockClear();
});

const activity = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Community walk',
  description: 'Meet your neighbours.',
  category: 'Exercise',
  neighbourhood_id: 1,
  lat: 1.3,
  lng: 103.8,
  status: 'scheduled',
  starts_at: '2026-12-01T08:00:00Z',
  ends_at: '2026-12-01T09:00:00Z',
  location_name: 'Community park',
  address: '10 Park Road',
  cost_cents: 1250,
  capacity: 20,
  is_outdoor: true,
  accessibility_features: ['Wheelchair access'],
  tags: ['Walking'],
  cancelled_reason: null,
};

describe('activity screens on React Native Web', () => {
  it('links each listed activity to its details route', () => {
    state.data = [activity];
    const html = renderToStaticMarkup(<ActivityList />);
    expect(html).toContain(`/activities/${activity.id}`);
    expect(html).toContain('Community walk');
    expect(html).toContain('Community park');
  });

  it('shows an empty list message', () => {
    state.data = [];
    expect(renderToStaticMarkup(<ActivityList />)).toContain('No upcoming activities available.');
  });

  it.each([ActivityList, ActivityDetails])(
    'shows loading without an empty or missing message',
    (Screen) => {
      state.loading = true;
      const html = renderToStaticMarkup(<Screen />);
      expect(html).toContain('Loading activit');
      expect(html).not.toContain('No upcoming');
      expect(html).not.toContain('Activity not found');
    },
  );

  it.each([ActivityList, ActivityDetails])('shows errors with a retry action', (Screen) => {
    state.error = 'Unable to load activities.';
    const html = renderToStaticMarkup(<Screen />);
    expect(html).toContain(state.error);
    expect(html).toContain('Retry');
  });

  it('shows full user-facing details and a link back', () => {
    state.data = activity;
    const html = renderToStaticMarkup(<ActivityDetails />);
    for (const text of [
      'Meet your neighbours.',
      '10 Park Road',
      'SGD 12.50',
      'Capacity: 20',
      'Outdoor',
      'Wheelchair access',
      'Walking',
      'Starts:',
      'Ends:',
      'Back to activities',
    ]) {
      expect(html).toContain(text);
    }
  });

  it('shows missing details without crashing', () => {
    expect(renderToStaticMarkup(<ActivityDetails />)).toContain(
      'Activity not found or no longer available.',
    );
  });

  it('shows free pricing, missing optional data, and cancellation reason', () => {
    state.data = {
      ...activity,
      cost_cents: 0,
      address: null,
      capacity: null,
      accessibility_features: [],
      tags: [],
      status: 'cancelled',
      cancelled_reason: 'Rain',
    };
    const html = renderToStaticMarkup(<ActivityDetails />);
    expect(html).toContain('Free');
    expect(html).toContain('Not specified');
    expect(html).toContain('Cancellation reason: Rain');
  });
});

describe('search and filter controls on Web', () => {
  it('renders labelled inputs, data-derived categories and a clear action', () => {
    state.data = [activity, { ...activity, id: 'other', category: 'Arts' }];
    const html = renderToStaticMarkup(<ActivityList />);
    for (const text of [
      'My Activities',
      'Search activities',
      'Filter by location',
      'All categories',
      'All neighbourhoods',
      'Bishan',
      'Tampines',
      'Exercise',
      'Arts',
      'From date',
      'To date',
      'Any accessibility',
      'Indoor',
      'Outdoor',
      'Use my current location',
      'Within 5 km',
      'Clear filters',
      '2 activities found',
    ]) {
      expect(html).toContain(text);
    }
  });

  it('renders combined filters and retains detail links', () => {
    state.data = [activity, { ...activity, id: 'other', title: 'Art class', category: 'Arts' }];
    vi.mocked(React.useState).mockReturnValueOnce([
      {
        keyword: 'WALK',
        category: 'Exercise',
        location: 'park',
        neighbourhoodId: 1,
        dateFrom: '2026-12-01',
        dateTo: '2026-12-01',
        accessibility: ['Wheelchair access'],
        environment: 'outdoor',
        distance: { origin: { lat: 1.3, lng: 103.8 }, maxKm: 5 },
      },
      vi.fn(),
    ]);
    const html = renderToStaticMarkup(<ActivityList />);
    expect(html).toContain('1 activities found');
    expect(html).toContain(`/activities/${activity.id}`);
    expect(html).not.toContain('/activities/other');
    expect(html).toContain('Arts'); // Options remain available when their results are hidden.
  });

  it('distinguishes no matches from no upcoming activities', () => {
    state.data = [activity];
    vi.mocked(React.useState).mockReturnValueOnce([{ keyword: 'no-match' }, vi.fn()]);
    const html = renderToStaticMarkup(<ActivityList />);
    expect(html).toContain('No activities match your filters.');
    expect(html).not.toContain('No upcoming activities available.');
  });
});

it('clears every activity filter together', () => {
  state.data = [activity];
  const setFilters = vi.fn();
  vi.mocked(React.useState).mockReturnValueOnce([
    {
      keyword: 'walk',
      neighbourhoodId: 1,
      category: 'Exercise',
      location: 'park',
      dateFrom: '2026-12-01',
      dateTo: '2026-12-02',
      accessibility: ['Wheelchair access'],
      environment: 'outdoor',
      distance: { origin: { lat: 1.3, lng: 103.8 }, maxKm: 5 },
    },
    setFilters,
  ]);
  const screen = ActivityList();
  const clear = React.Children.toArray(screen.props.ListHeaderComponent.props.children).find(
    (child) =>
      React.isValidElement<{ title?: string }>(child) && child.props.title === 'Clear filters',
  );
  expect(React.isValidElement(clear)).toBe(true);
  if (!React.isValidElement<{ onPress: () => void }>(clear))
    throw new Error('Missing clear action');
  clear.props.onPress();
  expect(setFilters).toHaveBeenCalledWith({});
});

it('updates date, accessibility, setting and distance immediately without losing existing filters', () => {
  state.data = [activity];
  const current = { keyword: 'walk', category: 'Exercise', location: 'park' };
  const setFilters = vi.fn();
  vi.mocked(React.useState).mockReturnValueOnce([current, setFilters]);
  const header = ActivityList().props.ListHeaderComponent;
  const elements: React.ReactElement<Record<string, unknown>>[] = [];
  function visit(children: React.ReactNode) {
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement<Record<string, unknown>>(child)) return;
      elements.push(child);
      visit(child.props.children as React.ReactNode);
    });
  }
  visit(header);
  const from = elements.find((child) => child.props.accessibilityLabel === 'From date')!;
  (from.props.onChangeText as (text: string) => void)('2026-12-01');
  expect(setFilters.mock.calls.at(-1)![0](current)).toEqual({ ...current, dateFrom: '2026-12-01' });
  const feature = elements.find((child) => child.props.title === 'Wheelchair access')!;
  (feature.props.onPress as () => void)();
  const toggle = setFilters.mock.calls.at(-1)![0];
  expect(toggle(current)).toEqual({ ...current, accessibility: ['Wheelchair access'] });
  expect(toggle({ ...current, accessibility: ['Wheelchair access'] })).toEqual({
    ...current,
    accessibility: [],
  });
  const indoor = elements.find((child) => child.props.title === 'Indoor')!;
  (indoor.props.onPress as () => void)();
  expect(setFilters.mock.calls.at(-1)![0](current)).toEqual({ ...current, environment: 'indoor' });
  const distanceControl = elements.find((child) => typeof child.props.onChange === 'function')!;
  const distance = { origin: { lat: 1.3, lng: 103.8 }, maxKm: 5 };
  (distanceControl.props.onChange as (value: unknown) => void)(distance);
  expect(setFilters.mock.calls.at(-1)![0](current)).toEqual({ ...current, distance });
});

it('shows invalid date feedback instead of silently returning unfiltered results', () => {
  state.data = [activity];
  vi.mocked(React.useState).mockReturnValueOnce([{ dateFrom: '2026-02-30' }, vi.fn()]);
  const html = renderToStaticMarkup(<ActivityList />);
  expect(html).toContain('Enter valid dates as YYYY-MM-DD.');
  expect(html).not.toContain(`/activities/${activity.id}`);
});

it('shows neighbourhood-only empty results and retains all options', () => {
  state.data = [activity];
  vi.mocked(React.useState).mockReturnValueOnce([{ neighbourhoodId: 2 }, vi.fn()]);
  const html = renderToStaticMarkup(<ActivityList />);
  expect(html).toContain('No activities match your filters.');
  expect(html).toContain('Tampines neighbourhood, selected');
  expect(html).toContain('Bishan');
  expect(html).not.toContain(`/activities/${activity.id}`);
});
it('selects and clears neighbourhood immediately while retaining other filters', () => {
  state.data = [activity];
  const current = { keyword: 'walk', location: 'park', neighbourhoodId: 2 };
  const setFilters = vi.fn();
  vi.mocked(React.useState).mockReturnValueOnce([current, setFilters]);
  const children = ActivityList().props.ListHeaderComponent.props.children;
  const neighbourhoodGroup = React.Children.toArray(children).find(
    (child) =>
      React.isValidElement<{ children?: React.ReactNode }>(child) &&
      React.Children.toArray(child.props.children).some(
        (button) =>
          React.isValidElement<{ title?: string }>(button) &&
          button.props.title === 'All neighbourhoods',
      ),
  );
  if (!React.isValidElement<{ children: React.ReactNode }>(neighbourhoodGroup))
    throw new Error('Missing neighbourhood controls');
  for (const [title, neighbourhoodId] of [
    ['Bishan', 1],
    ['All neighbourhoods', undefined],
  ] as const) {
    const button = React.Children.toArray(neighbourhoodGroup.props.children).find(
      (child) => React.isValidElement<{ title?: string }>(child) && child.props.title === title,
    );
    if (!React.isValidElement<{ onPress: () => void }>(button)) throw new Error('Missing option');
    button.props.onPress();
    expect(setFilters.mock.calls.at(-1)![0](current)).toEqual({ ...current, neighbourhoodId });
  }
});
it('shows neighbourhood loading and retry without hiding activity results', () => {
  state.data = [activity];
  state.neighbourhoods.loading = true;
  expect(renderToStaticMarkup(<ActivityList />)).toContain('Loading neighbourhoods');
  state.neighbourhoods.loading = false;
  state.neighbourhoods.error = 'Unable to load neighbourhoods.';
  const html = renderToStaticMarkup(<ActivityList />);
  expect(html).toContain(state.neighbourhoods.error);
  expect(html).toContain('Retry neighbourhoods');
  expect(html).toContain(`/activities/${activity.id}`);
});

describe('organiser information on activity details', () => {
  it('shows the organiser display name without private identifiers', () => {
    state.data = {
      ...activity,
      source: 'organiser',
      organiser_id: 'private-organiser-id',
      email: 'private@example.com',
      phone: 'private-phone',
    };
    state.organiser.data = 'Community Host';
    const html = renderToStaticMarkup(<ActivityDetails />);
    expect(html).toContain('Organiser: Community Host');
    for (const privateValue of ['private-organiser-id', 'private@example.com', 'private-phone'])
      expect(html).not.toContain(privateValue);
    expect(html).toContain('Meet your neighbours.');
  });
  it.each(['dataset', 'organiser'])(
    'shows a graceful fallback for unavailable %s organiser information',
    (source) => {
      state.data = { ...activity, source, organiser_id: null };
      const html = renderToStaticMarkup(<ActivityDetails />);
      expect(html).toContain('Organiser information unavailable.');
      expect(html).toContain('When and where');
    },
  );
  it('shows loading feedback and keeps details visible when the name query fails', () => {
    state.data = activity;
    state.organiser.loading = true;
    expect(renderToStaticMarkup(<ActivityDetails />)).toContain('Loading organiser');
    state.organiser.loading = false;
    state.organiser.error = 'Private server diagnostic';
    const html = renderToStaticMarkup(<ActivityDetails />);
    expect(html).toContain('Organiser information unavailable.');
    expect(html).toContain('Activity information');
    expect(html).not.toContain(state.organiser.error);
  });
});
