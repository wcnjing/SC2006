import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listPosts, type CommunityPost, type PostFeedPage } from '@communitylink/shared';
import { usePostFeed } from '../src/community/usePostFeed';

vi.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
}));
vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('@communitylink/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPosts: vi.fn(),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let feed: ReturnType<typeof usePostFeed>;
const post = (id: string) => ({ id, body: id }) as CommunityPost;
const cursor = { id: 'oldest', createdAt: '2026-10-17T00:00:00Z' };
function deferred() {
  let resolve!: (page: PostFeedPage) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<PostFeedPage>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function Harness({ id }: { id: number }) {
  feed = usePostFeed(id);
  return null;
}
beforeEach(() => {
  vi.mocked(listPosts).mockReset();
  root = createRoot(document.createElement('div'));
});
afterEach(async () => {
  await act(async () => root.unmount());
});

describe('feed request lifecycle', () => {
  it('ignores old neighbourhood responses even if cancellation is not respected', async () => {
    const first = deferred();
    const second = deferred();
    vi.mocked(listPosts).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await act(async () => root.render(<Harness id={1} />));
    const oldSignal = vi.mocked(listPosts).mock.calls[0][1].signal;
    await act(async () => root.render(<Harness id={2} />));
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => second.resolve({ posts: [post('new neighbourhood')], nextCursor: null }));
    await act(async () =>
      first.resolve({ posts: [post('old neighbourhood')], nextCursor: cursor }),
    );
    expect(feed.posts.map((p) => p.id)).toEqual(['new neighbourhood']);
    expect(feed.hasMore).toBe(false);
    expect(feed.loading).toBe(false);
  });

  it('prevents simultaneous older-page requests and retries the failed page without losing posts', async () => {
    const older = deferred();
    vi.mocked(listPosts)
      .mockResolvedValueOnce({ posts: [post('one')], nextCursor: cursor })
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce({ posts: [post('one'), post('two')], nextCursor: null });
    await act(async () => root.render(<Harness id={1} />));
    await act(async () => {
      feed.loadMore();
      feed.loadMore();
    });
    expect(listPosts).toHaveBeenCalledTimes(2);
    await act(async () => older.reject(new Error('network unavailable')));
    expect(feed.error).toBeTruthy();
    expect(feed.posts.map((p) => p.id)).toEqual(['one']);
    await act(async () => feed.retry());
    expect(vi.mocked(listPosts).mock.calls[2][1].cursor).toEqual(cursor);
    expect(feed.posts.map((p) => p.id)).toEqual(['one', 'two']);
    expect(feed.error).toBeNull();
  });

  it('lets refresh replace an in-flight older page and retries refresh as refresh', async () => {
    const older = deferred();
    vi.mocked(listPosts)
      .mockResolvedValueOnce({ posts: [post('old')], nextCursor: cursor })
      .mockReturnValueOnce(older.promise)
      .mockRejectedValueOnce(new Error('refresh failed'))
      .mockResolvedValueOnce({ posts: [post('fresh')], nextCursor: null });
    await act(async () => root.render(<Harness id={1} />));
    await act(async () => feed.loadMore());
    await act(async () => feed.refresh());
    await act(async () => older.resolve({ posts: [post('stale')], nextCursor: null }));
    expect(feed.posts.map((p) => p.id)).toEqual(['old']);
    await act(async () => feed.retry());
    expect(vi.mocked(listPosts).mock.calls[3][1].cursor).toBeNull();
    expect(feed.posts.map((p) => p.id)).toEqual(['fresh']);
  });
});
