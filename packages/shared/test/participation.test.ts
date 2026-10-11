import { describe, expect, it, vi } from 'vitest';
import {
  activityJoinUnavailableReason,
  getMyActivityParticipation,
  saveActivity,
  unsaveActivity,
  joinActivity,
  leaveActivity,
} from '../src/api/participation';
import type { CommunityLinkClient } from '../src/api/client';

const activityId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const activity = {
  id: activityId,
  status: 'scheduled' as const,
  starts_at: '2099-01-01T00:00:00Z',
  capacity: 2,
};
function setup(
  options: {
    user?: string | null;
    role?: string;
    status?: string;
    saved?: boolean;
    participant?: string;
    count?: number | null;
    error?: { code: string; message: string };
    rpcError?: { code: string; message: string };
    activityMissing?: boolean;
    removed?: unknown[];
  } = {},
) {
  const profile = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id: userId, role: options.role ?? 'resident', status: options.status ?? 'active' },
      error: null,
    }),
  };
  const bookmark = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: options.saved ? { activity_id: activityId } : null, error: null }),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data: options.removed ?? [{ activity_id: activityId }],
        error: options.error ?? null,
      }).then(resolve),
  };
  const countQuery = {
    eq: vi.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        count: options.count === undefined ? 1 : options.count,
        error: options.error ?? null,
      }).then(resolve),
  };
  const participant = {
    select: vi.fn((_columns, config) => (config?.count ? countQuery : participant)),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: options.participant ? { status: options.participant } : null,
      error: null,
    }),
  };
  const activities = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: options.activityMissing ? null : activity, error: null }),
  };
  const from = vi.fn(
    (table) =>
      ({
        profiles: profile,
        activity_bookmarks: bookmark,
        activity_participants: participant,
        activities,
      })[table as 'profiles'],
  );
  const rpc = vi.fn((_name, args) =>
    Promise.resolve({ data: args.should_join, error: options.rpcError ?? null }),
  );
  const client = {
    from,
    rpc,
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: options.user === null ? null : { user: { id: userId } } },
      }),
    },
  } as unknown as CommunityLinkClient;
  return { client, from, rpc, bookmark, participant, countQuery };
}

