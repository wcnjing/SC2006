import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  submitActivityRating,
  type Activity,
  type ActivityRating,
  type ActivityRatingEligibility,
} from '@communitylink/shared';
import JoinedActivityReviews from '../src/app/activities/reviews';
import { ActivityRatings, ActivityRatingLinks } from '../src/activities/ActivityRatings';

const mocks = vi.hoisted(() => ({
  session: { user: { id: 'resident-one' } } as { user: { id: string } } | null,
  profile: { id: 'resident-one', role: 'resident', status: 'active' } as {
    id: string;
    role: string;
    status: string;
  } | null,
  reviews: {
    data: [] as ActivityRating[] | Activity[] | null,
    loading: false,
    error: null as string | null,
    retry: vi.fn(),
  },
  eligibility: {
    data: null as ActivityRatingEligibility | null,
    loading: false,
    error: null as string | null,
    retry: vi.fn(),
  },
  queryIndex: 0,
  stateIndex: 0,
  states: [] as unknown[],
  updates: [] as { index: number; value: unknown }[],
  buttons: new Map<string, { disabled?: boolean; onPress: () => void }>(),
}));
vi.mock('expo-router', () => ({
  Link: ({ children, href }: { children: string; href: string | { params: { id: string } } }) => (
    <a href={typeof href === 'string' ? href : `/activities/${href.params.id}`}>{children}</a>
  ),
}));
vi.mock('../src/auth/AuthProvider', () => ({
  useAuth: () => ({ session: mocks.session, profile: mocks.profile }),
}));
vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/activities/useActivityQuery', () => ({
  useActivityQuery: () => (mocks.queryIndex++ === 0 ? mocks.reviews : mocks.eligibility),
}));
vi.mock('@communitylink/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@communitylink/shared')>()),
  submitActivityRating: vi.fn(),
}));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const [value] = actual.useState(initial);
      const index = mocks.stateIndex++;
      return [
        index in mocks.states ? mocks.states[index] : value,
        (next: unknown) => {
          mocks.updates.push({ index, value: next });
        },
      ];
    },
  };
});
vi.mock('react-native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-native')>()),
  Button: (props: { title: string; disabled?: boolean; onPress: () => void }) => {
    mocks.buttons.set(props.title, props);
    return <button disabled={props.disabled}>{props.title}</button>;
  },
}));
const activity = {
  id: 'activity-one',
  status: 'completed',
  ends_at: '2026-10-10T11:00:00Z',
} as Activity;
const row: ActivityRating = {
  activity_id: activity.id,
  user_id: 'resident-one',
  rating: 4,
  comment: 'Friendly event',
  created_at: '2026-10-10T12:00:00Z',
};
function render(states: unknown[] = []) {
  mocks.queryIndex = 0;
  mocks.stateIndex = 0;
  mocks.states = states;
  mocks.buttons.clear();
  return renderToStaticMarkup(<ActivityRatings activityId={activity.id} />);
}
function press(title: string) {
  const button = mocks.buttons.get(title);
  if (!button || button.disabled) throw new Error(`Missing or disabled ${title}`);
  button.onPress();
}
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}
beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-10T12:00:00Z'));
  mocks.session = { user: { id: 'resident-one' } };
  mocks.profile = { id: 'resident-one', role: 'resident', status: 'active' };
  mocks.reviews.data = [];
  mocks.reviews.error = null;
  mocks.reviews.loading = false;
  mocks.reviews.retry.mockClear();
  mocks.eligibility.data = { activity, joined: true, rating: null };
  mocks.eligibility.loading = false;
  mocks.eligibility.error = null;
  mocks.eligibility.retry.mockClear();
  mocks.updates = [];
  vi.mocked(submitActivityRating).mockReset().mockResolvedValue(row);
});
afterEach(() => vi.restoreAllMocks());

