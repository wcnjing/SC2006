// Integration tests for auth, RBAC and RLS against a LOCAL Supabase stack.
//   supabase start && npm run test:db
// Refuses to run against anything but localhost, because it creates users.
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
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
  createPost,
  getPost,
  listPosts,
  updatePost,
  deletePost,
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

describe('P3 posts and neighbourhood feeds', () => {
  let neighbourhoodId: number;
  beforeAll(async () => {
    const { data, error } = await service
      .from('neighbourhoods')
      .insert({ name: `P3 test ${runId}`, lat: 1.3, lng: 103.8 })
      .select('id')
      .single();
    if (error) throw error;
    neighbourhoodId = data.id;
  });

  it('reuses the same post when a draft is submitted again after a lost response', async () => {
    const input = { body: 'Retry me', neighbourhoodId, requestId: randomUUID() };
    const first = await createPost(resident.client, input);
    const retry = await createPost(resident.client, input);
    expect(retry.id).toBe(first.id);
    const changed = await createPost(resident.client, { ...input, body: 'Changed before retry' });
    expect(changed.id).toBe(first.id);
    expect(changed.body).toBe('Changed before retry');
    await deletePost(resident.client, first.id);
  });

  it('creates, reads, edits and deletes an own post using the shared API', async () => {
    const post = await createPost(resident.client, {
      body: '  Hello neighbourhood  ',
      neighbourhoodId,
    });
    expect(post.body).toBe('Hello neighbourhood');
    expect(post.author?.display_name).toBeTruthy();
    expect(post.author && Object.keys(post.author).sort()).toEqual([
      'avatar_url',
      'display_name',
      'id',
    ]);
    expect((await getPost(other.client, post.id))?.body).toBe('Hello neighbourhood');
    await expect(updatePost(other.client, post.id, { body: 'hacked' })).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(deletePost(other.client, post.id)).rejects.toMatchObject({ code: 'not_found' });
    expect((await updatePost(resident.client, post.id, { body: 'Updated' })).body).toBe('Updated');
    await deletePost(resident.client, post.id);
    expect(await getPost(resident.client, post.id)).toBeNull();
  });

  it('paginates tied timestamps without duplicates and excludes removed and other-neighbourhood posts', async () => {
    const createdAt = new Date().toISOString();
    const { data, error } = await service
      .from('posts')
      .insert(
        Array.from({ length: 5 }, (_, i) => ({
          author_id: resident.id,
          neighbourhood_id: neighbourhoodId,
          body: `Pagination ${i}`,
          created_at: createdAt,
        })),
      )
      .select('id');
    if (error) throw error;
    const excluded = await service.from('posts').insert([
      {
        author_id: resident.id,
        neighbourhood_id: neighbourhoodId,
        body: 'Removed',
        is_removed: true,
      },
      { author_id: resident.id, neighbourhood_id: 1, body: 'Other neighbourhood' },
    ]);
    if (excluded.error) throw excluded.error;
    const ids: string[] = [];
    let cursor: Awaited<ReturnType<typeof listPosts>>['nextCursor'] = null;
    do {
      const page = await listPosts(resident.client, { neighbourhoodId, limit: 2, cursor });
      ids.push(...page.posts.map((post) => post.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(ids).toEqual(
      data
        .map((row) => row.id)
        .sort()
        .reverse(),
    );
  });

  it('enforces authorship, nonblank bodies and database-owned timestamps for direct clients', async () => {
    const blank = await resident.client
      .from('posts')
      .insert({ author_id: resident.id, body: ' \n\t ' });
    expect(blank.error?.code).toBe('23514');
    const spoof = await resident.client
      .from('posts')
      .insert({ author_id: other.id, body: 'spoof' });
    expect(spoof.error?.code).toBe('42501');
    const backdated = await resident.client
      .from('posts')
      .insert({ author_id: resident.id, body: 'backdated', created_at: hourAgo() });
    expect(backdated.error?.code).toBe('42501');
    const post = await createPost(resident.client, { body: 'Original', neighbourhoodId });
    const edit = await other.client
      .from('posts')
      .update({ body: 'hacked' })
      .eq('id', post.id)
      .select('id');
    expect(edit.data).toEqual([]);
    const metadata = await resident.client
      .from('posts')
      .update({ is_removed: true })
      .eq('id', post.id);
    expect(metadata.error?.code).toBe('42501');
    await deletePost(resident.client, post.id);
  });

  it('hides blocked authors and removed content, including from its author in the normal feed', async () => {
    const post = await createPost(resident.client, { body: 'Visibility', neighbourhoodId });
    try {
      const block = await other.client
        .from('blocks')
        .insert({ blocker_id: other.id, blocked_id: resident.id });
      if (block.error) throw block.error;
      expect(await getPost(other.client, post.id)).toBeNull();
      expect(
        (await listPosts(other.client, { neighbourhoodId })).posts.some((p) => p.id === post.id),
      ).toBe(false);
    } finally {
      await other.client.from('blocks').delete().eq('blocked_id', resident.id);
    }
    const removal = await service.from('posts').update({ is_removed: true }).eq('id', post.id);
    if (removal.error) throw removal.error;
    expect(await getPost(resident.client, post.id)).toBeNull();
    await expect(updatePost(resident.client, post.id, { body: 'Restore' })).rejects.toMatchObject({
      code: 'not_found',
    });
    const direct = await resident.client
      .from('posts')
      .update({ body: 'Evade moderation' })
      .eq('id', post.id)
      .select('id');
    expect(direct.data).toEqual([]);
  });

  it('prevents suspended authors from editing and deleting, even with an existing session', async () => {
    const post = await createPost(other.client, { body: 'Before suspension', neighbourhoodId });
    await setUserStatus(admin.client, other.id, 'suspended', 'P3 test');
    try {
      await expect(
        updatePost(other.client, post.id, { body: 'After suspension' }),
      ).rejects.toMatchObject({ code: 'not_found' });
      await expect(deletePost(other.client, post.id)).rejects.toMatchObject({ code: 'not_found' });
    } finally {
      await setUserStatus(admin.client, other.id, 'active');
    }
    await deletePost(other.client, post.id);
  });
});
