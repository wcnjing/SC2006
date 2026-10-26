import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityActions } from '../src/activities/ActivityActions';
import {
  saveActivity,
  joinActivity,
  leaveActivity,
  unsaveActivity,
  type Activity,
  type ActivityParticipation,
} from '@communitylink/shared';

const mocks = vi.hoisted(() => ({
  profile: { id: 'resident-one', role: 'resident', status: 'active' } as {
    id: string;
    role: string;
    status: string;
  } | null,
  session: { user: { id: 'resident-one' } } as { user: { id: string } } | null,
  updates: [] as unknown[],
  leavePrompt: false,
  query: {
    data: null as ActivityParticipation | null,
    loading: false,
    error: null as string | null,
    retry: vi.fn(),
  },
  buttons: new Map<string, { disabled?: boolean; onPress?: () => void }>(),
}));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: (initial?: unknown) => {
      const [value, setValue] = actual.useState(initial);
      return [
        initial === 'idle' && mocks.leavePrompt ? 'confirm' : value,
        (next: unknown) => {
          mocks.updates.push(next);
          if (next === 'confirm') mocks.leavePrompt = true;
          if (next === 'idle') mocks.leavePrompt = false;
          setValue(next);
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
  saveActivity: vi.fn().mockResolvedValue(undefined),
  joinActivity: vi.fn().mockResolvedValue(undefined),
  leaveActivity: vi.fn().mockResolvedValue(undefined),
  unsaveActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/activities/activityTheme', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/activities/activityTheme')>();
  return {
    ...actual,
    ActivityButton: (props: React.ComponentProps<typeof actual.ActivityButton>) => {
      mocks.buttons.set(props.title, {
        disabled: props.disabled,
        onPress: props.onPress as () => void,
      });
      return <actual.ActivityButton {...props} />;
    },
    ActivityIconButton: (props: React.ComponentProps<typeof actual.ActivityIconButton>) => {
      mocks.buttons.set(props.label, {
        disabled: props.disabled || props.busy,
        onPress: props.onPress,
      });
      return <actual.ActivityIconButton {...props} />;
    },
  };
});
const activity = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'scheduled',
  starts_at: '2099-01-01T00:00:00Z',
  capacity: 2,
} as Activity;
const initialState = { saved: false, joined: false, activity, joinedCount: 0 };
const stateFor = (status: string) => ({
  ...initialState,
  saved: status === 'saved',
  joined: status === 'joined',
});
const render = () => renderToStaticMarkup(<ActivityActions activity={activity} />);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.buttons.clear();
  mocks.updates.length = 0;
  mocks.leavePrompt = false;
  mocks.session = { user: { id: 'resident-one' } };
  mocks.profile = { id: 'resident-one', role: 'resident', status: 'active' };
  mocks.query.data = { ...initialState };
  mocks.query.loading = false;
  mocks.query.error = null;
});

