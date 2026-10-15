import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  View,
  type AccessibilityActionEvent,
} from 'react-native';

import { AppText, Button, IconButton } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { colors, radii, shadow, spacing } from '@/theme/tokens';
import type { Activity } from '@/types/models';

import { ActivityImage } from './ActivityImage';
import { ActivityTags } from './ActivityTags';
import { formatDistance, formatWhen } from './format';
import { MetaLine } from './MetaLine';

export type SwipeDecision = 'like' | 'skip';
export type SwipeDeckHandle = { decide: (decision: SwipeDecision) => void };

type Props = {
  /** Queue; the first item is the visible card. */
  cards: Activity[];
  distanceFor: (a: Activity) => number | null;
  onDecide: (activity: Activity, decision: SwipeDecision) => void;
  onOpen: (activity: Activity) => void;
  /** True while the previous decision is being saved (P2: disable input while pending). */
  busy?: boolean;
  /** Lets <SwipeButtons> and the keyboard trigger the same animated decision as a swipe. */
  ref?: Ref<SwipeDeckHandle>;
};

/** How far (px) or how fast a drag must go to count as a swipe. */
const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 0.6;
/** Kept short so the Skip / Save buttons stay on screen on a 390 × 844 phone without scrolling. */
const DECK_IMAGE_HEIGHT = 170;

/**
 * FR 3.2 swipe interface (UC #5-04 BrowseActivity), one card at a time.
 * Every way of deciding goes through `decide()`, so they behave identically
 * (UC alt. flow "Button Interactions: processed identically to a swipe"):
 *   - drag right / left (touch or mouse)
 *   - the ♥ Save / ✕ Skip buttons (<SwipeButtons>, FR 3.2.6, always visible)
 *   - screen-reader actions on the card ("Save", "Skip", "View details")
 *   - ← / → keys on web (wired up by the Discover screen)
 * With Reduce motion on, cards change without the fly-out animation.
 */
