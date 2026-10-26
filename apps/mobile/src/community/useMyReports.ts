import type { ReportCursor, SubmittedReport } from '@communitylink/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { listMyReports } from '../services/community';
import { communityText } from './communityUi';

export function useMyReports(userId: string | null) {
  const [reports, setReports] = useState<SubmittedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursor = useRef<ReportCursor | null>(null);
  const controller = useRef<AbortController | null>(null);
  const version = useRef(0);
  const busy = useRef(false);
  const failedReset = useRef(true);
  const load = useCallback(
    async (reset: boolean) => {
      if (!userId || (!reset && (busy.current || !cursor.current))) return;
      const current = ++version.current;
      controller.current?.abort();
      const next = new AbortController();
      controller.current = next;
      busy.current = true;
      failedReset.current = reset;
      setLoading(true);
      setError(null);
      try {
        const page = await listMyReports(supabase, {
          cursor: reset ? null : cursor.current,
          signal: next.signal,
        });
        if (current !== version.current) return;
        setReports((previous) =>
          reset
            ? page.reports
            : [...new Map([...previous, ...page.reports].map((row) => [row.id, row])).values()],
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
    [userId],
  );
  useFocusEffect(
    useCallback(() => {
      setReports([]);
      setError(null);
      setHasMore(false);
      setLoading(false);
      cursor.current = null;
      void load(true);
      return () => {
        version.current += 1;
        controller.current?.abort();
        busy.current = false;
      };
    }, [load]),
  );
  return {
    reports,
    loading,
    error,
    hasMore,
    refresh: () => void load(true),
    loadMore: () => void load(false),
    retry: () => void load(failedReset.current),
  };
}
