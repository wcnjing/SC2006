import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  Screen,
  ScreenHeader,
  Section,
  Tag,
  toneForCategory,
} from '@/components/ui';
import { findNeighbourhood } from '@/config/catalog';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { ActivityImage } from '@/features/activities/ActivityImage';
import { ActivityTags } from '@/features/activities/ActivityTags';
import {
  categoryLabel,
  formatDistance,
  formatPrice,
  formatWhen,
  hasEnded,
  hasStarted,
} from '@/features/activities/format';
import { MetaLine } from '@/features/activities/MetaLine';
import { Stars } from '@/features/activities/Stars';
import { distanceKm, hasCoordinates } from '@/lib/geo';
import { useAsync } from '@/lib/useAsync';
import { activityService, errorMessageKey, ServiceError } from '@/services';
import { colors, radii, spacing } from '@/theme/tokens';

/** Reviews shown inline; the rest are summarised in the average. */
const REVIEWS_SHOWN = 3;

type Busy = 'save' | 'join' | 'leave' | null;

/**
 * Activity details (mockup 4.B middle; Dialog Map: entry / fetchActivityDetails(),
 * do / displayDetailsAndRatings()).
 *  - FR 3.1.2–3.1.7: name, description, date/time, location, organiser, indoor/outdoor
 *  - FR 9.1.5: average rating and reviews
 *  - UC SaveActivity: Save / Unsave
 *  - UC JoinActivity: Join (greyed out when full), Cancel my spot with confirmation
 *  - UC ViewActivity exception: cancelled or deleted → "no longer available" + back
 */
