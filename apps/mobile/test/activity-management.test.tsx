import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createActivity,
  updateActivity,
  cancelActivity,
  type Activity,
} from '@communitylink/shared';
import { ActivityEditor } from '../src/activities/ActivityEditor';
import { OrganiserActivityLinks } from '../src/activities/OrganiserActivityLinks';
import CreateActivity from '../src/app/activities/create';
import ManageActivity from '../src/app/activities/[id]/manage';
import {
  activityFormInput,
  initialActivityForm,
  singaporeDateTime,
} from '../src/activities/activityForm';

const mocks = vi.hoisted(() => ({
  profile: { id: 'owner', role: 'organiser', status: 'active' } as {
    id: string;
    role: string;
    status: string;
  } | null,
  session: { user: { id: 'owner' } } as { user: { id: string } } | null,
  states: [] as unknown[],
  updates: [] as { index: number; value: unknown }[],
  stateIndex: 0,
  buttons: new Map<string, { disabled?: boolean; onPress: () => void }>(),
  query: {
    data: null as Activity | null,
    loading: false,
    error: null as string | null,
    retry: vi.fn(),
  },
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
vi.mock('../src/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: mocks.profile, session: mocks.session }),
}));
vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/activities/useActivityQuery', () => ({ useActivityQuery: () => mocks.query }));
vi.mock('@communitylink/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@communitylink/shared')>()),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
  cancelActivity: vi.fn(),
}));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'activity-one' }),
  Link: ({ children }: { children: string }) => <a>{children}</a>,
}));
vi.mock('react-native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-native')>()),
  Button: (props: { title: string; disabled?: boolean; onPress: () => void }) => {
    mocks.buttons.set(props.title, props);
    return <button disabled={props.disabled}>{props.title}</button>;
  },
}));
const activity = {
  id: 'activity-one',
  organiser_id: 'owner',
  source: 'organiser',
  status: 'scheduled',
  updated_at: 'version-one',
  title: 'Community walk',
  description: 'Meet neighbours',
  category: 'Fitness',
  location_name: 'Park',
  address: '10 Road',
  starts_at: '2027-01-01T00:00:00Z',
  ends_at: '2027-01-01T01:00:00Z',
  capacity: 5,
  cost_cents: 1250,
  lat: 1.3,
  lng: 103.8,
  tags: ['walking'],
  accessibility_features: ['wheelchair-access'],
  is_outdoor: true,
} as Activity;
function renderEditor(states: unknown[] = [], row?: Activity) {
  mocks.states = states;
  mocks.stateIndex = 0;
  return renderToStaticMarkup(<ActivityEditor activity={row} />);
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
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-10T00:00:00Z'));
  mocks.profile = { id: 'owner', role: 'organiser', status: 'active' };
  mocks.session = { user: { id: 'owner' } };
  mocks.states = [];
  mocks.stateIndex = 0;
  mocks.updates = [];
  mocks.buttons.clear();
  mocks.query.data = activity;
  mocks.query.error = null;
  mocks.query.loading = false;
  vi.mocked(createActivity).mockReset().mockResolvedValue(activity);
  vi.mocked(updateActivity).mockReset().mockResolvedValue(activity);
  vi.mocked(cancelActivity)
    .mockReset()
    .mockResolvedValue({ ...activity, status: 'cancelled' });
});
afterEach(() => vi.restoreAllMocks());

