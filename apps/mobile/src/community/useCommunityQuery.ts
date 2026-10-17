import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { communityText } from './communityUi';

/** Refetch on focus (e.g. returning from edit), ignoring stale/unmounted requests. */
export function useCommunityQuery<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: true, error: null });
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const retry = useCallback(() => {
    const version = ++request.current;
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setState({ data: null, loading: true, error: null });
    void load(next.signal).then(
      (data) => {
        if (version === request.current) setState({ data, loading: false, error: null });
      },
      () => {
        if (version === request.current)
          setState({ data: null, loading: false, error: communityText.loadError });
      },
    );
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      retry();
      return () => {
        request.current += 1;
        controller.current?.abort();
      };
    }, [retry]),
  );
  const replace = useCallback((data: T) => {
    request.current += 1;
    controller.current?.abort();
    setState({ data, loading: false, error: null });
  }, []);
  return { ...state, retry, replace };
}
