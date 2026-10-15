import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';

import {
  AppHeader,
  AppText,
  Banner,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
} from '@/components/ui';
import { findNeighbourhood } from '@/config/catalog';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { openActivity } from '@/features/activities/ActivityCard';
import { getDiscoverySession } from '@/features/activities/discoverySession';
import {
  SwipeButtons,
  SwipeDeck,
  type SwipeDeckHandle,
  type SwipeDecision,
} from '@/features/activities/SwipeDeck';
import { distanceKm, hasCoordinates } from '@/lib/geo';
import { errorMessageKey, ServiceError } from '@/services';
import { colors, spacing } from '@/theme/tokens';
import type { Activity } from '@/types/models';

type Status = { tone: 'success' | 'info' | 'error'; text: string } | null;

/** Load more cards when this few are left, so the deck never visibly runs dry. */
const REFILL_AT = 3;

/**
 * Discover (mockup 4.C right; Dialog Map: entry / loadActivityQueue(),
 * do / displayOneActivityCard()). FR 3.2.1–3.2.6, UC #5-04 BrowseActivity.
 *   right / ♥ Save → recorded as interested (bookmark), shows in My activities → Saved
 *   left  / ✕ Skip → dismissed; never shown again this session (FR 3.2.5)
 *   tap card / View details → Activity details (Dialog Map: tapCard)
 */
export default function DiscoverScreen() {
  const { t } = useSettings();
  const { session } = useAuth();
  const hood = findNeighbourhood(session?.profile?.neighbourhoodId);

  const [queue, setQueue] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [decided, setDecided] = useState(0);
  const token = session?.token ?? '';

  const load = useCallback(
    async (initial: boolean) => {
      if (!token) return;
      if (initial) setLoading(true);
      setError(null);
      try {
        const discovery = await getDiscoverySession(token);
        setQueue(await discovery.load({ limit: 20 }));
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  // Load on first view, and reload when Discover comes back into view: anything
  // saved or joined on the details screen in the meantime drops out of the deck.
  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const announce = (s: Status) => {
    setStatus(s);
    if (s) AccessibilityInfo.announceForAccessibility(s.text);
  };

  const onDecide = async (activity: Activity, decision: SwipeDecision) => {
    // Show the next card straight away; put this one back if saving fails.
    setQueue((q) => q.filter((a) => a.id !== activity.id));
    setDecided((n) => n + 1);
    setBusy(true);
    try {
      const discovery = await getDiscoverySession(token);
      await discovery.act(activity.id, decision);
      announce({
        tone: decision === 'like' ? 'success' : 'info',
        text: t(decision === 'like' ? 'discover.savedToast' : 'discover.skippedToast', {
          title: activity.title,
        }),
      });
      if (queue.length - 1 <= REFILL_AT) {
        const more = await discovery.load({ limit: 20 });
        setQueue((q) => [...q, ...more.filter((m) => !q.some((a) => a.id === m.id))]);
      }
    } catch (e) {
      setQueue((q) => [activity, ...q.filter((a) => a.id !== activity.id)]);
      setDecided((n) => n - 1);
      announce({
        tone: 'error',
        text:
          e instanceof ServiceError && e.code === 'BUSY'
            ? t('error.busy')
            : t('discover.actionError'),
      });
    } finally {
      setBusy(false);
    }
  };

  // Web keyboard support: ← skip, → save, Enter opens details (WCAG 2.1.1 Keyboard).
  const deck = useRef<SwipeDeckHandle>(null);
  const deckRef = useRef({ queue, busy });
  useEffect(() => {
    deckRef.current = { queue, busy };
  });
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web' || typeof document === 'undefined') return;
      const onKey = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
        const { queue: q, busy: b } = deckRef.current;
        const top = q[0];
        if (!top || b) return;
        if (e.key === 'ArrowRight') deck.current?.decide('like');
        else if (e.key === 'ArrowLeft') deck.current?.decide('skip');
        else if (e.key === 'Enter' && target === document.body) openActivity(top.id);
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, []),
  );

  const distanceFor = (a: Activity) => (hood && hasCoordinates(a) ? distanceKm(hood, a) : null);
  const total = decided + queue.length;

  return (
    <Screen
      inTabs
      header={<AppHeader />}
      contentStyle={styles.content}
      footer={
        queue.length > 0 &&
        !loading &&
        !error && (
          // The confirmation sits right above the buttons, so it is seen without scrolling.
          <View style={styles.footer}>
            {status && <Banner tone={status.tone}>{status.text}</Banner>}
            <SwipeButtons
              title={queue[0].title}
              busy={busy}
              onDecide={(d) => deck.current?.decide(d)}
            />
          </View>
        )
      }
    >
      <View style={styles.titleRow}>
        <AppText variant="h1" heading style={{ flex: 1 }}>
          {t('discover.title')}
        </AppText>
        {queue.length > 0 && (
          <AppText variant="label" color={colors.textMuted}>
            {t('discover.progress', { current: Math.min(decided + 1, total), total })}
          </AppText>
        )}
      </View>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={t(errorMessageKey(error))} onRetry={() => load(true)} />
      ) : queue.length === 0 ? (
        <EmptyState
          icon="checkmark-done-circle-outline"
          title={t('discover.endTitle')}
          body={t('discover.endBody')}
          actionLabel={t('discover.goMyActivities')}
          onAction={() => router.push({ pathname: '/my-activities', params: { tab: 'saved' } })}
        />
      ) : (
        <>
          <AppText color={colors.textMuted}>
            {t('discover.subtitle')}
            {Platform.OS === 'web' ? ` ${t('discover.keyboardHint')}` : ''}
          </AppText>
          <SwipeDeck
            ref={deck}
            cards={queue}
            distanceFor={distanceFor}
            onDecide={onDecide}
            onOpen={(a) => openActivity(a.id)}
            busy={busy}
          />
        </>
      )}

      {status && queue.length === 0 && <Banner tone={status.tone}>{status.text}</Banner>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: spacing.md },
  footer: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
