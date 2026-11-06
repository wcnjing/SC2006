import {
  ACCESSIBILITY_NEEDS,
  createActivity,
  updateActivity,
  cancelActivity,
  type Activity,
  type ActivityInput,
} from '@communitylink/shared';
import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { activityFormInput, initialActivityForm, type ActivityFormValues } from './activityForm';

const fields: {
  key: Exclude<keyof ActivityFormValues, 'is_outdoor'>;
  label: string;
  placeholder?: string;
}[] = [
  { key: 'title', label: 'Activity name *' },
  { key: 'description', label: 'Description *' },
  { key: 'category', label: 'Category / type *' },
  { key: 'location_name', label: 'Location / venue *' },
  { key: 'address', label: 'Address' },
  { key: 'starts_at', label: 'Start date/time * (Singapore)', placeholder: 'YYYY-MM-DD HH:mm' },
  { key: 'ends_at', label: 'End date/time * (Singapore)', placeholder: 'YYYY-MM-DD HH:mm' },
  { key: 'capacity', label: 'Capacity (blank for unlimited)' },
  { key: 'cost', label: 'Cost (SGD)' },
  { key: 'lat', label: 'Latitude (optional)' },
  { key: 'lng', label: 'Longitude (optional)' },
  { key: 'tags', label: 'Tags (comma-separated)' },
  { key: 'accessibility', label: 'Accessibility features (comma-separated)' },
];

export function ActivityEditor({ activity }: { activity?: Activity }) {
  const [values, setValues] = useState(() => initialActivityForm(activity));
  const [review, setReview] = useState<ActivityInput | null>(null);
  const [reason, setReason] = useState('');
  const [cancelReview, setCancelReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<Activity | null>(null);
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const editable =
    !activity || (activity.status === 'scheduled' && Date.parse(activity.starts_at) > now);
  const cancellable = activity?.status === 'scheduled' && Date.parse(activity.starts_at) > now;
  const cancellationError = 'This activity has already started and cannot be cancelled.';

  async function submit(cancel = false) {
    if (inFlight.current || (!cancel && !review)) return;
    if (cancel && activity && Date.parse(activity.starts_at) <= Date.now()) {
      setError(cancellationError);
      setCancelReview(false);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const result =
        cancel && activity
          ? await cancelActivity(supabase, activity.id, reason, activity.updated_at)
          : activity
            ? await updateActivity(supabase, activity.id, review!, activity.updated_at)
            : await createActivity(supabase, review!);
      setSaved(result);
      setMessage(
        cancel
          ? 'Activity cancelled. Existing bookmarks and registrations are preserved.'
          : activity
            ? 'Activity updated.'
            : 'Activity created. It is now available in Upcoming activities.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save activity. Please try again.');
      setReview(null);
      setCancelReview(false);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  if (saved)
    return (
      <View style={{ gap: 12 }}>
        <Text accessibilityLiveRegion="polite">{message}</Text>
        <Link href={{ pathname: '/activities/[id]', params: { id: saved.id } }}>
          View activity details
        </Link>
        <Link href="/activities/manage">My activities</Link>
        <Link href="/">Upcoming activities</Link>
      </View>
    );

  return (
    <View style={{ gap: 12 }}>
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      {editable ? (
        <>
          <Text>Required fields are marked *. Date/time uses Singapore time.</Text>
          {fields.map(({ key, label, placeholder }) => (
            <View key={key} style={{ gap: 4 }}>
              <Text>{label}</Text>
              <TextInput
                accessibilityLabel={label}
                placeholder={placeholder}
                value={values[key]}
                editable={!busy && !review && !cancelReview}
                multiline={key === 'description'}
                style={styles.input}
                onChangeText={(value) => {
                  setValues((current) => ({ ...current, [key]: value }));
                  setReview(null);
                }}
              />
            </View>
          ))}
          <Text>Accessibility examples: {ACCESSIBILITY_NEEDS.join(', ')}</Text>
          <Text>Coordinates enable distance filtering; leave both blank if unknown.</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[false, true].map((is_outdoor) => (
              <Button
                key={String(is_outdoor)}
                title={is_outdoor ? 'Outdoor' : 'Indoor'}
                color={values.is_outdoor === is_outdoor ? '#075ca8' : '#555'}
                disabled={busy || !!review || cancelReview}
                accessibilityLabel={`${is_outdoor ? 'Outdoor' : 'Indoor'}${values.is_outdoor === is_outdoor ? ', selected' : ''}`}
                onPress={() => setValues((current) => ({ ...current, is_outdoor }))}
              />
            ))}
          </View>
          {!review ? (
            <Button
              title="Review activity"
              disabled={busy || cancelReview}
              onPress={() => {
                try {
                  setReview(activityFormInput(values));
                  setError('');
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Check activity details.');
                }
              }}
            />
          ) : (
            <View style={{ gap: 8 }}>
              <Text accessibilityRole="header">Confirm {activity ? 'update' : 'creation'}</Text>
              <Text>
                {review.title} · {review.location_name}
              </Text>
              <Text>
                {values.starts_at} – {values.ends_at} (Singapore)
              </Text>
              <Text>
                Capacity: {review.capacity ?? 'Unlimited'} · Cost: SGD{' '}
                {(review.cost_cents / 100).toFixed(2)}
              </Text>
              <Button
                title={activity ? 'Confirm update' : 'Confirm create'}
                disabled={busy}
                onPress={() => {
                  void submit();
                }}
              />
              <Button title="Back to editing" disabled={busy} onPress={() => setReview(null)} />
            </View>
          )}
        </>
      ) : (
        <Text>Only scheduled activities that have not started can be edited.</Text>
      )}
      {activity?.status === 'scheduled' && !cancellable && <Text>{cancellationError}</Text>}
      {cancellable && (
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header">Cancel activity</Text>
          <Text>This removes the activity from upcoming results. A reason is required.</Text>
          <TextInput
            accessibilityLabel="Cancellation reason"
            multiline
            value={reason}
            editable={!busy && !cancelReview}
            style={styles.input}
            onChangeText={setReason}
          />
          {!cancelReview ? (
            <Button
              title="Review cancellation"
              disabled={busy || (editable && !!review)}
              onPress={() => {
                if (Date.parse(activity.starts_at) <= Date.now()) {
                  setError(cancellationError);
                  return;
                }
                if (!reason.trim()) {
                  setError('A cancellation reason is required.');
                  return;
                }
                setError('');
                setReview(null);
                setCancelReview(true);
              }}
            />
          ) : (
            <>
              <Text>
                Cancel {activity.title}? Reason: {reason.trim()}
              </Text>
              <Button
                title="Confirm cancellation"
                disabled={busy}
                onPress={() => {
                  void submit(true);
                }}
              />
              <Button
                title="Keep activity"
                disabled={busy}
                onPress={() => setCancelReview(false)}
              />
            </>
          )}
        </View>
      )}
      {busy && <Text accessibilityLiveRegion="polite">Saving activity…</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: '#777', borderRadius: 6, padding: 10 },
});
