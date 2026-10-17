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
  createComment,
  listComments,
  updateComment,
  deleteComment,
  getPostLikeState,
  setPostLiked,
  submitReport,
  listMyReports,
  listModerationReports,
  getModerationReport,
  reviewContentReport,
  listModerationAudit,
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

describe('P3 comments and likes', () => {
  it('supports author comment CRUD, idempotent retries and one like per user', async () => {
    const post = await createPost(resident.client, { body: 'Discuss here', neighbourhoodId: 1 });
    const input = { postId: post.id, body: 'Hello neighbours', requestId: randomUUID() };
    const comment = await createComment(other.client, input);
    expect((await createComment(other.client, input)).id).toBe(comment.id);
    expect((await listComments(resident.client, post.id)).comments.map((row) => row.id)).toEqual([
      comment.id,
    ]);
    expect(comment.author && Object.keys(comment.author).sort()).toEqual([
      'avatar_url',
      'display_name',
      'id',
    ]);
    await expect(updateComment(resident.client, comment.id, 'Not mine')).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(deleteComment(resident.client, comment.id)).rejects.toMatchObject({
      code: 'not_found',
    });
    expect((await updateComment(other.client, comment.id, 'Edited')).body).toBe('Edited');
    await setPostLiked(resident.client, post.id, true);
    expect(await setPostLiked(resident.client, post.id, true)).toEqual({
      likeCount: 1,
      likedByMe: true,
    });
    expect(await getPostLikeState(other.client, post.id)).toEqual({
      likeCount: 1,
      likedByMe: false,
    });
    await setPostLiked(other.client, post.id, true);
    expect(await setPostLiked(resident.client, post.id, false)).toEqual({
      likeCount: 1,
      likedByMe: false,
    });
    await deleteComment(other.client, comment.id);
    expect((await listComments(resident.client, post.id)).comments).toEqual([]);
    await createComment(other.client, { postId: post.id, body: 'Cascade me' });
    await deletePost(resident.client, post.id);
    expect((await service.from('comments').select('id').eq('post_id', post.id)).data).toEqual([]);
    expect(
      (await service.from('post_likes').select('post_id').eq('post_id', post.id)).data,
    ).toEqual([]);
  });

  it('rejects direct metadata/authorship spoofing and whitespace-only comments', async () => {
    const post = await createPost(resident.client, {
      body: 'Protected interaction data',
      neighbourhoodId: 1,
    });
    const row = { author_id: resident.id, post_id: post.id, body: 'Hello' };
    expect(
      (await resident.client.from('comments').insert({ ...row, body: ' \n\t ' })).error?.code,
    ).toBe('23514');
    expect(
      (await resident.client.from('comments').insert({ ...row, author_id: other.id })).error?.code,
    ).toBe('42501');
    expect(
      (await resident.client.from('comments').insert({ ...row, created_at: hourAgo() })).error
        ?.code,
    ).toBe('42501');
    expect(
      (await resident.client.from('comments').insert({ ...row, is_removed: true })).error?.code,
    ).toBe('42501');
    expect(
      (await resident.client.from('post_likes').insert({ post_id: post.id, user_id: other.id }))
        .error?.code,
    ).toBe('42501');
    expect(
      (
        await resident.client
          .from('post_likes')
          .insert({ post_id: post.id, user_id: resident.id, created_at: hourAgo() })
      ).error?.code,
    ).toBe('42501');
    await deletePost(resident.client, post.id);
  });

  it('hides interactions on blocked/removed posts and prevents new interactions', async () => {
    const post = await createPost(resident.client, { body: 'Visibility', neighbourhoodId: 1 });
    const comment = await createComment(other.client, { postId: post.id, body: 'Own comment' });
    await setPostLiked(other.client, post.id, true);
    const block = await other.client
      .from('blocks')
      .insert({ blocker_id: other.id, blocked_id: resident.id });
    if (block.error) throw block.error;
    try {
      expect((await listComments(other.client, post.id)).comments).toEqual([]);
      await expect(getPostLikeState(other.client, post.id)).rejects.toMatchObject({
        code: 'not_found',
      });
      await expect(
        createComment(other.client, { postId: post.id, body: 'Blocked' }),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(updateComment(other.client, comment.id, 'Blocked edit')).rejects.toMatchObject({
        code: 'not_found',
      });
    } finally {
      await other.client.from('blocks').delete().eq('blocked_id', resident.id);
    }
    const removal = await service.from('posts').update({ is_removed: true }).eq('id', post.id);
    if (removal.error) throw removal.error;
    expect((await listComments(other.client, post.id)).comments).toEqual([]);
    await expect(setPostLiked(resident.client, post.id, true)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(deleteComment(other.client, comment.id)).rejects.toMatchObject({
      code: 'not_found',
    });
    const likes = await other.client.from('post_likes').select('user_id').eq('post_id', post.id);
    expect(likes.data).toEqual([]);
    await service.from('posts').delete().eq('id', post.id);
  });

  it('prevents suspended users from creating/editing/deleting comments and changing likes', async () => {
    const post = await createPost(resident.client, { body: 'Suspension test', neighbourhoodId: 1 });
    const comment = await createComment(other.client, {
      postId: post.id,
      body: 'Before suspension',
    });
    await setPostLiked(other.client, post.id, true);
    await setUserStatus(admin.client, other.id, 'suspended', 'Interaction test');
    try {
      await expect(
        createComment(other.client, { postId: post.id, body: 'Denied' }),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(updateComment(other.client, comment.id, 'Denied')).rejects.toMatchObject({
        code: 'not_found',
      });
      await expect(deleteComment(other.client, comment.id)).rejects.toMatchObject({
        code: 'not_found',
      });
      await expect(setPostLiked(other.client, post.id, false)).rejects.toMatchObject({
        code: '42501',
      });
    } finally {
      await setUserStatus(admin.client, other.id, 'active');
    }
    await deletePost(resident.client, post.id);
  });

  it('paginates comments with identical timestamps in chronological order', async () => {
    const post = await createPost(resident.client, { body: 'Comment pages', neighbourhoodId: 1 });
    const created_at = new Date().toISOString();
    const inserted = await service
      .from('comments')
      .insert(
        Array.from({ length: 5 }, (_, i) => ({
          post_id: post.id,
          author_id: other.id,
          body: `Page ${i}`,
          created_at,
        })),
      )
      .select('id');
    if (inserted.error) throw inserted.error;
    let cursor: Awaited<ReturnType<typeof listComments>>['nextCursor'] = null;
    const ids: string[] = [];
    for (let pageNumber = 0; pageNumber < 5; pageNumber++) {
      const page = await listComments(resident.client, post.id, { limit: 2, cursor });
      ids.unshift(...page.comments.map((row) => row.id));
      cursor = page.nextCursor;
      if (!cursor) break;
    }
    expect(cursor).toBeNull();
    expect(ids).toEqual(inserted.data.map((row) => row.id).sort());
    await deletePost(resident.client, post.id);
  });
});

describe('P3 reports', () => {
  it('lets residents report posts/comments and keeps history private, immutable and durable', async () => {
    const post = await createPost(resident.client, { body: 'Report target', neighbourhoodId: 1 });
    const comment = await createComment(resident.client, {
      postId: post.id,
      body: 'Comment target',
    });
    const input = {
      targetType: 'post' as const,
      targetId: post.id,
      reason: 'Spam',
      requestId: randomUUID(),
    };
    const report = await submitReport(other.client, input);
    const commentReport = await submitReport(other.client, {
      targetType: 'comment',
      targetId: comment.id,
      reason: 'Harassment',
    });
    expect((await submitReport(other.client, input)).id).toBe(report.id);
    expect(report.reporter_id).toBe(other.id);
    expect(report.status).toBe('open');
    expect(
      (await resident.client.from('reports').select('id').in('id', [report.id, commentReport.id]))
        .data,
    ).toEqual([]);
    expect((await listMyReports(resident.client)).reports.some((row) => row.id === report.id)).toBe(
      false,
    );
    // Admin moderation access does not widen their personal history API.
    expect((await admin.client.from('reports').select('id').eq('id', report.id)).data).toHaveLength(
      1,
    );
    expect((await listMyReports(admin.client)).reports.some((row) => row.id === report.id)).toBe(
      false,
    );
    const edit = await other.client
      .from('reports')
      .update({ status: 'dismissed' })
      .eq('id', report.id)
      .select('id');
    expect(edit.error?.code).toBe('42501');
    const deletion = await other.client.from('reports').delete().eq('id', report.id).select('id');
    expect(deletion.data).toEqual([]);
    await deletePost(resident.client, post.id);
    expect((await submitReport(other.client, input)).id).toBe(report.id);
    await reviewContentReport(
      admin.client,
      report.id,
      'dismiss',
      'Content was deleted by the author',
    );
    expect(
      (await listMyReports(other.client)).reports.find((row) => row.id === report.id),
    ).toMatchObject({ status: 'dismissed', resolution_note: 'Content was deleted by the author' });
  });

  it('rejects forged reporter/review metadata, blank reasons and nonexistent targets', async () => {
    const post = await createPost(resident.client, {
      body: 'Report permissions',
      neighbourhoodId: 1,
    });
    const row = {
      reporter_id: other.id,
      target_type: 'post' as const,
      target_id: post.id,
      reason: 'Spam',
    };
    expect(
      (await other.client.from('reports').insert({ ...row, reporter_id: resident.id })).error?.code,
    ).toBe('42501');
    for (const metadata of [
      { created_at: hourAgo() },
      { reviewed_by: admin.id },
      { reviewed_at: hourAgo() },
      { resolution_note: 'Forged review' },
      { status: 'dismissed' as const },
    ])
      expect((await other.client.from('reports').insert({ ...row, ...metadata })).error?.code).toBe(
        '42501',
      );
    expect(
      (await other.client.from('reports').insert({ ...row, reason: ' \n\t ' })).error?.code,
    ).toBe('23514');
    for (const target_type of ['post', 'comment'] as const)
      expect(
        (
          await other.client
            .from('reports')
            .insert({ ...row, target_type, target_id: randomUUID() })
        ).error?.code,
      ).toBe('42501');
    await deletePost(resident.client, post.id);
  });

  it('denies reports on blocked or removed content and reports from suspended sessions', async () => {
    const post = await createPost(resident.client, {
      body: 'Visibility checks',
      neighbourhoodId: 1,
    });
    const comment = await createComment(resident.client, {
      postId: post.id,
      body: 'Visible comment',
    });
    const postInput = { targetType: 'post' as const, targetId: post.id, reason: 'Spam' };
    const commentInput = { targetType: 'comment' as const, targetId: comment.id, reason: 'Spam' };
    const block = await other.client
      .from('blocks')
      .insert({ blocker_id: other.id, blocked_id: resident.id });
    if (block.error) throw block.error;
    try {
      await expect(submitReport(other.client, postInput)).rejects.toMatchObject({ code: '42501' });
      await expect(submitReport(other.client, commentInput)).rejects.toMatchObject({
        code: '42501',
      });
    } finally {
      await other.client.from('blocks').delete().eq('blocked_id', resident.id);
    }
    await setUserStatus(admin.client, other.id, 'suspended', 'Report test');
    try {
      await expect(submitReport(other.client, postInput)).rejects.toMatchObject({ code: '42501' });
    } finally {
      await setUserStatus(admin.client, other.id, 'active');
    }
    const removed = await service
      .from('comments')
      .update({ is_removed: true })
      .eq('id', comment.id);
    if (removed.error) throw removed.error;
    await expect(submitReport(other.client, commentInput)).rejects.toMatchObject({ code: '42501' });
    const removedParent = await service
      .from('posts')
      .update({ is_removed: true })
      .eq('id', post.id);
    if (removedParent.error) throw removedParent.error;
    await expect(submitReport(resident.client, postInput)).rejects.toMatchObject({ code: '42501' });
    await service.from('posts').delete().eq('id', post.id);
  });

  it('paginates personal history when report timestamps tie', async () => {
    const created_at = new Date().toISOString();
    const rows = await service
      .from('reports')
      .insert(
        Array.from({ length: 5 }, (_, i) => ({
          reporter_id: resident.id,
          target_type: 'post' as const,
          target_id: randomUUID(),
          reason: `Pagination ${i}`,
          created_at,
        })),
      )
      .select('id');
    if (rows.error) throw rows.error;
    const all: string[] = [];
    let cursor: Awaited<ReturnType<typeof listMyReports>>['nextCursor'] = null;
    for (let i = 0; i < 100; i++) {
      const page = await listMyReports(resident.client, { limit: 2, cursor });
      all.push(...page.reports.map((row) => row.id));
      cursor = page.nextCursor;
      if (!cursor) break;
    }
    expect(cursor).toBeNull();
    expect(all.filter((id) => rows.data.some((row) => row.id === id))).toEqual(
      rows.data
        .map((row) => row.id)
        .sort()
        .reverse(),
    );
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('P3 admin moderation', () => {
  async function fixture() {
    const post = await createPost(resident.client, {
      body: 'Moderation target',
      neighbourhoodId: 1,
    });
    const report = await submitReport(other.client, {
      targetType: 'post',
      targetId: post.id,
      reason: 'Spam',
    });
    return { post, report };
  }
  async function auditFor(reportId: string) {
    const result = await service
      .from('audit_log')
      .select('*')
      .contains('details', { report_id: reportId });
    if (result.error) throw result.error;
    return result.data;
  }

  it('atomically removes posts, resolves reports and audits the actor once across concurrent retries', async () => {
    const { post, report } = await fixture();
    expect((await getModerationReport(admin.client, report.id))?.content?.body).toBe(post.body);
    const decisions = await Promise.all([
      reviewContentReport(admin.client, report.id, 'remove', 'Advertising violation'),
      reviewContentReport(admin.client, report.id, 'remove', 'Advertising violation'),
    ]);
    expect(
      decisions.every((row) => row.status === 'actioned' && row.reviewed_by === admin.id),
    ).toBe(true);
    const audit = await auditFor(report.id);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actor_id: admin.id,
      action: 'remove_content',
      target_type: 'post',
      target_id: post.id,
      details: {
        reason: 'Advertising violation',
        from: 'open',
        to: 'actioned',
        content_changed: true,
      },
    });
    expect(
      (await listMyReports(other.client)).reports.find((row) => row.id === report.id)?.status,
    ).toBe('actioned');
    expect(await getPost(resident.client, post.id)).toBeNull();
    expect((await getModerationReport(admin.client, report.id))?.content).toMatchObject({
      body: post.body,
      isRemoved: true,
    });
    await expect(
      reviewContentReport(admin.client, report.id, 'dismiss', 'Different decision'),
    ).rejects.toMatchObject({ code: '40001' });
    expect(await auditFor(report.id)).toHaveLength(1);
  });

  it('removes a comment independently and keeps the first removal reason across reports', async () => {
    const { post } = await fixture();
    const comment = await createComment(other.client, {
      postId: post.id,
      body: 'Moderated comment',
    });
    const first = await submitReport(resident.client, {
      targetType: 'comment',
      targetId: comment.id,
      reason: 'Abuse',
    });
    const second = await submitReport(resident.client, {
      targetType: 'comment',
      targetId: comment.id,
      reason: 'Another report',
    });
    await reviewContentReport(admin.client, first.id, 'remove', 'Original removal reason');
    await reviewContentReport(admin.client, second.id, 'remove', 'Related report resolved');
    expect((await listComments(resident.client, post.id)).comments).toEqual([]);
    expect(await getPost(resident.client, post.id)).not.toBeNull();
    expect((await getModerationReport(admin.client, second.id))?.content).toMatchObject({
      isRemoved: true,
      removedReason: 'Original removal reason',
    });
    expect((await auditFor(second.id))[0]!.details).toMatchObject({ content_changed: false });
  });

  it('allows one winner when two admins make conflicting decisions', async () => {
    const { post, report } = await fixture();
    const secondAdmin = await userWithRole('moderator-race', 'admin');
    const results = await Promise.allSettled([
      reviewContentReport(admin.client, report.id, 'remove', 'Remove decision'),
      reviewContentReport(secondAdmin.client, report.id, 'dismiss', 'Dismiss decision'),
    ]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((row) => row.status === 'rejected');
    expect(failed?.status === 'rejected' && failed.reason.code).toBe('40001');
    expect(await auditFor(report.id)).toHaveLength(1);
    const current = await getModerationReport(admin.client, report.id);
    expect(current?.content?.isRemoved).toBe(current?.report.status === 'actioned');
    expect(current?.content?.id).toBe(post.id);
  });

  it('rejects unauthorised RPCs, direct review updates, protected content and fake audit entries', async () => {
    const { post, report } = await fixture();
    const args = { p_report_id: report.id, p_action: 'remove', p_reason: 'Reason' };
    expect((await resident.client.rpc('review_content_report', args)).error?.code).toBe('42501');
    expect((await newClient().rpc('review_content_report', args)).error?.code).toBe('42501');
    await expect(listModerationReports(resident.client)).rejects.toMatchObject({ code: '42501' });
    await expect(listModerationAudit(resident.client)).rejects.toMatchObject({ code: '42501' });
    expect(
      (await admin.client.from('reports').update({ status: 'dismissed' }).eq('id', report.id)).error
        ?.code,
    ).toBe('42501');
    expect(
      (await admin.client.from('posts').update({ is_removed: true }).eq('id', post.id)).error?.code,
    ).toBe('42501');
    expect(
      (
        await admin.client
          .from('audit_log')
          .insert({ action: 'forged', target_type: 'post', target_id: post.id })
      ).error?.code,
    ).toBe('42501');
    expect(
      (
        await admin.client.rpc('write_audit_log', {
          p_action: 'forged',
          p_target_type: 'post',
          p_target_id: post.id,
        })
      ).error?.code,
    ).toBe('42501');
    const suspended = await userWithRole('moderator-suspended', 'admin');
    await setUserStatus(admin.client, suspended.id, 'suspended', 'Moderation test');
    expect((await suspended.client.rpc('review_content_report', args)).error?.code).toBe('42501');
    expect(await auditFor(report.id)).toEqual([]);
    expect((await getModerationReport(admin.client, report.id))?.report.status).toBe('open');
  });

  it('does not partially change state after invalid or missing-target decisions, and audits dismissal', async () => {
    const { post, report } = await fixture();
    for (const p_reason of [' \n\t ', 'x'.repeat(1001)])
      expect(
        (
          await admin.client.rpc('review_content_report', {
            p_report_id: report.id,
            p_action: 'remove',
            p_reason,
          })
        ).error?.code,
      ).toBe('22023');
    expect(
      (
        await admin.client.rpc('review_content_report', {
          p_report_id: report.id,
          p_action: 'restore',
          p_reason: 'Reason',
        })
      ).error?.code,
    ).toBe('22023');
    await deletePost(resident.client, post.id);
    await expect(
      reviewContentReport(admin.client, report.id, 'remove', 'Missing target'),
    ).rejects.toMatchObject({ code: 'P0002' });
    expect((await getModerationReport(admin.client, report.id))?.report.status).toBe('open');
    expect(await auditFor(report.id)).toEqual([]);
    await reviewContentReport(admin.client, report.id, 'dismiss', 'Content was deleted');
    const audit = await auditFor(report.id);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: 'dismiss_report',
      target_type: 'report',
      target_id: report.id,
    });
    expect(
      (await listModerationAudit(admin.client)).entries.some((entry) => entry.id === audit[0]!.id),
    ).toBe(true);
    const page = await listModerationReports(admin.client, { status: 'dismissed', limit: 50 });
    expect(page.reports.some((row) => row.id === report.id)).toBe(true);
  });
});