describe('ratings and reviews on Expo Web', () => {
  it('shows an empty review message, five star choices and optional feedback for an eligible resident', () => {
    const html = render();
    for (const text of [
      'Ratings and reviews',
      'No ratings yet.',
      'Your rating',
      'Optional written feedback',
      '1,000 characters',
      'Submit rating',
    ])
      expect(html).toContain(text);
    for (const star of [1, 2, 3, 4, 5]) expect(mocks.buttons.has(`${star} ★`)).toBe(true);
    expect(html).not.toContain('Edit rating');
    expect(html).not.toContain('Delete rating');
  });
  it('shows the average, all reviews and star-only feedback', () => {
    mocks.reviews.data = [row, { ...row, user_id: 'other', rating: 2, comment: null }];
    const html = render();
    expect(html).toContain('Average rating: 3.0 / 5 (2 ratings)');
    expect(html).toContain('Friendly event');
    expect(html).toContain('No written feedback.');
    expect(html).toContain('4 out of 5 stars');
  });
  it('renders written feedback as escaped text, never HTML', () => {
    mocks.reviews.data = [{ ...row, comment: '<script>alert(1)</script>' }];
    const html = render();
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
  it('shows independent loading/errors for reviews and resident eligibility', () => {
    mocks.reviews.loading = true;
    expect(render()).toContain('Loading activity reviews');
    expect(render()).not.toContain('No ratings yet.');
    mocks.reviews.loading = false;
    mocks.reviews.error = 'Reviews unavailable';
    expect(render()).toContain('Retry reviews');
    expect(render()).toContain('Submit rating');
    mocks.reviews.error = null;
    mocks.reviews.data = [row];
    mocks.eligibility.error = 'Eligibility unavailable';
    const html = render();
    expect(html).toContain('Friendly event');
    expect(html).toContain('Retry rating eligibility');
    expect(html).not.toContain('Submit rating');
    mocks.eligibility.error = null;
    mocks.eligibility.loading = true;
    expect(render()).toContain('Checking rating eligibility');
  });
  it.each(['future', 'cancelled', 'not-joined'])(
    'does not offer submission for %s activities',
    (kind) => {
      if (kind === 'future')
        mocks.eligibility.data!.activity = { ...activity, ends_at: '2027-01-01T00:00:00Z' };
      if (kind === 'cancelled')
        mocks.eligibility.data!.activity = { ...activity, status: 'cancelled' };
      if (kind === 'not-joined') mocks.eligibility.data!.joined = false;
      expect(render()).not.toContain('Submit rating');
      expect(submitActivityRating).not.toHaveBeenCalled();
    },
  );
  it('shows a persisted own rating after reopening even if the resident has since left', () => {
    mocks.eligibility.data = { activity, joined: false, rating: row };
    const html = render();
    expect(html).toContain('already rated this activity: 4 / 5 stars');
    expect(html).toContain('Friendly event');
    expect(html).not.toContain('Submit rating');
  });
  it.each(['organiser', 'admin', 'suspended', 'mismatched-session'])(
    'allows review display but no resident form for %s',
    (kind) => {
      mocks.reviews.data = [row];
      if (kind === 'suspended') mocks.profile!.status = 'suspended';
      else if (kind === 'mismatched-session') mocks.profile!.id = 'other';
      else mocks.profile!.role = kind;
      const html = render();
      expect(html).toContain('Friendly event');
      expect(html).toContain('active resident account');
      expect(html).not.toContain('Submit rating');
      expect(mocks.queryIndex).toBe(1);
      expect(renderToStaticMarkup(<ActivityRatingLinks />)).toBe('');
      expect(renderToStaticMarkup(<JoinedActivityReviews />)).toContain('active resident account');
    },
  );
  it('does not load reviews or offer submission without authentication', () => {
    mocks.session = null;
    expect(render()).toContain('Sign in to view');
    expect(mocks.queryIndex).toBe(0);
  });
  it('selects a star and validates missing stars/overlong feedback before making a request', () => {
    render();
    press('5 ★');
    expect(mocks.updates).toContainEqual({ index: 0, value: 5 });
    press('Submit rating');
    expect(mocks.updates).toContainEqual({
      index: 3,
      value: 'Choose a whole-number rating from 1 to 5 stars.',
    });
    render([4, 'x'.repeat(1001)]);
    press('Submit rating');
    expect(mocks.updates).toContainEqual({
      index: 3,
      value: 'Written feedback must be 1,000 characters or fewer.',
    });
    expect(submitActivityRating).not.toHaveBeenCalled();
    expect(mocks.reviews.retry).not.toHaveBeenCalled();
  });
  it('submits once during duplicate clicks and refreshes the public average/reviews on success', async () => {
    let resolve!: (value: ActivityRating) => void;
    vi.mocked(submitActivityRating).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render([4, 'Friendly event']);
    press('Submit rating');
    press('Submit rating');
    expect(submitActivityRating).toHaveBeenCalledTimes(1);
    expect(submitActivityRating).toHaveBeenCalledWith({}, activity.id, {
      rating: 4,
      comment: 'Friendly event',
    });
    resolve(row);
    await flush();
    expect(mocks.updates).toContainEqual({ index: 4, value: row });
    expect(mocks.reviews.retry).toHaveBeenCalledTimes(1);
    const html = render([4, 'Friendly event', false, null, row]);
    expect(html).toContain('Thank you. Your rating was submitted.');
    expect(html).not.toContain('Submit rating');
  });
  it('reports duplicate/server errors and reloads eligibility without claiming success', async () => {
    vi.mocked(submitActivityRating).mockRejectedValueOnce(
      new Error('You have already rated this activity.'),
    );
    render([4]);
    press('Submit rating');
    await flush();
    expect(mocks.updates).toContainEqual({
      index: 3,
      value: 'You have already rated this activity.',
    });
    expect(mocks.eligibility.retry).toHaveBeenCalledTimes(1);
    expect(mocks.updates.some((update) => update.index === 4)).toBe(false);
    vi.mocked(submitActivityRating).mockRejectedValueOnce(new Error('Server unavailable'));
    render([4]);
    press('Submit rating');
    await flush();
    expect(mocks.updates).toContainEqual({ index: 3, value: 'Server unavailable' });
  });
  it('disables star choices, feedback and submit while sending', () => {
    const html = render([4, '', true]);
    expect(mocks.buttons.get('4 ★')!.disabled).toBe(true);
    expect(mocks.buttons.get('Submitting rating…')!.disabled).toBe(true);
    expect(html.toLowerCase()).toContain('readonly');
  });
});

describe('navigation to concluded joined activities', () => {
  it('provides an active resident link and opens concluded activity details', () => {
    expect(renderToStaticMarkup(<ActivityRatingLinks />)).toContain('/activities/reviews');
    mocks.queryIndex = 0;
    mocks.reviews.data = [{ ...activity, title: 'Community walk' }];
    const html = renderToStaticMarkup(<JoinedActivityReviews />);
    expect(html).toContain('Community walk');
    expect(html).toContain(`/activities/${activity.id}`);
  });
  it('shows empty and error states without pretending there are activities to rate', () => {
    mocks.queryIndex = 0;
    expect(renderToStaticMarkup(<JoinedActivityReviews />)).toContain(
      'No concluded joined activities',
    );
    mocks.queryIndex = 0;
    mocks.reviews.error = 'Unable to load your activities';
    expect(renderToStaticMarkup(<JoinedActivityReviews />)).toContain(
      'Unable to load your activities',
    );
  });
});

it('omits the extra review refresh button when details provides combined refresh', () => {
  mocks.queryIndex = 0;
  const html = renderToStaticMarkup(<ActivityRatings activityId={activity.id} combinedRefresh />);
  expect(html).not.toContain('Refresh reviews');
  expect(html).toContain('Ratings and reviews');
});