describe('independent resident activity actions', () => {
  it('enables independent new saves and joins for eligible residents', () => {
    const html = render();
    expect(html).toContain('aria-label="Save Activity"');
    expect(html).toContain('Join Activity');
    expect(html).not.toContain('unavailable until');
    expect(mocks.buttons.get('Save Activity')?.disabled).toBe(false);
    expect(mocks.buttons.get('Join Activity')?.disabled).toBe(false);
  });

  it.each([
    ['saved', 'Unsave Activity', 'Save Activity'],
    ['joined', 'Leave Activity', 'Join Activity'],
  ])('shows the existing %s state with its removal action', (status, title) => {
    mocks.query.data = stateFor(status);
    const html = render();
    expect(html).toContain(status === 'saved' ? 'aria-label="Unsave Activity"' : 'Leave Activity');
    expect(mocks.buttons.get(title)?.disabled).toBe(false);
  });

  it.each(['cancelled', 'completed'] as const)(
    'keeps joining blocked for %s activities',
    (status) => {
      mocks.query.data = { ...initialState, activity: { ...activity, status } };
      const html = renderToStaticMarkup(<ActivityActions activity={{ ...activity, status }} />);
      expect(html).toContain(`This activity is ${status}`);
      expect(mocks.buttons.get('Join Activity')?.disabled).toBe(true);
    },
  );

  it.each(['organiser', 'admin', 'suspended', 'signed-out'])(
    'hides resident actions for %s',
    (kind) => {
      mocks.profile =
        kind === 'signed-out'
          ? null
          : {
              id: 'other',
              role: kind === 'suspended' ? 'resident' : kind,
              status: kind === 'suspended' ? kind : 'active',
            };
      mocks.session = mocks.profile ? { user: { id: mocks.profile.id } } : null;
      expect(render()).toContain('active resident account');
      expect(mocks.buttons.size).toBe(0);
    },
  );

  it('shows state loading without claiming not saved or not joined', () => {
    mocks.query.loading = true;
    const html = render();
    expect(html).toContain('Loading your activity state');
    expect(html).not.toContain('Saved: No');
    expect(mocks.buttons.get('Save Activity')?.disabled).toBe(true);
  });

  it('displays read errors and provides retry without allowing writes', () => {
    mocks.query.error = 'Unable to load state';
    expect(render()).toContain(mocks.query.error);
    expect(mocks.buttons.get('Join Activity')?.disabled).toBe(true);
    mocks.buttons.get('Retry activity state')?.onPress?.();
    expect(mocks.query.retry).toHaveBeenCalledOnce();
  });

  it('unsaves independently without registering and refreshes persisted state', async () => {
    mocks.query.data = stateFor('saved');
    render();
    await mocks.buttons.get('Unsave Activity')?.onPress?.();
    expect(unsaveActivity).toHaveBeenCalledWith({}, activity.id);
    expect(leaveActivity).not.toHaveBeenCalled();
    expect(mocks.query.retry).toHaveBeenCalledOnce();
  });

  it('prevents duplicate in-flight leave calls', async () => {
    mocks.query.data = stateFor('joined');
    render();
    mocks.buttons.get('Leave Activity')?.onPress?.();
    expect(leaveActivity).not.toHaveBeenCalled();
    render();
    const leave = mocks.buttons.get('Confirm Leave')?.onPress;
    leave?.();
    leave?.();
    await Promise.resolve();
    expect(leaveActivity).toHaveBeenCalledOnce();
    expect(unsaveActivity).not.toHaveBeenCalled();
    expect(mocks.query.retry).toHaveBeenCalledOnce();
  });
  it('refreshes after a failed removal so stale state can be corrected', async () => {
    mocks.query.data = stateFor('saved');
    vi.mocked(unsaveActivity).mockRejectedValueOnce(new Error('Permission denied'));
    render();
    await mocks.buttons.get('Unsave Activity')?.onPress?.();
    expect(mocks.query.retry).toHaveBeenCalledOnce();
    expect(leaveActivity).not.toHaveBeenCalled();
  });
});

it('shows saved and joined simultaneously, with both removal actions enabled', () => {
  mocks.query.data = { ...initialState, saved: true, joined: true };
  const html = render();
  expect(html).toContain('aria-label="Unsave Activity"');
  expect(html).toContain('Leave Activity');
  expect(mocks.buttons.get('Unsave Activity')?.disabled).toBe(false);
  expect(mocks.buttons.get('Leave Activity')?.disabled).toBe(false);
});

it.each([
  ['Save Activity', saveActivity, joinActivity],
  ['Join Activity', joinActivity, saveActivity],
])('%s calls only its own action and reloads persisted state', async (title, action, other) => {
  render();
  await mocks.buttons.get(title as string)?.onPress?.();
  expect(action).toHaveBeenCalledWith({}, activity.id);
  expect(other).not.toHaveBeenCalled();
  expect(mocks.query.retry).toHaveBeenCalledOnce();
});

