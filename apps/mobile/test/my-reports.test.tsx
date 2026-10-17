import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { listMyReports, type MyReportPage, type SubmittedReport } from '@communitylink/shared';
import { useMyReports } from '../src/community/useMyReports';

vi.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
}));
vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('@communitylink/shared', async (original) => ({
  ...(await original<object>()),
  listMyReports: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let history: ReturnType<typeof useMyReports>;
const report = (id: string) => ({ id }) as SubmittedReport;
const cursor = { id: 'first', createdAt: '2026-10-17T00:00:00Z' };
function Harness({ userId }: { userId: string | null }) {
  history = useMyReports(userId);
  return null;
}
beforeEach(() => {
  vi.mocked(listMyReports).mockReset();
  root = createRoot(document.createElement('div'));
});
afterEach(async () => {
  await act(async () => root.unmount());
});

it('discards late results after switching residents or signing out', async () => {
  let resolve!: (page: MyReportPage) => void;
  vi.mocked(listMyReports)
    .mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    )
    .mockResolvedValueOnce({ reports: [report('Mei')], nextCursor: null });
  await act(async () => root.render(<Harness userId="Yining" />));
  await act(async () => root.render(<Harness userId="Mei" />));
  await act(async () => resolve({ reports: [report('Private to Yining')], nextCursor: null }));
  expect(history.reports.map((row) => row.id)).toEqual(['Mei']);
  await act(async () => root.render(<Harness userId={null} />));
  expect(history.reports).toEqual([]);
  expect(history.loading).toBe(false);
});

it('retains history on a failed older page and retries that page, deduplicating results', async () => {
  vi.mocked(listMyReports)
    .mockResolvedValueOnce({ reports: [report('first')], nextCursor: cursor })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ reports: [report('first'), report('older')], nextCursor: null });
  await act(async () => root.render(<Harness userId="Yining" />));
  await act(async () => history.loadMore());
  expect(history.error).toBeTruthy();
  expect(history.reports.map((row) => row.id)).toEqual(['first']);
  await act(async () => history.retry());
  expect(vi.mocked(listMyReports).mock.calls[2][1]?.cursor).toEqual(cursor);
  expect(history.reports.map((row) => row.id)).toEqual(['first', 'older']);
  expect(history.hasMore).toBe(false);
  expect(history.error).toBeNull();
});
