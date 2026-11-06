import type { Message, MessageCursor } from '@communitylink/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { listDirectMessages } from '../services/community';
import { communityText } from './communityUi';

export function useDirectMessages(userId: string, enabled: boolean) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursor = useRef<MessageCursor | null>(null);
  const version = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const failedReset = useRef(true);
  const load = useCallback(
    async (reset: boolean) => {
      if (!enabled || (!reset && (busy.current || !cursor.current))) return;
      const current = ++version.current;
      controller.current?.abort();
      const next = new AbortController();
      controller.current = next;
      busy.current = true;
      failedReset.current = reset;
      setLoading(true);
      setError(null);
      try {
        const page = await listDirectMessages(supabase, userId, {
          cursor: reset ? null : cursor.current,
          signal: next.signal,
        });
        if (current !== version.current) return;
        setMessages((previous) =>
          reset
            ? page.messages
            : [...new Map([...page.messages, ...previous].map((row) => [row.id, row])).values()],
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
    [userId, enabled],
  );
  useFocusEffect(
    useCallback(() => {
      setMessages([]);
      cursor.current = null;
      setHasMore(false);
      setError(null);
      setLoading(false);
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
  return {
    messages,
    loading,
    error,
    hasMore,
    refresh: () => void load(true),
    loadMore: () => void load(false),
    retry: () => void load(failedReset.current),
    clear: () => {
      cancelRead();
      setMessages([]);
      cursor.current = null;
      setHasMore(false);
    },
    upsert: (message: Message) => {
      cancelRead();
      setMessages((previous) =>
        [...new Map([...previous, message].map((row) => [row.id, row])).values()].sort(
          (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
        ),
      );
    },
  };
}
