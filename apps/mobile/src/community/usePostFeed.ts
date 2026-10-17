import type { CommunityPost, PostFeedCursor } from '@communitylink/shared';
import { listPosts } from '../services/community';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { communityText } from './communityUi';

export function usePostFeed(neighbourhoodId: number | null) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursor = useRef<PostFeedCursor | null>(null);
  const controller = useRef<AbortController | null>(null);
  const version = useRef(0);
  const busy = useRef(false);
  const failedReset = useRef(true);

  const load = useCallback(
    async (reset: boolean) => {
      if (neighbourhoodId === null || (!reset && (busy.current || !cursor.current))) return;
      const current = ++version.current;
      controller.current?.abort();
      const next = new AbortController();
      controller.current = next;
      busy.current = true;
      failedReset.current = reset;
      setLoading(true);
      setError(null);
      try {
        const page = await listPosts(supabase, {
          neighbourhoodId,
          cursor: reset ? null : cursor.current,
          signal: next.signal,
        });
        if (version.current !== current) return;
        setPosts((previous) =>
          reset
            ? page.posts
            : [...new Map([...previous, ...page.posts].map((post) => [post.id, post])).values()],
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
    [neighbourhoodId],
  );

  useFocusEffect(
    useCallback(() => {
      setPosts([]);
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
    posts,
    error,
    loading,
    hasMore,
    refresh: () => void load(true),
    loadMore: () => void load(false),
    retry: () => void load(failedReset.current),
  };
}
