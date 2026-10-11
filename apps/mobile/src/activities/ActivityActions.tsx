import {
  getMyActivityParticipation,
  activityJoinUnavailableReason,
  saveActivity,
  joinActivity,
  hasRole,
  leaveActivity,
  unsaveActivity,
  type Activity,
} from '@communitylink/shared';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { ActivityButton as Button, ActivityIconButton, activityStyles } from './activityTheme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { useActivityQuery } from './useActivityQuery';

type ActionProps = { activity: Activity; onRefresh?: () => void; children?: ReactNode };
export function ActivityActions({ activity, onRefresh, children }: ActionProps) {
  const { profile, session } = useAuth();
  if (!session || !profile || session.user.id !== profile.id || !hasRole(profile, 'resident'))
    return (
      <View style={{ gap: 12 }}>
        <View style={{ alignItems: 'flex-end' }}>
          {onRefresh && (
            <ActivityIconButton label="Refresh activity" icon="refresh" onPress={onRefresh} />
          )}
        </View>
        {children}
        <Text>Save and join actions require an active resident account.</Text>
      </View>
    );
  // Discard pending UI state when switching residents or activities.
  return (
    <ResidentActions key={`${profile.id}:${activity.id}`} activity={activity} onRefresh={onRefresh}>
      {children}
    </ResidentActions>
  );
}

function ResidentActions({ activity, onRefresh, children }: ActionProps) {
  const load = useCallback(() => getMyActivityParticipation(supabase, activity.id), [activity.id]);
  const { data, loading, error, retry } = useActivityQuery(load);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [leavePrompt, setLeavePrompt] = useState<'idle' | 'confirm'>('idle');
  const inFlight = useRef(false);
  const mounted = useRef(true);
  // A pending request must not update another resident's or activity's screen.
  // The keyed component above unmounts on either change.
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);

  const update = async (kind: 'save' | 'unsave' | 'join' | 'leave') => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLeavePrompt('idle');
    setBusy(true);
    setMessage(null);
    setActionError(null);
    try {
      const action = {
        save: saveActivity,
        unsave: unsaveActivity,
        join: joinActivity,
        leave: leaveActivity,
      }[kind];
      await action(supabase, activity.id);
      if (mounted.current) {
        setMessage(
          {
            save: 'Activity saved.',
            unsave: 'Activity unsaved.',
            join: 'Registration confirmed.',
            leave: 'Registration cancelled.',
          }[kind],
        );
        retry();
      }
    } catch (err) {
      if (mounted.current) {
        setActionError(
          err instanceof Error ? err.message : 'Unable to update activity. Please try again.',
        );
        retry();
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const saved = data?.saved ?? false;
  const joined = data?.joined ?? false;
  const unavailable = data
    ? activityJoinUnavailableReason(data.activity, data.joinedCount, now)
    : null;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 4 }}>
        <ActivityIconButton
          label={saved ? 'Unsave Activity' : 'Save Activity'}
          icon={saved ? 'saved' : 'bookmark'}
          selected={loading || error ? undefined : saved}
          disabled={loading || !!error || busy}
          busy={busy}
          onPress={() => {
            void update(saved ? 'unsave' : 'save');
          }}
        />
        <ActivityIconButton
          label="Refresh activity"
          icon="refresh"
          disabled={busy || loading}
          busy={loading}
          onPress={onRefresh ?? retry}
        />
      </View>
      {children}
      {loading ? (
        <ActivityIndicator accessibilityLabel="Loading your activity state" />
      ) : error ? (
        <>
          <Text accessibilityRole="alert">{error}</Text>
          <Button title="Retry activity state" onPress={retry} disabled={busy} />
        </>
      ) : joined ? (
        <Text style={activityStyles.body}>You’re registered for this activity.</Text>
      ) : null}
      <Button
        primary
        title={joined ? 'Leave Activity' : 'Join Activity'}
        disabled={loading || !!error || busy || (!joined && !!unavailable)}
        onPress={() => {
          if (inFlight.current) return;
          if (joined) setLeavePrompt('confirm');
          else void update('join');
        }}
      />
      {joined && leavePrompt === 'confirm' && (
        <View style={activityStyles.card}>
          <Text accessibilityRole="header" style={activityStyles.heading}>
            Leave this activity?
          </Text>
          <Text style={activityStyles.body}>
            This cancels your registration. Your saved activity will remain unchanged.
          </Text>
          <View style={activityStyles.row}>
            <Button
              title="Keep registration"
              disabled={busy}
              onPress={() => setLeavePrompt('idle')}
            />
            <Button
              title="Confirm Leave"
              disabled={loading || !!error || busy}
              onPress={() => {
                void update('leave');
              }}
            />
          </View>
        </View>
      )}
      {!joined && unavailable && <Text>{unavailable}</Text>}
      {message && <Text accessibilityLiveRegion="polite">{message}</Text>}
      {actionError && <Text accessibilityRole="alert">{actionError}</Text>}
    </View>
  );
}