it('blocks joining a full activity while still allowing saving', () => {
  mocks.query.data = { ...initialState, joinedCount: 2 };
  expect(render()).toContain('This activity is full.');
  expect(mocks.buttons.get('Join Activity')?.disabled).toBe(true);
  expect(mocks.buttons.get('Save Activity')?.disabled).toBe(false);
});

it('allows leaving a joined full/cancelled/past activity without unsaving', async () => {
  mocks.query.data = {
    ...initialState,
    saved: true,
    joined: true,
    joinedCount: 2,
    activity: { ...activity, status: 'cancelled', starts_at: '2020-01-01T00:00:00Z' },
  };
  render();
  expect(mocks.buttons.get('Leave Activity')?.disabled).toBe(false);
  mocks.buttons.get('Leave Activity')?.onPress?.();
  render();
  await mocks.buttons.get('Confirm Leave')?.onPress?.();
  expect(leaveActivity).toHaveBeenCalledOnce();
  expect(unsaveActivity).not.toHaveBeenCalled();
});

it('blocks past activities while preserving saving', () => {
  mocks.query.data = {
    ...initialState,
    activity: { ...activity, starts_at: '2020-01-01T00:00:00Z' },
  };
  expect(render()).toContain('already started');
  expect(mocks.buttons.get('Join Activity')?.disabled).toBe(true);
  expect(mocks.buttons.get('Save Activity')?.disabled).toBe(false);
});

it('prevents duplicate in-flight saves and joins', async () => {
  render();
  const save = mocks.buttons.get('Save Activity')?.onPress;
  const join = mocks.buttons.get('Join Activity')?.onPress;
  save?.();
  save?.();
  join?.();
  await Promise.resolve();
  expect(saveActivity).toHaveBeenCalledOnce();
  expect(joinActivity).not.toHaveBeenCalled();
});

describe('completion audit: registration and authorization edges', () => {
  it.each(['missing', 'mismatched'])(
    'hides actions with a %s session despite a resident profile',
    (kind) => {
      mocks.session = kind === 'missing' ? null : { user: { id: 'resident-two' } };
      expect(render()).toContain('active resident account');
      expect(mocks.buttons.size).toBe(0);
      expect(saveActivity).not.toHaveBeenCalled();
      expect(joinActivity).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['This activity is full.', 'full'],
    ['This activity is not open for registration.', 'cancelled or past'],
    ['An active resident account is required.', 'role changed'],
    ['You need to be logged in.', 'expired authentication'],
  ])(
    'shows the server rejection for %s without success after a stale eligible snapshot',
    async (message) => {
      // Snapshot still shows an available future activity. The server is authoritative.
      vi.mocked(joinActivity).mockRejectedValueOnce(new Error(message));
      render();
      expect(mocks.buttons.get('Join Activity')?.disabled).toBe(false);
      await mocks.buttons.get('Join Activity')?.onPress?.();
      expect(mocks.updates).toContain(message);
      expect(mocks.updates).not.toContain('Registration confirmed.');
      expect(mocks.query.retry).toHaveBeenCalledOnce();
      expect(saveActivity).not.toHaveBeenCalled();
      expect(leaveActivity).not.toHaveBeenCalled();
    },
  );

  it('shows a rejected save without reporting success', async () => {
    vi.mocked(saveActivity).mockRejectedValueOnce(
      new Error('An active resident account is required.'),
    );
    render();
    await mocks.buttons.get('Save Activity')?.onPress?.();
    expect(mocks.updates).toContain('An active resident account is required.');
    expect(mocks.updates).not.toContain('Activity saved.');
    expect(mocks.query.retry).toHaveBeenCalledOnce();
  });

  it.each(['cancelled', 'completed', 'past', 'full'])(
    'retains Leave for an already joined %s activity',
    (kind) => {
      mocks.query.data = {
        ...initialState,
        joined: true,
        joinedCount: kind === 'full' ? 2 : 1,
        activity: {
          ...activity,
          status: kind === 'cancelled' || kind === 'completed' ? kind : 'scheduled',
          starts_at: kind === 'past' ? '2020-01-01T00:00:00Z' : activity.starts_at,
        },
      };
      render();
      expect(mocks.buttons.get('Leave Activity')?.disabled).toBe(false);
    },
  );
});

