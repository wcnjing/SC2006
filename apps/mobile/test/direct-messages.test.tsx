import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { listDirectMessages, type DirectMessagePage, type Message } from '@communitylink/shared';
import { useDirectMessages } from '../src/community/useDirectMessages';

vi.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
}));
vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('@communitylink/shared', async (original) => ({
  ...(await original<object>()),
  listDirectMessages: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let thread: ReturnType<typeof useDirectMessages>;
const message = (id: string) => ({ id, created_at: '2026-10-18T00:00:00Z' }) as Message;
function deferred() {
  let resolve!: (page: DirectMessagePage) => void;
  const promise = new Promise<DirectMessagePage>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function Harness({ id, enabled = true }: { id: string; enabled?: boolean }) {
  thread = useDirectMessages(id, enabled);
  return null;
}
beforeEach(() => {
  vi.mocked(listDirectMessages).mockReset();
  root = createRoot(document.createElement('div'));
});
afterEach(async () => {
  await act(async () => root.unmount());
});

it('clears private messages and ignores a late page when a connection becomes unavailable', async () => {
  const late = deferred();
  vi.mocked(listDirectMessages)
    .mockResolvedValueOnce({ messages: [message('private')], nextCursor: null })
    .mockReturnValueOnce(late.promise);
  await act(async () => root.render(<Harness id="peer" />));
  await act(async () => thread.refresh());
  await act(async () => root.render(<Harness id="peer" enabled={false} />));
  await act(async () => late.resolve({ messages: [message('private')], nextCursor: null }));
  expect(thread.messages).toEqual([]);
  expect(thread.loading).toBe(false);
});
it('does not mix a previous resident’s messages into a new conversation', async () => {
  const late = deferred();
  vi.mocked(listDirectMessages)
    .mockReturnValueOnce(late.promise)
    .mockResolvedValueOnce({ messages: [message('new')], nextCursor: null });
  await act(async () => root.render(<Harness id="old" />));
  await act(async () => root.render(<Harness id="new" />));
  await act(async () => late.resolve({ messages: [message('old')], nextCursor: null }));
  expect(thread.messages.map((row) => row.id)).toEqual(['new']);
});
it('preserves a sent message when a previous refresh completes late, without duplicate retries', async () => {
  const late = deferred();
  vi.mocked(listDirectMessages)
    .mockResolvedValueOnce({ messages: [], nextCursor: null })
    .mockReturnValueOnce(late.promise);
  await act(async () => root.render(<Harness id="peer" />));
  await act(async () => thread.refresh());
  await act(async () => {
    thread.upsert(message('sent'));
    thread.upsert(message('sent'));
  });
  await act(async () => late.resolve({ messages: [], nextCursor: null }));
  expect(thread.messages.map((row) => row.id)).toEqual(['sent']);
});
