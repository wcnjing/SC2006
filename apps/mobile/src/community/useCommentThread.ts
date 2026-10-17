import type { CommunityComment, PostFeedCursor } from '@communitylink/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { listComments } from '../services/community';
import { communityText } from './communityUi';

export function useCommentThread(postId: string) {
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursor = useRef<PostFeedCursor | null>(null);
  const controller = useRef<AbortController | null>(null);
  const version = useRef(0);
  const busy = useRef(false);
  const failedReset = useRef(true);
  const load = useCallback(
    async (reset: boolean) => {
      if (!reset && (busy.current || !cursor.current)) return;
      const current = ++version.current;
      controller.current?.abort();
      const next = new AbortController();
      controller.current = next;
      busy.current = true;
      failedReset.current = reset;
      setLoading(true);
      setError(null);
      try {
        const page = await listComments(supabase, postId, {
          cursor: reset ? null : cursor.current,
          signal: next.signal,
        });
        if (version.current !== current) return;
        setComments((previous) =>
          reset
            ? page.comments
            : [
                ...new Map(
                  [...page.comments, ...previous].map((comment) => [comment.id, comment]),
                ).values(),
              ],
        );
        cursor.current = page.nextCursor;
        setHasMore(page.nextCursor !== null);
      } catch {
        if (version.current === current) setError(communityText.loadError);
      } finally {
        if (version.current === current) {
          busy.current = false;
          setLoading(false);
        }
      }
    },
    [postId],
  );
  useFocusEffect(
    useCallback(() => {
      setComments([]);
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
  function cancelRead() {
    version.current += 1;
    controller.current?.abort();
    busy.current = false;
    setLoading(false);
    setError(null);
  }
  function upsert(comment: CommunityComment) {
    cancelRead();
    setComments((previous) =>
      previous.some((row) => row.id === comment.id)
        ? previous.map((row) => (row.id === comment.id ? comment : row))
        : [...previous, comment],
    );
  }
  function remove(id: string) {
    cancelRead();
    setComments((previous) => previous.filter((row) => row.id !== id));
  }
  return {
    comments,
    loading,
    error,
    hasMore,
    upsert,
    remove,
    refresh: () => void load(true),
    loadMore: () => void load(false),
    retry: () => void load(failedReset.current),
  };
}