it('uses the combined refresh callback and removes the old refresh action', () => {
  const refresh = vi.fn();
  const html = renderToStaticMarkup(
    <ActivityActions activity={activity} onRefresh={refresh}>
      <span>Activity name</span>
    </ActivityActions>,
  );
  expect(html).toContain('Activity name');
  expect(html).not.toContain('Refresh activity state');
  mocks.buttons.get('Refresh activity')?.onPress?.();
  expect(refresh).toHaveBeenCalledOnce();
  expect(mocks.query.retry).not.toHaveBeenCalled();
});
it('exposes the saved state accessibly without debug labels', () => {
  mocks.query.data = { ...initialState, saved: true };
  const html = render();
  expect(html).toContain('aria-pressed="true"');
  expect(html).not.toContain('Saved:');
  expect(html).not.toContain('Joined:');
});
it('disables refresh while persisted participation is loading', () => {
  mocks.query.loading = true;
  const html = render();
  expect(html).toContain('aria-busy="true"');
  expect(mocks.buttons.get('Refresh activity')?.disabled).toBe(true);
});

describe('Leave Activity confirmation', () => {
  it('requests confirmation without calling Leave, and cancelling keeps registration and bookmark', () => {
    mocks.query.data = { ...initialState, saved: true, joined: true };
    render();
    mocks.buttons.get('Leave Activity')?.onPress?.();
    const html = render();
    expect(html).toContain('Leave this activity?');
    expect(html).toContain('saved activity will remain unchanged');
    expect(leaveActivity).not.toHaveBeenCalled();
    mocks.buttons.get('Keep registration')?.onPress?.();
    expect(render()).not.toContain('Confirm Leave');
    expect(mocks.query.data.joined).toBe(true);
    expect(leaveActivity).not.toHaveBeenCalled();
    expect(unsaveActivity).not.toHaveBeenCalled();
    expect(mocks.query.retry).not.toHaveBeenCalled();
  });
  it('confirms Leave once while a request is pending, without unsaving or joining', async () => {
    mocks.query.data = { ...initialState, saved: true, joined: true };
    let finish!: () => void;
    vi.mocked(leaveActivity).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render();
    const open = mocks.buttons.get('Leave Activity')?.onPress;
    open?.();
    open?.();
    expect(leaveActivity).not.toHaveBeenCalled();
    render();
    const confirm = mocks.buttons.get('Confirm Leave')?.onPress;
    confirm?.();
    confirm?.();
    mocks.buttons.get('Leave Activity')?.onPress?.();
    expect(leaveActivity).toHaveBeenCalledOnce();
    expect(mocks.leavePrompt).toBe(false);
    expect(unsaveActivity).not.toHaveBeenCalled();
    expect(joinActivity).not.toHaveBeenCalled();
    finish();
    await Promise.resolve();
    expect(mocks.updates).toContain('Registration cancelled.');
    expect(mocks.query.retry).toHaveBeenCalledOnce();
  });
  it('preserves Leave server errors and refreshes authoritative state', async () => {
    mocks.query.data = stateFor('joined');
    vi.mocked(leaveActivity).mockRejectedValueOnce(
      new Error('An active resident account is required.'),
    );
    render();
    mocks.buttons.get('Leave Activity')?.onPress?.();
    render();
    await mocks.buttons.get('Confirm Leave')?.onPress?.();
    expect(mocks.updates).toContain('An active resident account is required.');
    expect(mocks.updates).not.toContain('Registration cancelled.');
    expect(mocks.query.retry).toHaveBeenCalledOnce();
    expect(unsaveActivity).not.toHaveBeenCalled();
  });
});
