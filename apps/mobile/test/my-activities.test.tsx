import { renderToStaticMarkup } from 'react-dom/server';
import * as React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { listMyActivityCollections, type MyActivityCollections } from '@communitylink/shared';
import MyActivities from '../src/app/activities/mine';

const mocks = vi.hoisted(() => ({
  auth: {
    profile: { id: 'resident', role: 'resident', status: 'active' } as {
      id: string;
      role: string;
      status: string;
    } | null,
    session: { user: { id: 'resident' } } as { user: { id: string } } | null,
    loading: false,
  },
  query: {
    data: null as MyActivityCollections | null,
    loading: false,
    error: null as string | null,
    retry: vi.fn(),
  },
  load: null as (() => Promise<unknown>) | null,
  buttons: new Map<string, { onPress: () => void; disabled?: boolean }>(),
}));
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>();
  return { ...actual, useState: vi.fn(actual.useState) };
});
vi.mock('../src/auth/AuthProvider', () => ({ useAuth: () => mocks.auth }));
vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/activities/useActivityQuery', () => ({
  useActivityQuery: (load: () => Promise<unknown>) => {
    mocks.load = load;
    return mocks.query;
  },
}));
vi.mock('@communitylink/shared', async (original) => ({
  ...(await original<typeof import('@communitylink/shared')>()),
  listMyActivityCollections: vi.fn().mockResolvedValue({ saved: [], joined: [], history: [] }),
}));
vi.mock('expo-router', () => ({
  Link: ({
    href,
    children,
  }: {
    href: string | { params: { id: string } };
    children: React.ReactNode;
  }) => <a href={typeof href === 'string' ? href : `/activities/${href.params.id}`}>{children}</a>,
}));
vi.mock('../src/activities/activityTheme', async (original) => {
  const actual = await original<typeof import('../src/activities/activityTheme')>();
  return {
    ...actual,
    ActivityButton: (props: React.ComponentProps<typeof actual.ActivityButton>) => {
      mocks.buttons.set(props.title, {
        onPress: props.onPress as () => void,
        disabled: props.disabled,
      });
      return <actual.ActivityButton {...props} />;
    },
  };
});
beforeEach(() => {
  mocks.auth = {
    profile: { id: 'resident', role: 'resident', status: 'active' },
    session: { user: { id: 'resident' } },
    loading: false,
  };
  mocks.query = {
    data: { saved: [], joined: [], history: [] },
    loading: false,
    error: null,
    retry: vi.fn(),
  };
  mocks.load = null;
  mocks.buttons.clear();
});
afterEach(() => vi.restoreAllMocks());
const render = () => renderToStaticMarkup(<MyActivities />);

describe('temporary resident My Activities page', () => {
  it('uses the real shared collections API and Supabase client', async () => {
    render();
    await mocks.load!();
    expect(listMyActivityCollections).toHaveBeenCalledWith({});
  });
  it.each(['saved', 'joined', 'history'] as const)(
    'displays %s cards, statuses and detail links',
    (tab) => {
      const card = {
        activity: {
          id: tab,
          title: `${tab} activity`,
          starts_at: '2026-10-11T00:00:00Z',
          location_name: 'Park',
          status: 'scheduled',
        },
        saved: true,
        joined: true,
      } as MyActivityCollections['saved'][number];
      mocks.query.data![tab] = [card];
      vi.mocked(React.useState).mockReturnValueOnce([tab, vi.fn()]);
      const html = render();
      expect(html).toContain(`${tab} activity`);
      expect(html).toContain(`/activities/${tab}`);
      expect(html).toContain('Park');
      expect(html).toContain('Starts:');
      expect(html).toContain('Singapore');
      expect(html).toContain('Saved: Yes');
      expect(html).toContain('Joined: Yes');
    },
  );
  it.each(['saved', 'joined', 'history'] as const)('shows a distinct empty state for %s', (tab) => {
    vi.mocked(React.useState).mockReturnValueOnce([tab, vi.fn()]);
    expect(render()).toContain(
      {
        saved: 'no saved activities',
        joined: 'no upcoming joined activities',
        history: 'no retained past registrations',
      }[tab],
    );
  });
  it('switches tabs and refreshes without writing records', () => {
    const setTab = vi.fn();
    vi.mocked(React.useState).mockReturnValueOnce(['saved', setTab]);
    render();
    mocks.buttons.get('Joined')!.onPress();
    expect(setTab).toHaveBeenCalledWith('joined');
    mocks.buttons.get('Refresh my activities')!.onPress();
    expect(mocks.query.retry).toHaveBeenCalledOnce();
  });
  it('shows loading instead of an empty state', () => {
    mocks.query.loading = true;
    const html = render();
    expect(html).toContain('Loading my activities');
    expect(html).not.toContain('no saved activities');
  });
  it('shows errors with retry instead of empty success', () => {
    mocks.query.error = 'Unable to load collections';
    expect(render()).toContain(mocks.query.error);
    mocks.buttons.get('Retry my activities')!.onPress();
    expect(mocks.query.retry).toHaveBeenCalledOnce();
  });
  it.each(['organiser', 'admin', 'suspended', 'signed-out', 'mismatched'])(
    'guards %s without loading collections',
    (kind) => {
      if (kind === 'signed-out') mocks.auth.session = null;
      else if (kind === 'mismatched') mocks.auth.session!.user.id = 'another';
      else if (kind === 'suspended') mocks.auth.profile!.status = 'suspended';
      else mocks.auth.profile!.role = kind;
      expect(render()).toContain('active resident account');
      expect(mocks.load).toBeNull();
    },
  );
  it('waits for authentication restoration before requesting data', () => {
    mocks.auth.loading = true;
    expect(render()).toContain('Loading your account');
    expect(mocks.load).toBeNull();
  });
});