export default function ActivityDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language } = useSettings();
  const { session } = useAuth();
  const hood = findNeighbourhood(session?.profile?.neighbourhoodId);
  const me = session?.account.accountId;

  const [busy, setBusy] = useState<Busy>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const page = useAsync(async () => {
    const activity = await activityService.getActivity(id);
    if (!activity) return null;
    const [participation, ratings, organiser] = await Promise.all([
      activityService.getParticipation(id),
      activityService.listRatings(id),
      activityService.getOrganiserName(activity),
    ]);
    return { activity, participation, ratings, organiser };
  });

  const header = (
    <ScreenHeader
      title={t('detail.title')}
      right={
        page.data && (
          <IconButton
            icon="flag-outline"
            label={t('detail.report')}
            onPress={() =>
              router.push({
                pathname: '/activity/[id]/report',
                params: { id: page.data!.activity.id },
              })
            }
          />
        )
      }
    />
  );

  if (page.loading && !page.data) {
    return (
      <Screen header={header}>
        <LoadingState />
      </Screen>
    );
  }
  if (page.error && !page.data) {
    const notFound = page.error instanceof ServiceError && page.error.code === 'NOT_FOUND';
    return (
      <Screen header={header}>
        {notFound ? (
          <Unavailable />
        ) : (
          <ErrorState message={t(errorMessageKey(page.error))} onRetry={page.reload} />
        )}
      </Screen>
    );
  }
  if (!page.data || page.data.activity.status === 'cancelled') {
    return (
      <Screen header={<ScreenHeader title={t('detail.title')} />}>
        <Unavailable reason={page.data?.activity.cancelled_reason} />
      </Screen>
    );
  }

  const { activity, participation, ratings, organiser } = page.data;
  const when = formatWhen(activity, language);
  const km = hood && hasCoordinates(activity) ? distanceKm(hood, activity) : null;
  const distance = formatDistance(t, km);
  const average = ratings.length
    ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
    : null;
  const myRating = ratings.find((r) => r.user_id === me);
  const { saved, joined, joinedCount } = participation;
  const full = activity.capacity !== null && joinedCount >= activity.capacity;
  const started = hasStarted(activity);
  const canRate = joined && hasEnded(activity) && !myRating;

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<void>, doneText: string) => {
    setBusy(kind);
    setStatus(null);
    try {
      await action();
      setStatus({ tone: 'success', text: doneText });
      AccessibilityInfo.announceForAccessibility(doneText);
      await page.revalidate();
    } catch (e) {
      const text = t(errorMessageKey(e));
      setStatus({ tone: 'error', text });
      await page.revalidate();
    } finally {
      setBusy(null);
      setConfirmLeave(false);
    }
  };

  const toggleSave = () =>
    run(
      'save',
      () => (saved ? activityService.unsave(activity.id) : activityService.save(activity.id)),
      t(saved ? 'detail.unsavedToast' : 'detail.savedToast'),
    );
  const join = () =>
    run(
      'join',
      () => activityService.join(activity.id),
      t('detail.joinedToast', { title: activity.title }),
    );
  const leave = () => run('leave', () => activityService.leave(activity.id), t('detail.leftToast'));

  const saveButton = (
    <Button
      label={t(saved ? 'detail.saved' : 'detail.save')}
      accessibilityLabel={t(saved ? 'detail.unsaveA11y' : 'detail.saveA11y')}
      icon={saved ? 'bookmark' : 'bookmark-outline'}
      variant="outline"
      loading={busy === 'save'}
      disabled={!!busy}
      onPress={toggleSave}
      fullWidth={false}
    />
  );

  let primary;
  if (canRate) {
    primary = (
      <Button
        label={t('detail.rate')}
        icon="star-outline"
        onPress={() =>
          router.push({ pathname: '/activity/[id]/rate', params: { id: activity.id } })
        }
        style={styles.flex}
      />
    );
  } else if (joined && !started) {
    primary = (
      <Button
        label={t('detail.leave')}
        variant="danger"
        loading={busy === 'leave'}
        disabled={!!busy}
        onPress={() => setConfirmLeave(true)}
        style={styles.flex}
      />
    );
  } else if (!started) {
    primary = (
      <Button
        label={full ? t('activity.full') : t('detail.join')}
        icon={full ? 'lock-closed-outline' : 'add-circle-outline'}
        loading={busy === 'join'}
        disabled={!!busy || full}
        onPress={join}
        style={styles.flex}
      />
    );
  }

  return (
    <Screen
      header={header}
      contentStyle={styles.content}
      refreshing={page.refreshing}
      onRefresh={page.refresh}
      footer={
        <View style={styles.footer}>
          {saveButton}
          {primary}
        </View>
      }
    >
      <ActivityImage category={activity.category} height={220} />

      <ActivityTags activity={activity} />

      <View style={styles.titleBlock}>
        <View style={styles.titleRow}>
          <AppText variant="h1" heading style={styles.flex}>
            {activity.title}
          </AppText>
          <Tag
            label={categoryLabel(t, activity.category)}
            tone={toneForCategory(activity.category)}
          />
        </View>
        <View
          style={styles.ratingRow}
          accessible
          accessibilityLabel={
            average === null
              ? t('detail.noRatings')
              : t('detail.ratingA11y', { avg: average.toFixed(1), count: ratings.length })
          }
        >
          {average === null ? (
            <AppText variant="caption" color={colors.textMuted}>
              {t('detail.noRatings')}
            </AppText>
          ) : (
            <>
              <Stars value={average} />
              <AppText variant="label">
                {t('detail.ratingSummary', { avg: average.toFixed(1), count: ratings.length })}
              </AppText>
            </>
          )}
        </View>
      </View>

      {status && <Banner tone={status.tone}>{status.text}</Banner>}
      {joined && !started && <Banner tone="success">{t('detail.joined')}</Banner>}
      {!joined && full && !started && <Banner tone="warning">{t('detail.fullNote')}</Banner>}
      {!joined && started && !hasEnded(activity) && (
        <Banner tone="info">{t('detail.startedNote')}</Banner>
      )}

      <View style={styles.meta}>
        <MetaLine icon="calendar-outline" text={when.date} strong />
        <MetaLine icon="time-outline" text={when.time} strong />
        <MetaLine
          icon="location-outline"
          text={[activity.location_name, activity.address, distance].filter(Boolean).join('\n')}
          strong
          lines={4}
        />
      </View>

      <Section title={t('detail.organisedBy')}>
        <View style={styles.organiser}>
          <Avatar name={organiser ?? 'data.gov.sg'} size={44} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{organiser ?? t('detail.publicDataset')}</AppText>
            {activity.source === 'organiser' && organiser && (
              <View style={styles.verified}>
                <Tag label={t('detail.verifiedOrganiser')} tone="sports" icon="checkmark-circle" />
              </View>
            )}
          </View>
        </View>
      </Section>

      <Section title={t('detail.about')}>
        <AppText>{activity.description}</AppText>
      </Section>

      <Section title={t('detail.info')}>
        <View style={styles.infoGrid}>
          <InfoItem
            label={t('detail.capacity')}
            value={
              activity.capacity === null
                ? t('detail.capacityOpen', { joined: joinedCount })
                : t('detail.capacityValue', { joined: joinedCount, capacity: activity.capacity })
            }
          />
          <InfoItem label={t('detail.price')} value={formatPrice(t, activity.cost_cents)} />
          <InfoItem
            label={t('detail.setting')}
            value={t(activity.is_outdoor ? 'activity.outdoor' : 'activity.indoor')}
          />
        </View>
      </Section>

      <Section title={t('detail.reviews')}>
        {ratings.length === 0 ? (
          <AppText color={colors.textMuted}>{t('detail.reviewsEmpty')}</AppText>
        ) : (
          ratings
            .filter((r) => r.comment)
            .slice(0, REVIEWS_SHOWN)
            .map((r) => (
              <View key={`${r.user_id}-${r.created_at}`} style={styles.review}>
                <View style={styles.reviewHead}>
                  <Avatar name={r.reviewer_name ?? '?'} size={32} />
                  <AppText variant="label" style={styles.flex}>
                    {r.reviewer_name}
                  </AppText>
                  <Stars value={r.rating} size={14} />
                </View>
                <AppText color={colors.textMuted}>{r.comment}</AppText>
              </View>
            ))
        )}
      </Section>

      <ConfirmDialog
        visible={confirmLeave}
        title={t('detail.leaveTitle')}
        body={t('detail.leaveBody')}
        confirmLabel={t('detail.leaveConfirm')}
        cancelLabel={t('detail.leaveKeep')}
        destructive
        loading={busy === 'leave'}
        onConfirm={leave}
        onCancel={() => setConfirmLeave(false)}
      />
    </Screen>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="caption" color={colors.textMuted}>
        {label}
      </AppText>
      <AppText variant="label">{value}</AppText>
    </View>
  );
}

/** UC ViewActivity exception 1: activity deleted or cancelled → message, then back. */
function Unavailable({ reason }: { reason?: string | null }) {
  const t = useSettings().t;
  return (
    <EmptyState
      icon="calendar-clear-outline"
      title={t('detail.unavailableTitle')}
      body={reason ? `${t('detail.unavailableBody')} ${reason}` : t('detail.unavailableBody')}
      actionLabel={t('common.back')}
      onAction={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.sm },
  flex: { flex: 1 },
  titleBlock: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta: { gap: spacing.sm },
  organiser: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  verified: { marginTop: spacing.xs },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  infoItem: {
    flexGrow: 1,
    flexBasis: 140,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 2,
  },
  review: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  footer: { flexDirection: 'row', gap: spacing.md },
});
