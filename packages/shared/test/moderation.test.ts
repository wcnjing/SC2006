import { createClient, type Session } from '@supabase/supabase-js';
import { beforeEach, expect, it, vi } from 'vitest';
import {
  getModerationReport,
  listModerationReports,
  listModerationAudit,
  reviewContentReport,
  validateModerationReason,
  type CommunityLinkClient,
  type Database,
} from '../src';

const adminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const reportId = '33333333-3333-4333-8333-333333333333';
const targetId = '22222222-2222-4222-8222-222222222222';
const date = '2026-10-17T12:00:00.123456+00:00';
const report = { id: reportId, target_type: 'post', target_id: targetId, status: 'open' };
const admin = { role: 'admin', status: 'active' };
const fetchMock = vi.fn<typeof fetch>();
let client: CommunityLinkClient;
function respond(data: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}
function request(index = -1) {
  const [url, init] = fetchMock.mock.calls.at(index)!;
  return {
    url: new URL(String(url)),
    init,
    body: init?.body ? JSON.parse(String(init.body)) : null,
  };
}
beforeEach(() => {
  fetchMock.mockReset();
  client = createClient<Database>('http://localhost:54321', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchMock },
  });
  vi.spyOn(client.auth, 'getSession').mockResolvedValue({
    data: { session: { user: { id: adminId } } as Session },
    error: null,
  });
});

it('rejects non-admin and suspended readers before reading reports/content/audit', async () => {
  for (const profile of [
    { role: 'resident', status: 'active' },
    { role: 'admin', status: 'suspended' },
    null,
  ]) {
    for (const operation of [
      () => listModerationReports(client),
      () => getModerationReport(client, reportId),
      () => listModerationAudit(client),
    ]) {
      respond(profile);
      await expect(operation()).rejects.toMatchObject({ code: '42501' });
      expect(request().url.pathname).toBe('/rest/v1/profiles');
      expect(request().url.searchParams.get('id')).toBe(`eq.${adminId}`);
    }
  }
});

it('lists queue status and stable pages without applying a reporter filter', async () => {
  respond(admin);
  respond([
    { ...report, created_at: date },
    { ...report, id: targetId, created_at: date },
  ]);
  const page = await listModerationReports(client, { limit: 1 });
  expect(page.nextCursor).toEqual({ id: reportId, createdAt: date });
  expect(request().url.searchParams.get('status')).toBe('eq.open');
  expect(request().url.searchParams.has('reporter_id')).toBe(false);
  expect(request().url.searchParams.get('order')).toBe('created_at.desc,id.desc');
  respond(admin);
  respond([]);
  await listModerationReports(client, { status: 'all', cursor: page.nextCursor });
  expect(request().url.searchParams.has('status')).toBe(false);
  expect(request().url.searchParams.get('or')).toBe(
    `(created_at.lt.${date},and(created_at.eq.${date},id.lt.${reportId}))`,
  );
});

it('loads removed posts for review using only public author fields', async () => {
  respond(admin);
  respond(report);
  respond({
    id: targetId,
    author_id: adminId,
    body: 'Removed text',
    image_url: null,
    is_removed: true,
    removed_reason: 'Prior decision',
    created_at: date,
    author: { id: adminId, display_name: 'Admin', avatar_url: null },
  });
  const review = await getModerationReport(client, reportId);
  expect(review?.content).toMatchObject({
    body: 'Removed text',
    isRemoved: true,
    removedReason: 'Prior decision',
    type: 'post',
  });
  expect(request().url.searchParams.has('is_removed')).toBe(false);
  expect(request().url.searchParams.get('select')).toContain(
    'profiles!posts_author_id_fkey(id,display_name,avatar_url)',
  );
});

