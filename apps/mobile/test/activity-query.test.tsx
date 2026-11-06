import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useActivityQuery } from '../src/activities/useActivityQuery';

const mocks = vi.hoisted(() => ({
  focus: null as (() => void | (() => void)) | null,
  updates: [] as unknown[],
}));
vi.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    mocks.focus = callback;
  },
}));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const [value] = actual.useState(initial);
      return [
        value,
        (next: unknown) => {
          mocks.updates.push(next);
        },
      ];
    },
  };
});
function Screen({ load }: { load: () => Promise<string> }) {
  const query = useActivityQuery(load);
  return <span>{query.loading ? 'Loading' : query.data}</span>;
}
beforeEach(() => {
  mocks.updates = [];
  mocks.focus = null;
});
describe('P2 queries on screen focus', () => {
  it('reloads on each focus, so returning from organiser management fetches fresh data', async () => {
    const load = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('updated');
    expect(renderToStaticMarkup(<Screen load={load} />)).toContain('Loading');
    expect(load).not.toHaveBeenCalled();
    const blur = mocks.focus!();
    await Promise.resolve();
    expect(mocks.updates).toContainEqual(expect.objectContaining({ data: 'old' }));
    if (blur) blur();
    mocks.focus!();
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(2);
    expect(mocks.updates).toContainEqual(expect.objectContaining({ data: 'updated' }));
  });
  it('ignores a late response after leaving the activity screen', async () => {
    let resolve!: (value: string) => void;
    const load = () =>
      new Promise<string>((done) => {
        resolve = done;
      });
    renderToStaticMarkup(<Screen load={load} />);
    const blur = mocks.focus!();
    if (blur) blur();
    resolve('stale');
    await Promise.resolve();
    expect(mocks.updates).toEqual([]);
  });
  it('keeps readable failures for the existing retry UI', async () => {
    renderToStaticMarkup(<Screen load={() => Promise.reject(new Error('Network unavailable'))} />);
    mocks.focus!();
    await Promise.resolve();
    expect(mocks.updates).toContainEqual(
      expect.objectContaining({ error: 'Network unavailable', data: null }),
    );
  });
});
