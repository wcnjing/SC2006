import { beforeEach, expect, it, vi } from 'vitest';
import { createDemoBackend, DEMO_ACCOUNTS, DEMO_STORAGE_KEY } from '../src/demo/demoBackend';

vi.mock('expo-crypto', () => ({ randomUUID: () => '44444444-4444-4444-8444-444444444444' }));
const postId = '33333333-3333-4333-8333-000000000001';
const reportId = '88888888-8888-4888-8888-888888888888';
const secondId = '99999999-9999-4999-8999-999999999999';
const input = {
  targetType: 'post' as const,
  targetId: postId,
  reason: 'Spam',
  requestId: reportId,
};
let storage: Storage;
let backend: ReturnType<typeof createDemoBackend>;
beforeEach(() => {
  const values = new Map<string, string>();
  storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  } as Storage;
  backend = createDemoBackend(storage);
});
function admin() {
  backend.signIn(DEMO_ACCOUNTS[2].email);
}
async function reportPost() {
  backend.signIn(DEMO_ACCOUNTS[1].email);
  return backend.submitReport(input);
}

it('rejects residents, anonymous callers and suspended admins on every moderation API', async () => {
  await reportPost();
  const operations = [
    () => backend.listModerationReports(),
    () => backend.getModerationReport(reportId),
    () => backend.reviewContentReport(reportId, 'remove', 'Reason'),
    () => backend.listModerationAudit(),
  ];
  for (const run of operations) await expect(run()).rejects.toMatchObject({ code: '42501' });
  backend.signOut();
  for (const run of operations)
    await expect(run()).rejects.toMatchObject({ code: 'unauthenticated' });
  admin();
  const profile = DEMO_ACCOUNTS[2].profile;
  profile.status = 'suspended';
  try {
    for (const run of operations) await expect(run()).rejects.toMatchObject({ code: '42501' });
  } finally {
    profile.status = 'active';
  }
});

it('removes a post, resolves its report and persists one audit entry across retries', async () => {
  await reportPost();
  admin();
  expect((await backend.listModerationReports()).reports.map((row) => row.id)).toEqual([reportId]);
  const decision = await backend.reviewContentReport(
    reportId,
    'remove',
    '  Advertising violation  ',
  );
  expect(decision).toMatchObject({
    status: 'actioned',
    reviewed_by: DEMO_ACCOUNTS[2].profile.id,
    resolution_note: 'Advertising violation',
  });
  expect((await backend.reviewContentReport(reportId, 'remove', 'Advertising violation')).id).toBe(
    reportId,
  );
  expect((await backend.listModerationAudit()).entries).toHaveLength(1);
  expect((await backend.listModerationAudit()).entries[0]).toMatchObject({
    action: 'remove_content',
    actor_id: DEMO_ACCOUNTS[2].profile.id,
    target_id: postId,
    details: { report_id: reportId, content_changed: true },
  });
  expect((await backend.listModerationReports()).reports).toEqual([]);
  expect((await backend.listModerationReports({ status: 'actioned' })).reports).toHaveLength(1);
  expect((await backend.getModerationReport(reportId))?.content).toMatchObject({
    isRemoved: true,
    removedReason: 'Advertising violation',
  });
  const restored = createDemoBackend(storage);
  restored.signIn(DEMO_ACCOUNTS[0].email);
  expect(await restored.getPost(postId)).toBeNull();
  await expect(restored.updatePost(postId, { body: 'Evade moderation' })).rejects.toMatchObject({
    code: 'not_found',
  });
  restored.signIn(DEMO_ACCOUNTS[1].email);
  const own = (await restored.listMyReports()).reports[0];
  expect(own.status).toBe('actioned');
  expect(own).not.toHaveProperty('reviewed_by');
});

it('removes comments separately and preserves the original reason for an already removed target', async () => {
  backend.signIn(DEMO_ACCOUNTS[0].email);
  const comment = await backend.createComment({ postId, body: 'Reported comment' });
  backend.signIn(DEMO_ACCOUNTS[1].email);
  await backend.submitReport({ ...input, targetType: 'comment', targetId: comment.id });
  await backend.submitReport({
    ...input,
    targetType: 'comment',
    targetId: comment.id,
    requestId: secondId,
  });
  admin();
  await backend.reviewContentReport(reportId, 'remove', 'First removal reason');
  await backend.reviewContentReport(secondId, 'remove', 'Second report reviewed');
  const review = await backend.getModerationReport(secondId);
  expect(review?.content).toMatchObject({
    isRemoved: true,
    removedReason: 'First removal reason',
    parentPost: { id: postId },
  });
  expect((await backend.listModerationAudit()).entries[0].details).toMatchObject({
    content_changed: false,
  });
  backend.signIn(DEMO_ACCOUNTS[1].email);
  expect((await backend.listComments(postId)).comments).toEqual([]);
  expect(await backend.getPost(postId)).not.toBeNull();
});

