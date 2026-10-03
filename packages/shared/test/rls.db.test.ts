// Integration tests for auth, RBAC and RLS against a LOCAL Supabase stack.
//   supabase start && npm run test:db
// Refuses to run against anything but localhost, because it creates users.
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../src/database.types';
import {
  completeOnboarding,
  getMyProfile,
  listAuditLog,
  setUserRole,
  setUserStatus,
  signIn,
  signUp,
  updateMyProfile,
  type CommunityLinkClient,
} from '../src';

// Connection details come from the running local stack (`supabase status`),
// so no keys live in the repo. Override with env vars if needed.
function localStackEnv(): Record<string, string> {
  try {
    const out = execSync('supabase status -o env', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return Object.fromEntries(
      out
        .split('\n')
        .map((line) => line.match(/^(\w+)="?(.*?)"?$/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => [m[1]!, m[2]!]),
    );
  } catch {
    throw new Error('Local Supabase is not running. Start it with `supabase start`.');
  }
}

const local = localStackEnv();
const URL = process.env.SUPABASE_URL ?? local.API_URL ?? '';
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? local.PUBLISHABLE_KEY ?? '';
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? local.SECRET_KEY ?? '';

if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL)) {
  throw new Error(`test:db only runs against a local Supabase stack, got ${URL}`);
}

const PASSWORD = 'testpass123';
const runId = Date.now();
const service = createClient<Database>(URL, SECRET_KEY, { auth: { persistSession: false } });

function newClient(): CommunityLinkClient {
  return createClient<Database>(URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
}

async function userWithRole(name: string, role: 'resident' | 'organiser' | 'admin') {
  const email = `${name}-${runId}@test.local`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error) throw error;
  if (role !== 'resident') {
    const { error: roleError } = await service
      .from('profiles')
      .update({ role })
      .eq('id', data.user.id);
    if (roleError) throw roleError;
  }
  const client = newClient();
  await signIn(client, { email, password: PASSWORD });
  return { id: data.user.id, client };
}

const hourAgo = () => new Date(Date.now() - 3_600_000).toISOString();
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

let resident: Awaited<ReturnType<typeof userWithRole>>;
let other: Awaited<ReturnType<typeof userWithRole>>;
let organiser: Awaited<ReturnType<typeof userWithRole>>;
let admin: Awaited<ReturnType<typeof userWithRole>>;

beforeAll(async () => {
  [resident, other, organiser, admin] = await Promise.all([
    userWithRole('resident', 'resident'),
    userWithRole('other', 'resident'),
    userWithRole('organiser', 'organiser'),
    userWithRole('admin', 'admin'),
  ]);
});

describe('sign-up and profiles', () => {
  it('creates a resident profile with the chosen display name', async () => {
    const client = newClient();
    await signUp(client, {
      email: `signup-${runId}@test.local`,
      password: PASSWORD,
      displayName: 'Auntie Mei',
    });
    const profile = await getMyProfile(client);
    expect(profile.display_name).toBe('Auntie Mei');
    expect(profile.role).toBe('resident');
    expect(profile.onboarded).toBe(false);
  });

  it('rejects weak passwords before calling the server', async () => {
    await expect(
      signUp(newClient(), { email: 'x@test.local', password: 'short', displayName: 'X' }),
    ).rejects.toThrow(/at least 8/);
  });

  it('lets users complete onboarding', async () => {
    const profile = await completeOnboarding(resident.client, {
      neighbourhoodId: 1,
      interests: ['gardening'],
      accessibilityNeeds: ['elderly-friendly'],
      preferredLanguage: 'en',
    });
    expect(profile.onboarded).toBe(true);
    expect(profile.interests).toEqual(['gardening']);
  });

  it('blocks users from changing their own role or status', async () => {
    const roleAttempt = await resident.client
      .from('profiles')
      .update({ role: 'admin' } as never)
      .eq('id', resident.id);
    expect(roleAttempt.error?.code).toBe('42501');

    const statusAttempt = await resident.client
      .from('profiles')
      .update({ status: 'active' } as never)
      .eq('id', resident.id);
    expect(statusAttempt.error?.code).toBe('42501');
  });

  it("does not let users edit someone else's profile", async () => {
    const { data } = await resident.client
      .from('profiles')
      .update({ display_name: 'hacked' })
      .eq('id', other.id)
      .select();
    expect(data).toEqual([]);
  });

  it('hides profiles from signed-out visitors but shows neighbourhoods', async () => {
    const anon = newClient();
    const profiles = await anon.from('profiles').select('id');
    expect(profiles.error?.code).toBe('42501');
    const hoods = await anon.from('neighbourhoods').select('id');
    expect(hoods.data?.length).toBeGreaterThan(0);
  });
});

