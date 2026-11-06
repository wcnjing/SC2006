import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ActivityRecommendations as Result } from '@communitylink/shared';
import {
  ActivityRecommendationLink,
  ActivityRecommendations,
} from '../src/activities/ActivityRecommendations';
const mocks = vi.hoisted(() => ({
  session: { user: { id: 'resident' } } as { user: { id: string } } | null,
  profile: { id: 'resident', role: 'resident', status: 'active' },
  query: {
    data: null as Result | null,
    loading: false,
    error: null as string | null,
    retry: vi.fn(),
  },
}));
vi.mock('../src/auth/AuthProvider', () => ({
  useAuth: () => ({ session: mocks.session, profile: mocks.profile }),
}));
vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/activities/useActivityQuery', () => ({ useActivityQuery: () => mocks.query }));
vi.mock('expo-router', () => ({
  Link: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string | { params: { id: string } };
  }) => <a href={typeof href === 'string' ? href : `/activities/${href.params.id}`}>{children}</a>,
}));
beforeEach(() => {
  mocks.session = { user: { id: 'resident' } };
  mocks.profile = { id: 'resident', role: 'resident', status: 'active' };
  mocks.query = {
    data: { personalised: false, origin: null, recommendations: [] },
    loading: false,
    error: null,
    retry: vi.fn(),
  };
});
it.each([
  ['organiser', 'active'],
  ['admin', 'active'],
  ['resident', 'suspended'],
])('guards %s/%s at both entry and route', (role, status) => {
  mocks.profile = { ...mocks.profile, role, status };
  expect(renderToStaticMarkup(<ActivityRecommendationLink />)).toBe('');
  expect(renderToStaticMarkup(<ActivityRecommendations />)).toContain(
    'active resident account is required',
  );
});
it('guards signed-out and mismatched sessions', () => {
  mocks.session = null;
  expect(renderToStaticMarkup(<ActivityRecommendations />)).toContain(
    'active resident account is required',
  );
  mocks.session = { user: { id: 'other' } };
  expect(renderToStaticMarkup(<ActivityRecommendationLink />)).toBe('');
});
it('offers resident navigation and explains missing preferences and empty results', () => {
  expect(renderToStaticMarkup(<ActivityRecommendationLink />)).toContain(
    '/activities/recommendations',
  );
  const html = renderToStaticMarkup(<ActivityRecommendations />);
  expect(html).toContain('Explore activities nearby and popular in your community');
  expect(html).toContain('No suitable activities right now');
  expect(html).toContain('meet your needs');
  expect(html).toContain('Use my current location');
});
it('shows reasons and links to the existing detail actions', () => {
  mocks.query.data = {
    personalised: true,
    origin: { lat: 1, lng: 103, source: 'neighbourhood', label: 'Central neighbourhood centre' },
    recommendations: [
      {
        activity: {
          id: 'activity-one',
          title: 'Sports day',
          location_name: 'Park',
          starts_at: '2026-10-11T12:00:00Z',
        } as Result['recommendations'][number]['activity'],
        score: 85,
        reasons: ['Matches your interests: sports.'],
        distanceKm: 1,
        joinedCount: 5,
        scores: { interests: 60, proximity: 20, popularity: 5 },
      },
    ],
  };
  const html = renderToStaticMarkup(<ActivityRecommendations />);
  expect(html).toContain('/activities/activity-one');
  expect(html).toContain('Matches your interests: sports');
  expect(html).not.toContain('85.0 / 100');
  expect(html).not.toContain('Recommendation score');
  expect(html).toContain('1.0 km away (approximate)');
  expect(html).toContain('5 people joined');
});
it('shows generation and server errors with a refresh control', () => {
  mocks.query.loading = true;
  expect(renderToStaticMarkup(<ActivityRecommendations />)).toContain('Generating recommendations');
  mocks.query.loading = false;
  mocks.query.error = 'Recommendations took longer than 3 seconds. Please retry.';
  const html = renderToStaticMarkup(<ActivityRecommendations />);
  expect(html).toContain('longer than 3 seconds');
  expect(html).toContain('Refresh recommendations');
});

it('hides unsupported and technical reasons while keeping supported accessibility', () => {
  mocks.query.data = {
    personalised: false,
    origin: null,
    recommendations: [
      {
        activity: {
          id: 'one',
          title: 'Gardening',
          location_name: 'Garden',
          starts_at: '2026-12-01T08:00:00Z',
        } as Result['recommendations'][number]['activity'],
        score: 15,
        scores: { interests: 0, proximity: 0, popularity: 0 },
        distanceKm: null,
        joinedCount: 0,
        reasons: [
          'Proximity unavailable: coordinates are missing.',
          'Upcoming eligible activity; no interest match or existing registrations.',
          'Meets all your accessibility requirements: wheelchair access.',
        ],
      },
    ],
  };
  const html = renderToStaticMarkup(<ActivityRecommendations />);
  expect(html).toContain('Matches your accessibility needs: wheelchair access.');
  expect(html).not.toContain('Proximity unavailable');
  expect(html).not.toContain('existing registrations');
  expect(html).not.toContain('km away');
  expect(html).not.toContain('0 people joined');
});