it('reviews comment content with parent context and handles deleted or unsupported targets', async () => {
  respond(admin);
  respond({ ...report, target_type: 'comment' });
  respond({
    id: targetId,
    author_id: adminId,
    body: 'Comment',
    is_removed: false,
    removed_reason: null,
    created_at: date,
    author: null,
    parent: { id: adminId, body: 'Parent', is_removed: true },
  });
  expect((await getModerationReport(client, reportId))?.content).toMatchObject({
    type: 'comment',
    body: 'Comment',
    parentPost: { body: 'Parent', is_removed: true },
  });
  respond(admin);
  respond(report);
  respond(null);
  expect((await getModerationReport(client, reportId))?.content).toBeNull();
  respond(admin);
  respond({ ...report, target_type: 'activity' });
  expect((await getModerationReport(client, reportId))?.content).toBeNull();
  expect(request().url.pathname).toBe('/rest/v1/reports');
  respond(admin);
  respond(null);
  expect(await getModerationReport(client, reportId)).toBeNull();
});

it('sends decisions only through the atomic audited RPC with server-derived reviewer identity', async () => {
  respond({ ...report, status: 'actioned' });
  expect((await reviewContentReport(client, reportId, 'remove', '  Harassment  ')).status).toBe(
    'actioned',
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(request().url.pathname).toBe('/rest/v1/rpc/review_content_report');
  expect(request().body).toEqual({
    p_report_id: reportId,
    p_action: 'remove',
    p_reason: 'Harassment',
  });
});

it('preserves permission and conflict errors from the server', async () => {
  for (const code of ['42501', '40001', 'P0002']) {
    respond({ code, message: 'Moderation refused' }, code === '42501' ? 403 : 409);
    await expect(
      reviewContentReport(client, reportId, 'dismiss', 'Reviewed'),
    ).rejects.toMatchObject({ code });
  }
});

it('validates decisions and pagination before sending requests', async () => {
  for (const reason of [' \n ', 'x'.repeat(1001)])
    await expect(reviewContentReport(client, reportId, 'remove', reason)).rejects.toMatchObject({
      code: 'validation',
    });
  expect(validateModerationReason('😀'.repeat(1000))).toBeNull();
  await expect(
    reviewContentReport(client, reportId, 'restore' as 'remove', 'Reason'),
  ).rejects.toMatchObject({ code: 'validation' });
  await expect(getModerationReport(client, 'bad')).rejects.toMatchObject({ code: 'validation' });
  await expect(listModerationReports(client, { status: 'bad' as 'open' })).rejects.toMatchObject({
    code: 'validation',
  });
  await expect(listModerationReports(client, { limit: 51 })).rejects.toMatchObject({
    code: 'validation',
  });
  await expect(
    listModerationReports(client, { cursor: { id: reportId, createdAt: `${date},id.gt.x` } }),
  ).rejects.toMatchObject({ code: 'validation' });
  await expect(listModerationAudit(client, { cursor: 1.5 })).rejects.toMatchObject({
    code: 'validation',
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('requires authentication for decisions and queue access', async () => {
  vi.mocked(client.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });
  await expect(reviewContentReport(client, reportId, 'remove', 'Reason')).rejects.toMatchObject({
    code: 'unauthenticated',
  });
  await expect(listModerationReports(client)).rejects.toMatchObject({ code: 'unauthenticated' });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('paginates moderation audit by its unique ID and forwards cancellation', async () => {
  respond(admin);
  respond([{ id: 3 }, { id: 2 }, { id: 1 }]);
  const controller = new AbortController();
  const page = await listModerationAudit(client, { limit: 2, signal: controller.signal });
  expect(page.entries.map((entry) => entry.id)).toEqual([3, 2]);
  expect(page.nextCursor).toBe(2);
  expect(request().url.searchParams.get('action')).toBe('in.(remove_content,dismiss_report)');
  expect(request().init?.signal).toBe(controller.signal);
  respond(admin);
  respond([]);
  await listModerationAudit(client, { cursor: page.nextCursor });
  expect(request().url.searchParams.get('id')).toBe('lt.2');
});