describe('organiser forms on Expo Web', () => {
  it('renders required details and fields needed by the existing filters', () => {
    const html = renderEditor();
    for (const text of [
      'Activity name',
      'Description',
      'Category / type',
      'Location / venue',
      'Start date/time',
      'End date/time',
      'Capacity',
      'Accessibility features',
      'Latitude',
      'Longitude',
      'Indoor',
      'Outdoor',
      'Review activity',
    ])
      expect(html).toContain(text);
    expect(html).not.toContain('Confirm create');
    expect(html).not.toContain('Cancel activity');
  });
  it('validates before reviewing or writing', () => {
    renderEditor();
    press('Review activity');
    expect(
      mocks.updates.some(
        (update) => update.index === 5 && typeof update.value === 'string' && update.value.length,
      ),
    ).toBe(true);
    expect(createActivity).not.toHaveBeenCalled();
  });
  it('requires confirmation and blocks duplicate create clicks', async () => {
    let resolve!: (row: Activity) => void;
    vi.mocked(createActivity).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const values = initialActivityForm(activity);
    const input = activityFormInput(values);
    const html = renderEditor([values, input]);
    expect(html).toContain('Confirm creation');
    press('Confirm create');
    press('Confirm create');
    expect(createActivity).toHaveBeenCalledTimes(1);
    resolve(activity);
    await flush();
    expect(
      mocks.updates.some(
        (update) =>
          update.value === 'Activity created. It is now available in Upcoming activities.',
      ),
    ).toBe(true);
  });
  it('updates the owned activity with the original version', async () => {
    const values = initialActivityForm(activity);
    const input = activityFormInput(values);
    renderEditor([values, input], activity);
    press('Confirm update');
    await flush();
    expect(updateActivity).toHaveBeenCalledWith({}, activity.id, input, activity.updated_at);
    expect(createActivity).not.toHaveBeenCalled();
  });
  it('requires a reason and explicit confirmation for cancellation', async () => {
    renderEditor([], activity);
    press('Review cancellation');
    expect(mocks.updates).toContainEqual({ index: 5, value: 'A cancellation reason is required.' });
    expect(cancelActivity).not.toHaveBeenCalled();
    renderEditor([initialActivityForm(activity), null, 'Venue closed', true], activity);
    press('Confirm cancellation');
    await flush();
    expect(cancelActivity).toHaveBeenCalledWith(
      {},
      activity.id,
      'Venue closed',
      activity.updated_at,
    );
    expect(updateActivity).not.toHaveBeenCalled();
  });
  it('shows server errors and lets the organiser review again', async () => {
    vi.mocked(updateActivity).mockRejectedValueOnce(
      new Error('Capacity is below existing registrations.'),
    );
    const values = initialActivityForm(activity);
    renderEditor([values, activityFormInput(values)], activity);
    press('Confirm update');
    await flush();
    expect(mocks.updates).toContainEqual({
      index: 5,
      value: 'Capacity is below existing registrations.',
    });
    expect(mocks.updates).toContainEqual({ index: 1, value: null });
  });
  it.each(['2026-01-01T00:00:00Z', '2026-10-10T00:00:00Z'])(
    'hides cancellation at or after start %s and explains why',
    (starts_at) => {
      const html = renderEditor([], { ...activity, starts_at });
      expect(html).not.toContain('Review activity');
      expect(html).not.toContain('Review cancellation');
      expect(html).toContain('already started and cannot be cancelled');
    },
  );
  it.each(['Review cancellation', 'Confirm cancellation'])(
    'rechecks the clock when %s is clicked after the page was opened',
    async (button) => {
      renderEditor(
        [initialActivityForm(activity), null, 'Venue closed', button === 'Confirm cancellation'],
        activity,
      );
      vi.mocked(Date.now).mockReturnValue(Date.parse(activity.starts_at));
      press(button);
      await flush();
      expect(cancelActivity).not.toHaveBeenCalled();
      expect(mocks.updates).toContainEqual({
        index: 5,
        value: 'This activity has already started and cannot be cancelled.',
      });
      expect(mocks.updates).not.toContainEqual({ index: 3, value: true });
    },
  );
  it('offers no edit or cancellation for completed/cancelled activities', () => {
    for (const status of ['completed', 'cancelled'] as const) {
      const html = renderEditor([], { ...activity, status });
      expect(html).not.toContain('Review activity');
      expect(html).not.toContain('Review cancellation');
    }
  });
  it.each(['resident', 'admin', 'suspended', 'unauthenticated', 'mismatched-session'])(
    'guards create/manage routes for %s users',
    (role) => {
      if (role === 'suspended') mocks.profile!.status = 'suspended';
      else if (role === 'unauthenticated') mocks.session = null;
      else if (role === 'mismatched-session') mocks.session!.user.id = 'other';
      else mocks.profile!.role = role;
      for (const Screen of [CreateActivity, ManageActivity]) {
        expect(renderToStaticMarkup(<Screen />)).toContain('active organiser');
      }
      expect(renderToStaticMarkup(<OrganiserActivityLinks />)).toBe('');
    },
  );
  it('rejects management of another organiser activity even by direct URL', () => {
    mocks.query.data = { ...activity, organiser_id: 'other' };
    expect(renderToStaticMarkup(<ManageActivity />)).toContain('only manage your own');
    expect(renderToStaticMarkup(<OrganiserActivityLinks activity={mocks.query.data} />)).toBe('');
  });
  it('shows success links and reports loading/errors for the management route', () => {
    const html = renderEditor([
      initialActivityForm(activity),
      null,
      '',
      false,
      false,
      '',
      activity,
      'Activity updated.',
    ]);
    expect(html).toContain('Activity updated.');
    expect(html).toContain('View activity details');
    mocks.query.loading = true;
    expect(renderToStaticMarkup(<ManageActivity />)).toContain('Loading activity editor');
    mocks.query.loading = false;
    mocks.query.error = 'Network error';
    expect(renderToStaticMarkup(<ManageActivity />)).toContain('Retry activity editor');
  });
});
describe('Singapore organiser date/time and numeric parsing', () => {
  it('round-trips schema fields with fixed Singapore time and SGD cents', () => {
    expect(singaporeDateTime(activity.starts_at)).toBe('2027-01-01 08:00');
    const input = activityFormInput(initialActivityForm(activity));
    expect(input.starts_at).toBe('2027-01-01T00:00:00.000Z');
    expect(input.cost_cents).toBe(1250);
    expect(input.accessibility_features).toEqual(activity.accessibility_features);
  });
  it.each(['2027-02-30 08:00', '2027-01-01 25:00', '01/01/2027 08:00'])(
    'rejects invalid calendar/time %s',
    (starts_at) => {
      expect(() => activityFormInput({ ...initialActivityForm(activity), starts_at })).toThrow();
    },
  );
  it.each(['-1', '1.001', 'abc', ''])('rejects malformed SGD cost %s', (cost) => {
    expect(() => activityFormInput({ ...initialActivityForm(activity), cost })).toThrow('SGD');
  });
});