describe('role-based access', () => {
  const activity = (organiserId: string) => ({
    organiser_id: organiserId,
    title: 'Morning tai chi',
    category: 'fitness',
    location_name: 'Bishan Park',
    starts_at: inHours(24),
    ends_at: inHours(25),
  });

  it('stops residents from creating activities', async () => {
    const { error } = await resident.client.from('activities').insert(activity(resident.id));
    expect(error?.code).toBe('42501');
  });

  it('lets organisers create activities', async () => {
    const { error } = await organiser.client.from('activities').insert(activity(organiser.id));
    expect(error).toBeNull();
  });

  it('only admins can change roles, and it is audited', async () => {
    await expect(setUserRole(resident.client, other.id, 'admin')).rejects.toThrow(/Only admins/);

    await setUserRole(admin.client, other.id, 'organiser');
    const log = await listAuditLog(admin.client, { limit: 5 });
    expect(log.some((e) => e.action === 'set_role' && e.target_id === other.id)).toBe(true);

    expect(await listAuditLog(resident.client)).toEqual([]);
    await setUserRole(admin.client, other.id, 'resident');
  });

  it('suspended users cannot post', async () => {
    await setUserStatus(admin.client, other.id, 'suspended', 'spam');
    const { error } = await other.client.from('posts').insert({ author_id: other.id, body: 'hi' });
    expect(error?.code).toBe('42501');
    await setUserStatus(admin.client, other.id, 'active');
  });
});

describe('social rules', () => {
  it('hides posts between blocked users', async () => {
    const { data: post } = await other.client
      .from('posts')
      .insert({ author_id: other.id, body: `visible ${runId}` })
      .select()
      .single();
    expect(post).not.toBeNull();

    const before = await resident.client.from('posts').select('id').eq('id', post!.id);
    expect(before.data).toHaveLength(1);

    await resident.client.from('blocks').insert({ blocker_id: resident.id, blocked_id: other.id });
    const after = await resident.client.from('posts').select('id').eq('id', post!.id);
    expect(after.data).toHaveLength(0);

    await resident.client.from('blocks').delete().eq('blocked_id', other.id);
  });

  it('only allows DMs between accepted connections', async () => {
    const dm = { sender_id: resident.id, recipient_id: organiser.id, body: 'hello' };
    const blocked = await resident.client.from('messages').insert(dm);
    expect(blocked.error?.code).toBe('42501');

    await resident.client
      .from('connections')
      .insert({ requester_id: resident.id, addressee_id: organiser.id });
    await organiser.client
      .from('connections')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('requester_id', resident.id);

    const allowed = await resident.client.from('messages').insert(dm);
    expect(allowed.error).toBeNull();
  });

  it('only lets participants rate activities that have ended', async () => {
    const { data: past } = await service
      .from('activities')
      .insert({
        organiser_id: organiser.id,
        title: 'Past cooking class',
        category: 'cooking',
        location_name: 'CC',
        starts_at: new Date(Date.now() - 7_200_000).toISOString(),
        ends_at: hourAgo(),
      })
      .select()
      .single();

    const rating = { activity_id: past!.id, user_id: resident.id, rating: 5 };
    const notJoined = await resident.client.from('activity_ratings').insert(rating);
    expect(notJoined.error?.code).toBe('42501');

    await resident.client
      .from('activity_participants')
      .insert({ activity_id: past!.id, user_id: resident.id, status: 'joined' });
    const joined = await resident.client.from('activity_ratings').insert(rating);
    expect(joined.error).toBeNull();
  });

  it('keeps edits to own profile working', async () => {
    const updated = await updateMyProfile(resident.client, { display_name: '  Uncle Tan ' });
    expect(updated.display_name).toBe('Uncle Tan');
  });
});
