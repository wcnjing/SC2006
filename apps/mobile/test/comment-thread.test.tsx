import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { listComments, type CommunityComment, type CommentPage } from '@communitylink/shared';
import { useCommentThread } from '../src/community/useCommentThread';

vi.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
}));
vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('@communitylink/shared', async (original) => ({
  ...(await original<object>()),
  listComments: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let thread: ReturnType<typeof useCommentThread>;
const comment = (id: string) => ({ id, body: id }) as CommunityComment;
function deferred() {
  let resolve!: (page: CommentPage) => void;
  const promise = new Promise<CommentPage>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function Harness({ id }: { id: string }) {
  thread = useCommentThread(id);
  return null;
}
beforeEach(() => {
  vi.mocked(listComments).mockReset();
  root = createRoot(document.createElement('div'));
});
afterEach(async () => {
  await act(async () => root.unmount());
});

it('ignores a previous post’s late comment page', async () => {
  const old = deferred();
  vi.mocked(listComments)
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce({ comments: [comment('new post')], nextCursor: null });
  await act(async () => root.render(<Harness id="old" />));
  await act(async () => root.render(<Harness id="new" />));
  await act(async () => old.resolve({ comments: [comment('old post')], nextCursor: null }));
  expect(thread.comments.map((row) => row.id)).toEqual(['new post']);
});

it('preserves a newly posted comment when an older refresh completes late', async () => {
  const refresh = deferred();
  vi.mocked(listComments)
    .mockResolvedValueOnce({ comments: [comment('original')], nextCursor: null })
    .mockReturnValueOnce(refresh.promise);
  await act(async () => root.render(<Harness id="post" />));
  await act(async () => thread.refresh());
  await act(async () => thread.upsert(comment('new comment')));
  await act(async () => refresh.resolve({ comments: [comment('original')], nextCursor: null }));
  expect(thread.comments.map((row) => row.id)).toEqual(['original', 'new comment']);
  expect(thread.loading).toBe(false);
  await act(async () => thread.remove('original'));
  expect(thread.comments.map((row) => row.id)).toEqual(['new comment']);
});