it('dismisses without changing content and rejects a conflicting second decision', async () => {
  await reportPost();
  admin();
  await backend.reviewContentReport(reportId, 'dismiss', 'No violation found');
  await backend.reviewContentReport(reportId, 'dismiss', 'No violation found');
  await expect(
    backend.reviewContentReport(reportId, 'remove', 'Changed mind'),
  ).rejects.toMatchObject({ code: '40001' });
  expect((await backend.getPost(postId))?.is_removed).toBe(false);
  expect((await backend.listModerationAudit()).entries).toHaveLength(1);
  expect((await backend.listModerationAudit()).entries[0].action).toBe('dismiss_report');
});

it('does not partially persist decisions when storage fails', async () => {
  await reportPost();
  admin();
  vi.spyOn(storage, 'setItem').mockImplementationOnce(() => {
    throw new Error('storage full');
  });
  await expect(backend.reviewContentReport(reportId, 'remove', 'Violation')).rejects.toThrow(
    'storage full',
  );
  expect((await backend.getModerationReport(reportId))?.report.status).toBe('open');
  expect((await backend.getPost(postId))?.is_removed).toBe(false);
  expect((await backend.listModerationAudit()).entries).toEqual([]);
  await backend.reviewContentReport(reportId, 'remove', 'Violation');
  expect((await backend.listModerationAudit()).entries).toHaveLength(1);
});

it('leaves missing targets open on failed removal, then allows dismissal; validates reasons', async () => {
  await reportPost();
  backend.signIn(DEMO_ACCOUNTS[0].email);
  await backend.deletePost(postId);
  admin();
  expect((await backend.getModerationReport(reportId))?.content).toBeNull();
  await expect(backend.reviewContentReport(reportId, 'remove', 'Violation')).rejects.toMatchObject({
    code: 'P0002',
  });
  for (const reason of [' \n ', 'x'.repeat(1001)])
    await expect(backend.reviewContentReport(reportId, 'dismiss', reason)).rejects.toMatchObject({
      code: 'validation',
    });
  expect((await backend.listModerationAudit()).entries).toEqual([]);
  expect((await backend.listModerationReports()).reports).toHaveLength(1);
  await backend.reviewContentReport(reportId, 'dismiss', 'Author already deleted this post');
  expect((await backend.listModerationAudit()).entries).toHaveLength(1);
});

it('upgrades existing reports without losing data and paginates tied queue/audit timestamps', async () => {
  backend.signIn(DEMO_ACCOUNTS[1].email);
  vi.useFakeTimers();
  try {
    for (let i = 0; i < 25; i++)
      await backend.submitReport({
        ...input,
        requestId: `88888888-8888-4888-8888-${String(i).padStart(12, '0')}`,
      });
    const legacy = JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!);
    delete legacy.audit;
    for (const report of legacy.reports) delete report.reviewed_by;
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(legacy));
    admin();
    const first = await backend.listModerationReports();
    const second = await backend.listModerationReports({ cursor: first.nextCursor });
    expect(first.reports).toHaveLength(20);
    expect(second.reports).toHaveLength(5);
    const reports = [...first.reports, ...second.reports];
    expect(new Set(reports.map((row) => row.id)).size).toBe(25);
    for (const report of reports)
      await backend.reviewContentReport(report.id, 'dismiss', 'Reviewed');
    const audit = await backend.listModerationAudit();
    const older = await backend.listModerationAudit({ cursor: audit.nextCursor });
    expect([...audit.entries, ...older.entries].map((row) => row.id)).toEqual(
      Array.from({ length: 25 }, (_, i) => 25 - i),
    );
    expect(older.nextCursor).toBeNull();
    expect((await backend.listMyReports()).reports).toEqual([]);
  } finally {
    vi.useRealTimers();
  }
});
