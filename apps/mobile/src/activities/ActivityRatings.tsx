import {
  activityRatingUnavailableReason,
  averageActivityRating,
  getMyActivityRatingEligibility,
  hasRole,
  listActivityRatings,
  submitActivityRating,
  validateActivityRating,
  type ActivityRating,
} from '@communitylink/shared';
import { Link } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, Text, TextInput, View } from 'react-native';
import { activityStyles } from './activityTheme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { useActivityQuery } from './useActivityQuery';

export function ActivityRatings({
  activityId,
  combinedRefresh = false,
}: {
  activityId: string;
  combinedRefresh?: boolean;
}) {
  const { session, profile } = useAuth();
  if (!session) return <Text>Sign in to view activity ratings and reviews.</Text>;
  return (
    <RatingsPanel
      key={`${session.user.id}:${activityId}`}
      activityId={activityId}
      combinedRefresh={combinedRefresh}
      resident={!!profile && profile.id === session.user.id && hasRole(profile, 'resident')}
    />
  );
}

function RatingsPanel({
  activityId,
  resident,
  combinedRefresh,
}: {
  activityId: string;
  resident: boolean;
  combinedRefresh: boolean;
}) {
  const load = useCallback(() => listActivityRatings(supabase, activityId), [activityId]);
  const { data, loading, error, retry } = useActivityQuery(load);
  const average = data ? averageActivityRating(data) : null;
  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={activityStyles.heading}>
        Ratings and reviews
      </Text>
      {loading ? (
        <ActivityIndicator accessibilityLabel="Loading activity reviews" />
      ) : error ? (
        <>
          <Text accessibilityRole="alert">{error}</Text>
          <Button title="Retry reviews" onPress={retry} />
        </>
      ) : (
        <>
          <Text accessibilityLiveRegion="polite">
            {average === null
              ? 'No ratings yet.'
              : `Average rating: ${average.toFixed(1)} / 5 (${data!.length} ratings)`}
          </Text>
          {(data ?? []).map((row) => (
            <View key={row.user_id} style={{ gap: 4, paddingVertical: 8 }}>
              <Text
                style={{ color: '#b57500', fontSize: 22 }}
                accessibilityLabel={`${row.rating} out of 5 stars`}
              >
                {'★'.repeat(row.rating)}
                {'☆'.repeat(5 - row.rating)}
              </Text>
              <Text>{new Date(row.created_at).toLocaleString()}</Text>
              {row.comment ? <Text>{row.comment}</Text> : <Text>No written feedback.</Text>}
            </View>
          ))}
          {!combinedRefresh && <Button title="Refresh reviews" onPress={retry} />}
        </>
      )}
      {resident ? (
        <ResidentRatingForm activityId={activityId} onSubmitted={retry} />
      ) : (
        <Text>Submitting a rating requires an active resident account.</Text>
      )}
    </View>
  );
}

function ResidentRatingForm({
  activityId,
  onSubmitted,
}: {
  activityId: string;
  onSubmitted: () => void;
}) {
  const load = useCallback(
    () => getMyActivityRatingEligibility(supabase, activityId),
    [activityId],
  );
  const { data, loading, error, retry } = useActivityQuery(load);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<ActivityRating | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);
  const ownRating = submitted ?? data?.rating;
  const unavailable = data ? activityRatingUnavailableReason(data, now) : null;
  async function submit() {
    if (inFlight.current || ownRating || loading || error || unavailable) return;
    try {
      validateActivityRating({ rating: stars, comment });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Check your rating and feedback.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setActionError(null);
    try {
      const row = await submitActivityRating(supabase, activityId, { rating: stars, comment });
      if (mounted.current) {
        setSubmitted(row);
        onSubmitted();
      }
    } catch (err) {
      if (mounted.current) {
        setActionError(
          err instanceof Error ? err.message : 'Unable to submit your rating. Please try again.',
        );
        retry(); // Refresh eligibility if a concurrent rating/status change caused rejection.
        onSubmitted();
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <View style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={activityStyles.heading}>
        Your rating
      </Text>
      {submitted && (
        <Text accessibilityLiveRegion="polite">Thank you. Your rating was submitted.</Text>
      )}
      {actionError && <Text accessibilityRole="alert">{actionError}</Text>}
      {loading ? (
        <ActivityIndicator accessibilityLabel="Checking rating eligibility" />
      ) : error ? (
        <>
          <Text accessibilityRole="alert">{error}</Text>
          <Button title="Retry rating eligibility" onPress={retry} disabled={busy} />
        </>
      ) : ownRating ? (
        <>
          <Text>You have already rated this activity: {ownRating.rating} / 5 stars.</Text>
          {!!ownRating.comment && <Text>{ownRating.comment}</Text>}
        </>
      ) : unavailable ? (
        <Text>{unavailable}</Text>
      ) : (
        <>
          <Text>Choose 1–5 stars. Written feedback is optional (up to 1,000 characters).</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Button
                key={value}
                title={`${value} ★`}
                accessibilityLabel={`${value} ${value === 1 ? 'star' : 'stars'}${stars === value ? ', selected' : ''}`}
                color={stars === value ? '#b57500' : '#555'}
                disabled={busy}
                onPress={() => setStars(value)}
              />
            ))}
          </View>
          <TextInput
            accessibilityLabel="Optional written feedback"
            multiline
            value={comment}
            editable={!busy}
            onChangeText={setComment}
            style={{ borderWidth: 1, borderColor: '#777', borderRadius: 6, padding: 10 }}
          />
          <Button
            color="#e53935"
            title={busy ? 'Submitting rating…' : 'Submit rating'}
            disabled={busy}
            onPress={() => {
              void submit();
            }}
          />
        </>
      )}
    </View>
  );
}

export function ActivityRatingLinks() {
  const { profile, session } = useAuth();
  if (!session || !profile || profile.id !== session.user.id || !hasRole(profile, 'resident'))
    return null;
  return <Link href="/activities/reviews">Joined activities to review</Link>;
}
