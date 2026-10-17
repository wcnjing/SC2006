import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { communityText } from './communityUi';

/** Shared pagination for the admin queue and audit history; stale pages never cross filters. */
export function useModerationPage<T extends { id: string | number }, C>(
  fetchPage: (
    signal: AbortSignal,
    cursor: C | null,
  ) => Promise<{ items: T[]; nextCursor: C | null }>,
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursor = useRef<C | null>(null);
  const controller = useRef<AbortController | null>(null);
  const version = useRef(0);
  const busy = useRef(false);
  const failedReset = useRef(true);
  const load = useCallback(
    async (reset: boolean) => {
      if (!reset && (busy.current || cursor.current === null)) return;
      const current = ++version.current;
      controller.current?.abort();
      const next = new AbortController();
      controller.current = next;
      busy.current = true;
      failedReset.current = reset;
      setLoading(true);
      setError(null);
      try {
        const page = await fetchPage(next.signal, reset ? null : cursor.current);
        if (current !== version.current) return;
        setItems((previous) =>
          reset
            ? page.items
            : [...new Map([...previous, ...page.items].map((item) => [item.id, item])).values()],
        );
        cursor.current = page.nextCursor;
        setHasMore(page.nextCursor !== null);
      } catch {
        if (current === version.current) setError(communityText.loadError);
      } finally {
        if (current === version.current) {
          busy.current = false;
          setLoading(false);
        }
      }
    },
    [fetchPage],
  );
  useFocusEffect(
    useCallback(() => {
      setItems([]);
      cursor.current = null;
      setHasMore(false);
      void load(true);
      return () => {
        version.current += 1;
        controller.current?.abort();
        busy.current = false;
      };
    }, [load]),
  );
  return {
    items,
    loading,
    error,
    hasMore,
    refresh: () => void load(true),
    loadMore: () => void load(false),
    retry: () => void load(failedReset.current),
  };
}
