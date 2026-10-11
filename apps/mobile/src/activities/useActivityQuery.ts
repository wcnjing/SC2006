import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

export function useActivityQuery<T>(load: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    load: () => Promise<T>;
    attempt: number;
    data: T | null;
    error: string | null;
  } | null>(null);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      load().then(
        (data) => {
          if (active) setResult({ load, attempt, data, error: null });
        },
        (error: unknown) => {
          if (active)
            setResult({
              load,
              attempt,
              data: null,
              error:
                error instanceof Error
                  ? error.message
                  : 'Unable to load activities. Please try again.',
            });
        },
      );
      return () => {
        active = false;
      };
    }, [load, attempt]),
  );
  // Changing the query or retrying immediately hides the previous result.
  if (!result || result.load !== load || result.attempt !== attempt) {
    return { data: null, loading: true, error: null, retry };
  }
  return { data: result.data, loading: false, error: result.error, retry };
}