export function SwipeDeck({ cards, distanceFor, onDecide, onOpen, busy, ref }: Props) {
  const { t, language, reduceMotion } = useSettings();
  const { width } = useWindowDimensions();
  // Created once. useState (not useRef) because these are read while rendering.
  const [position] = useState(() => new Animated.ValueXY());
  const animating = useRef(false);
  const current = cards[0];
  const next = cards[1];

  // Keep the latest values for the PanResponder, which is created once.
  const latest = useRef({ current, busy, decide: (_d: SwipeDecision) => {} });

  const decide = (decision: SwipeDecision) => {
    if (!current || busy || animating.current) return;
    const done = () => {
      animating.current = false;
      position.setValue({ x: 0, y: 0 });
      onDecide(current, decision);
    };
    if (reduceMotion) return done();
    animating.current = true;
    Animated.timing(position, {
      toValue: { x: (decision === 'like' ? 1 : -1) * width * 1.2, y: 0 },
      duration: 220,
      useNativeDriver: false,
    }).start(done);
  };
  useEffect(() => {
    latest.current = { current, busy, decide };
  });
  useImperativeHandle(ref, () => ({ decide: (d) => latest.current.decide(d) }), []);

  // The callbacks below read `latest` only while a gesture is running, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      // Only claim clearly horizontal drags, so taps on "View details" and vertical scrolling still work.
      onMoveShouldSetPanResponder: (_e, g) =>
        !latest.current.busy && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => position.setValue({ x: g.dx, y: g.dy * 0.15 }),
      onPanResponderRelease: (_e, g) => {
        if (g.dx > SWIPE_DISTANCE || g.vx > SWIPE_VELOCITY) latest.current.decide('like');
        else if (g.dx < -SWIPE_DISTANCE || g.vx < -SWIPE_VELOCITY) latest.current.decide('skip');
        else
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 6,
            useNativeDriver: false,
          }).start();
      },
      onPanResponderTerminate: () =>
        Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start(),
    }),
  );

  if (!current) return null;

  const rotate = position.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-12deg', '0deg', '12deg'],
    extrapolate: 'clamp',
  });
  const saveHint = position.x.interpolate({
    inputRange: [0, SWIPE_DISTANCE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const skipHint = position.x.interpolate({
    inputRange: [-SWIPE_DISTANCE, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const when = formatWhen(current, language);
  const distance = formatDistance(t, distanceFor(current));
  const where = [current.location_name, distance].filter(Boolean).join(' · ');

  const onA11yAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'save') decide('like');
    else if (e.nativeEvent.actionName === 'skip') decide('skip');
    else if (e.nativeEvent.actionName === 'activate') onOpen(current);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.stack}>
        {/* Next card peeks out underneath, so the user can see there is more. */}
        {next && (
          <View style={[styles.card, styles.under]} importantForAccessibility="no-hide-descendants">
            <ActivityImage category={next.category} height={DECK_IMAGE_HEIGHT} rounded={false} />
          </View>
        )}
        <Animated.View
          key={current.id}
          {...pan.panHandlers}
          style={[
            styles.card,
            { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] },
          ]}
          accessible
          accessibilityLabel={t('discover.cardA11y', {
            title: current.title,
            when: when.full,
            where,
          })}
          accessibilityActions={[
            { name: 'save', label: t('discover.save') },
            { name: 'skip', label: t('discover.skip') },
            { name: 'activate', label: t('discover.details') },
          ]}
          onAccessibilityAction={onA11yAction}
        >
          <View>
            <ActivityImage category={current.category} height={DECK_IMAGE_HEIGHT} rounded={false} />
            <Animated.View style={[styles.stamp, styles.stampSave, { opacity: saveHint }]}>
              <AppText variant="h2" color={colors.success}>
                {t('discover.swipeHintSave')}
              </AppText>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.stampSkip, { opacity: skipHint }]}>
              <AppText variant="h2" color={colors.primary}>
                {t('discover.swipeHintSkip')}
              </AppText>
            </Animated.View>
          </View>
          <View style={styles.body}>
            <ActivityTags activity={current} />
            <AppText variant="h2" numberOfLines={2}>
              {current.title}
            </AppText>
            <MetaLine icon="calendar-outline" text={when.full} strong />
            <MetaLine icon="location-outline" text={where} />
            <AppText color={colors.textMuted} numberOfLines={2}>
              {current.description}
            </AppText>
            <Button
              label={t('discover.details')}
              accessibilityLabel={`${t('discover.details')}: ${current.title}`}
              variant="ghost"
              size="sm"
              icon="information-circle-outline"
              fullWidth={false}
              style={styles.details}
              onPress={() => onOpen(current)}
            />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

/**
 * The ✕ Skip / ♥ Save buttons (FR 3.2.6). Rendered in the screen's sticky
 * footer so they are always on screen, whatever the card height or text size.
 */
export function SwipeButtons({
  title,
  busy,
  onDecide,
}: {
  title: string;
  busy?: boolean;
  onDecide: (decision: SwipeDecision) => void;
}) {
  const { t } = useSettings();
  return (
    <View style={styles.buttons}>
      <View style={styles.buttonCol}>
        <IconButton
          icon="close"
          label={t('discover.skipA11y', { title })}
          filled={colors.primary}
          color={colors.onPrimary}
          size={28}
          disabled={busy}
          onPress={() => onDecide('skip')}
          style={busy && styles.disabled}
        />
        <AppText variant="label" importantForAccessibility="no">
          {t('discover.skip')}
        </AppText>
      </View>
      <View style={styles.buttonCol}>
        <IconButton
          icon="heart"
          label={t('discover.saveA11y', { title })}
          filled={colors.success}
          color={colors.onPrimary}
          size={28}
          disabled={busy}
          onPress={() => onDecide('like')}
          style={busy && styles.disabled}
        />
        <AppText variant="label" importantForAccessibility="no">
          {t('discover.save')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  stack: { paddingBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.divider,
    ...shadow.card,
  },
  under: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    bottom: 0,
    opacity: 0.6,
  },
  body: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs + 2 },
  details: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  stamp: {
    position: 'absolute',
    top: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 3,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  stampSave: { left: spacing.lg, borderColor: colors.success, transform: [{ rotate: '-10deg' }] },
  stampSkip: { right: spacing.lg, borderColor: colors.primary, transform: [{ rotate: '10deg' }] },
  buttons: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xxxl * 1.5 },
  buttonCol: { alignItems: 'center', gap: spacing.xs },
  disabled: { opacity: 0.5 },
});
