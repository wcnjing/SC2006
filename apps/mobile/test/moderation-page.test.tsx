import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useModerationPage } from '../src/community/useModerationPage';

vi.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
type Page = { items: { id: string }[]; nextCursor: number | null };
const fetchPage = vi.fn<(signal: AbortSignal, cursor: number | null) => Promise<Page>>();
let root: Root;
let history: ReturnType<typeof useModerationPage<{ id: string }, number>>;
function Harness({ load = fetchPage }: { load?: typeof fetchPage }) {
  history = useModerationPage(load);
  return null;
}
beforeEach(() => {
  fetchPage.mockReset();
  root = createRoot(document.createElement('div'));
});
afterEach(async () => {
  await act(async () => root.unmount());
});

it('ignores late pages after changing queue filters', async () => {
  let resolve!: (page: Page) => void;
  fetchPage.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await act(async () => root.render(<Harness />));
  const changed = vi
    .fn<typeof fetchPage>()
    .mockResolvedValue({ items: [{ id: 'new filter' }], nextCursor: null });
  await act(async () => root.render(<Harness load={changed} />));
  await act(async () => resolve({ items: [{ id: 'old filter' }], nextCursor: null }));
  expect(history.items.map((item) => item.id)).toEqual(['new filter']);
});

it('retains loaded rows and retries a failed older page without duplicating rows', async () => {
  fetchPage
    .mockResolvedValueOnce({ items: [{ id: 'latest' }], nextCursor: 20 })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ items: [{ id: 'latest' }, { id: 'older' }], nextCursor: null });
  await act(async () => root.render(<Harness />));
  await act(async () => history.loadMore());
  expect(history.items.map((item) => item.id)).toEqual(['latest']);
  expect(history.error).toBeTruthy();
  await act(async () => history.retry());
  expect(fetchPage.mock.calls[2][1]).toBe(20);
  expect(history.items.map((item) => item.id)).toEqual(['latest', 'older']);
  expect(history.hasMore).toBe(false);
});
