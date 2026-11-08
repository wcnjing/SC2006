import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

type State<T> = { data: T | undefined; error: unknown; loading: boolean; refreshing: boolean };

/**
 * Load data for a screen and reload it whenever the screen comes back into
 * focus, so e.g. joining on Activity details is reflected on Home and My
 * activities when the user goes back. Stale responses are ignored.
 *
 *   const recs = useAsync(() => activityService.getRecommendations());
 *   recs.loading / recs.error / recs.data / recs.refresh() / recs.reload()
 */
export function useAsync<T>(load: () => Promise<T>) {
  const [state, setState] = useState<State<T>>({
    data: undefined,
    error: undefined,
    loading: true,
    refreshing: false,
  });
  const loadRef = useRef(load);
  const seq = useRef(0);
  useEffect(() => {
    loadRef.current = load;
  });

  /** 'initial' shows the spinner, 'refresh' the pull-to-refresh indicator, 'silent' neither. */
  const run = useCallback(async (mode: 'initial' | 'refresh' | 'silent') => {
    const id = ++seq.current;
    setState((s) => ({
      ...s,
      loading: mode === 'initial',
      refreshing: mode === 'refresh',
      error: mode === 'silent' ? s.error : undefined,
    }));
    try {
      const data = await loadRef.current();
      if (id === seq.current)
        setState({ data, error: undefined, loading: false, refreshing: false });
    } catch (error) {
      if (id === seq.current) setState((s) => ({ ...s, error, loading: false, refreshing: false }));
    }
  }, []);

  const hasData = useRef(false);
  useEffect(() => {
    hasData.current = state.data !== undefined;
  }, [state.data]);

  useFocusEffect(
    useCallback(() => {
      run(hasData.current ? 'silent' : 'initial');
    }, [run]),
  );

  return {
    ...state,
    reload: useCallback(() => run('initial'), [run]),
    refresh: useCallback(() => run('refresh'), [run]),
    /** Reload in the background with no spinner, e.g. after a Save / Join. */
    revalidate: useCallback(() => run('silent'), [run]),
  };
}