describe('independent bookmarks and registrations', () => {
  it.each([
    [false, undefined],
    [true, undefined],
    [false, 'joined'],
    [true, 'joined'],
  ] as const)(
    'loads independent saved=%s and participant=%s states',
    async (saved, participant) => {
      const state = setup({ saved, participant });
      expect(await getMyActivityParticipation(state.client, activityId)).toEqual({
        saved,
        joined: participant === 'joined',
        activity,
        joinedCount: 1,
      });
      expect(state.bookmark.eq.mock.calls).toEqual([
        ['activity_id', activityId],
        ['user_id', userId],
      ]);
      expect(state.participant.eq.mock.calls).toEqual([
        ['activity_id', activityId],
        ['user_id', userId],
      ]);
      expect(state.countQuery.eq.mock.calls).toEqual([
        ['activity_id', activityId],
        ['status', 'joined'],
      ]);
      expect(state.participant.select).toHaveBeenCalledWith('activity_id', {
        count: 'exact',
        head: true,
      });
    },
  );

  it('does not mistake legacy saved or skipped statuses for a bookmark or registration', async () => {
    expect(
      await getMyActivityParticipation(setup({ participant: 'saved' }).client, activityId),
    ).toMatchObject({ saved: false, joined: false });
    expect(
      await getMyActivityParticipation(setup({ participant: 'skipped' }).client, activityId),
    ).toMatchObject({ saved: false, joined: false });
  });

  it('inserts only an own-user bookmark without touching registration', async () => {
    const { client, from, bookmark, rpc } = setup();
    await saveActivity(client, activityId);
    expect(bookmark.insert).toHaveBeenCalledWith({ activity_id: activityId, user_id: userId });
    expect(from.mock.calls.map(([table]) => table)).toEqual(['profiles', 'activity_bookmarks']);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('unsaves only an own-user bookmark, independently of joined state', async () => {
    const { client, from, bookmark, rpc } = setup({ participant: 'joined', saved: true });
    await unsaveActivity(client, activityId);
    expect(bookmark.delete).toHaveBeenCalledOnce();
    expect(bookmark.eq.mock.calls).toEqual([
      ['activity_id', activityId],
      ['user_id', userId],
    ]);
    expect(from.mock.calls.map(([table]) => table)).toEqual(['profiles', 'activity_bookmarks']);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    [joinActivity, true],
    [leaveActivity, false],
  ] as const)(
    'uses the auth-scoped registration RPC for should_join=%s',
    async (action, shouldJoin) => {
      const { client, rpc, from } = setup({ saved: true });
      await action(client, activityId);
      expect(rpc).toHaveBeenCalledWith('set_activity_registration', {
        target_activity: activityId,
        should_join: shouldJoin,
      });
      expect(from.mock.calls.map(([table]) => table)).toEqual(['profiles']);
    },
  );

  it('accepts an already absent bookmark but rejects a silently filtered deletion', async () => {
    await expect(
      unsaveActivity(setup({ removed: [] }).client, activityId),
    ).resolves.toBeUndefined();
    await expect(
      unsaveActivity(setup({ removed: [], saved: true }).client, activityId),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('reloads both states without caching when reopened', async () => {
    const state = setup({ saved: true, participant: 'joined' });
    expect(await getMyActivityParticipation(state.client, activityId)).toMatchObject({
      saved: true,
      joined: true,
    });
    state.bookmark.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await getMyActivityParticipation(state.client, activityId)).toMatchObject({
      saved: false,
      joined: true,
    });
    state.participant.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await getMyActivityParticipation(state.client, activityId)).toMatchObject({
      saved: true,
      joined: false,
    });
  });

  it('confirms an existing bookmark after a duplicate save', async () => {
    const { client, bookmark } = setup({
      saved: true,
      error: { code: '23505', message: 'duplicate key' },
    });
    await expect(saveActivity(client, activityId)).resolves.toBeUndefined();
    expect(bookmark.maybeSingle).toHaveBeenCalledOnce();
  });

  it('does not swallow a unique conflict if no own bookmark exists', async () => {
    await expect(
      saveActivity(
        setup({ error: { code: '23505', message: 'duplicate key' } }).client,
        activityId,
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it.each([getMyActivityParticipation, saveActivity, unsaveActivity, joinActivity, leaveActivity])(
    'validates activity IDs and authentication before querying',
    async (action) => {
      const invalid = setup();
      await expect(action(invalid.client, 'bad-id')).rejects.toMatchObject({ code: 'validation' });
      expect(invalid.from).not.toHaveBeenCalled();
      const unauthenticated = setup({ user: null });
      await expect(action(unauthenticated.client, activityId)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
      expect(unauthenticated.from).not.toHaveBeenCalled();
    },
  );

  describe.each(['organiser', 'admin', 'suspended'])('denies %s resident-only APIs', (kind) => {
    it.each([
      saveActivity,
      joinActivity,
      unsaveActivity,
      leaveActivity,
      getMyActivityParticipation,
    ])('rejects before any bookmark/registration request', async (action) => {
      const { client, rpc, bookmark, from } = setup({
        role: kind === 'suspended' ? 'resident' : kind,
        status: kind === 'suspended' ? kind : 'active',
      });
      await expect(action(client, activityId)).rejects.toMatchObject({ code: 'forbidden' });
      expect(rpc).not.toHaveBeenCalled();
      expect(bookmark.insert).not.toHaveBeenCalled();
      expect(bookmark.delete).not.toHaveBeenCalled();
      expect(from.mock.calls.map(([table]) => table)).toEqual(['profiles']);
    });
  });

  it.each([
    'This activity is full.',
    'This activity is not open for registration.',
    'You need to be logged in.',
  ])('preserves RPC errors: %s', async (message) => {
    await expect(
      joinActivity(setup({ rpcError: { code: 'P0001', message } }).client, activityId),
    ).rejects.toMatchObject({ message });
  });

  it('preserves bookmark permission errors', async () => {
    await expect(
      unsaveActivity(
        setup({ error: { code: '42501', message: 'row-level security denied' } }).client,
        activityId,
      ),
    ).rejects.toMatchObject({ code: '42501', message: 'You do not have permission to do that.' });
  });

  it('does not claim success if the RPC result is unexpected', async () => {
    const { client, rpc } = setup();
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(joinActivity(client, activityId)).rejects.toThrow(
      'Unable to confirm registration',
    );
  });

  it('fails explicitly for missing activities or unavailable registration counts', async () => {
    await expect(
      getMyActivityParticipation(setup({ activityMissing: true }).client, activityId),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      getMyActivityParticipation(setup({ count: null }).client, activityId),
    ).rejects.toThrow('Unable to load registration count');
  });
});

describe('join eligibility guidance', () => {
  const now = Date.parse('2098-01-01T00:00:00Z');
  it('allows upcoming scheduled activities with capacity or unlimited capacity', () => {
    expect(activityJoinUnavailableReason(activity, 1, now)).toBeNull();
    expect(activityJoinUnavailableReason({ ...activity, capacity: null }, 10000, now)).toBeNull();
  });
  it('blocks full activities', () => {
    expect(activityJoinUnavailableReason(activity, 2, now)).toBe('This activity is full.');
  });
  it.each(['cancelled', 'completed'] as const)('blocks %s activities', (status) => {
    expect(activityJoinUnavailableReason({ ...activity, status }, 0, now)).toContain(status);
  });
  it('blocks past activities and activities starting now', () => {
    expect(activityJoinUnavailableReason(activity, 0, Date.parse(activity.starts_at))).toContain(
      'already started',
    );
    expect(
      activityJoinUnavailableReason(activity, 0, Date.parse('2100-01-01T00:00:00Z')),
    ).toContain('already started');
  });
});

describe('completion audit: server rejection handling', () => {
  it.each([
    ['P0001', 'This activity is full.'],
    ['P0001', 'This activity is not open for registration.'],
    ['42501', 'An active resident account is required.'],
    ['42501', 'You need to be logged in.'],
    ['40001', 'could not serialize access due to concurrent update'],
  ])('propagates %s (%s), with no fallback participant insert', async (code, message) => {
    const state = setup({ rpcError: { code, message } });
    await expect(joinActivity(state.client, activityId)).rejects.toMatchObject({ code, message });
    expect(state.rpc).toHaveBeenCalledOnce();
    expect(state.from.mock.calls.map(([table]) => table)).toEqual(['profiles']);
    expect(state.bookmark.insert).not.toHaveBeenCalled();
  });

  it('propagates save RLS rejection even after the local profile check passed', async () => {
    const state = setup({ error: { code: '42501', message: 'row-level security denied' } });
    await expect(saveActivity(state.client, activityId)).rejects.toMatchObject({ code: '42501' });
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('does not treat one remaining seat as full, but blocks exact or exceeded capacity', () => {
    const now = Date.parse('2098-01-01T00:00:00Z');
    expect(activityJoinUnavailableReason(activity, 1, now)).toBeNull();
    expect(activityJoinUnavailableReason(activity, 2, now)).toBe('This activity is full.');
    expect(activityJoinUnavailableReason(activity, 3, now)).toBe('This activity is full.');
  });
});
