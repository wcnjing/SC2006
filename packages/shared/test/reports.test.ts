import { createClient, type Session } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listMyReports,
  submitReport,
  validateReportContent,
  type CommunityLinkClient,
  type Database,
} from '../src';

const userId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const reportId = '33333333-3333-4333-8333-333333333333';
const date = '2026-10-17T12:00:00.123456+00:00';
const input = { targetType: 'post' as const, targetId, reason: 'Spam', requestId: reportId };
const report = {
  id: reportId,
  reporter_id: userId,
  target_type: 'post',
  target_id: targetId,
  reason: 'Spam',
  details: null,
  status: 'open',
  created_at: date,
  reviewed_at: null,
  resolution_note: null,
};
const fetchMock = vi.fn<typeof fetch>();
let client: CommunityLinkClient;
function respond(data: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
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
    data: { session: { user: { id: userId } } as Session },
    error: null,
  });
});

describe('report submission', () => {
  it('derives the reporter, trims content and excludes review/identity spoofing', async () => {
    respond(null);
    respond(report);
    const result = await submitReport(client, {
      ...input,
      reason: '  Spam  ',
      details: '  Advertising links  ',
      ...({
        reporter_id: targetId,
        status: 'dismissed',
        reviewed_by: targetId,
        created_at: date,
      } as object),
    });
    expect(result).toEqual(report);
    expect(request(0).url.searchParams.get('reporter_id')).toBe(`eq.${userId}`);
    expect(request().body).toEqual({
      id: reportId,
      reporter_id: userId,
      target_type: 'post',
      target_id: targetId,
      reason: 'Spam',
      details: 'Advertising links',
    });
    expect(request().url.searchParams.get('select')).not.toContain('reviewed_by');
  });

  it('supports comments and blank optional details without a request UUID', async () => {
    respond({ ...report, target_type: 'comment' });
    await submitReport(client, {
      targetType: 'comment',
      targetId,
      reason: 'Harassment',
      details: '  ',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(request().body).toEqual({
      reporter_id: userId,
      target_type: 'comment',
      target_id: targetId,
      reason: 'Harassment',
      details: null,
    });
  });

  it('rejects invalid content, target types and UUIDs without making requests', async () => {
    for (const bad of [
      { ...input, reason: ' \t\n ' },
      { ...input, reason: 'x'.repeat(101) },
      { ...input, details: 'x'.repeat(1001) },
      { ...input, targetId: 'invalid' },
      { ...input, requestId: 'invalid' },
      { ...input, targetType: 'message' as 'post' },
    ])
      await expect(submitReport(client, bad)).rejects.toMatchObject({ code: 'validation' });
    expect(validateReportContent('😀'.repeat(100), '😀'.repeat(1000))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires a session for both submission and history', async () => {
    vi.mocked(client.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });
    await expect(submitReport(client, input)).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(listMyReports(client)).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('recovers an existing reviewed report without reading or recreating its target', async () => {
    respond({ ...report, status: 'actioned', resolution_note: 'Removed' });
    expect((await submitReport(client, input)).status).toBe('actioned');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(request().init?.method).toBe('GET');
    expect(request().url.pathname).toBe('/rest/v1/reports');
  });

  it('recovers a concurrent retry after the initial lookup missed it', async () => {
    respond(null);
    respond({ code: '23505', message: 'duplicate key' }, 409);
    respond(report);
    expect((await submitReport(client, input)).id).toBe(reportId);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('never changes a submitted report when a request UUID is reused with different data', async () => {
    for (const changes of [
      { reason: 'New reason' },
      { details: 'Changed' },
      { targetType: 'comment' as const },
      { targetId: userId },
    ]) {
      respond(report);
      await expect(submitReport(client, { ...input, ...changes })).rejects.toMatchObject({
        code: 'conflict',
      });
    }
    expect(fetchMock.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
  });

  it('does not recover another reporter’s conflicting UUID', async () => {
    respond(null);
    respond({ code: '23505', message: 'duplicate key' }, 409);
    respond(null);
    await expect(submitReport(client, input)).rejects.toMatchObject({ code: 'conflict' });
    expect(request().url.searchParams.get('reporter_id')).toBe(`eq.${userId}`);
  });

  it('surfaces server target visibility or suspension denials', async () => {
    respond(null);
    respond({ code: '42501', message: 'new row violates row-level security' }, 403);
    await expect(submitReport(client, input)).rejects.toMatchObject({ code: '42501' });
  });
});

describe('own report history', () => {
  it('always filters by the signed-in reporter and paginates with timestamp precision', async () => {
    respond([report, { ...report, id: targetId }, { ...report, id: userId }]);
    const page = await listMyReports(client, { limit: 2 });
    expect(page.reports.map((row) => row.id)).toEqual([reportId, targetId]);
    expect(page.nextCursor).toEqual({ id: targetId, createdAt: date });
    const params = request().url.searchParams;
    expect(params.get('reporter_id')).toBe(`eq.${userId}`);
    expect(params.get('order')).toBe('created_at.desc,id.desc');
    expect(params.get('limit')).toBe('3');
    expect(params.get('select')).not.toContain('reviewed_by');
    respond([]);
    const next = await listMyReports(client, { cursor: page.nextCursor });
    expect(next.nextCursor).toBeNull();
    expect(request().url.searchParams.get('or')).toBe(
      `(created_at.lt.${date},and(created_at.eq.${date},id.lt.${targetId}))`,
    );
  });

  it('rejects invalid pagination and propagates request cancellation', async () => {
    for (const limit of [0, 51, 1.5])
      await expect(listMyReports(client, { limit })).rejects.toMatchObject({ code: 'validation' });
    await expect(
      listMyReports(client, { cursor: { id: reportId, createdAt: `${date},id.gt.x` } }),
    ).rejects.toMatchObject({ code: 'validation' });
    expect(fetchMock).not.toHaveBeenCalled();
    const controller = new AbortController();
    respond([]);
    await listMyReports(client, { signal: controller.signal });
    expect(request().init?.signal).toBe(controller.signal);
  });
});
