import {
  ApiError,
  REPORT_REASON_MAX_LENGTH,
  REPORT_DETAILS_MAX_LENGTH,
  validateReportContent,
  type ContentReportTarget,
} from '@communitylink/shared';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { submitReport } from '../services/community';
import {
  CommunityButton,
  CommunityError,
  communityStyles as styles,
  communityText as text,
} from './communityUi';

/** Shared by posts/comments; P5 can replace these controls without changing the API. */
export function ReportForm({
  targetType,
  targetId,
  disabled = false,
}: {
  targetType: ContentReportTarget;
  targetId: string;
  disabled?: boolean;
}) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [requestId] = useState(() => randomUUID());
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const cannotWrite = disabled || profile?.status !== 'active';

  async function send() {
    if (busy.current || cannotWrite) return;
    const invalid = validateReportContent(reason, details);
    if (invalid) {
      setError(invalid);
      return;
    }
    busy.current = true;
    setSending(true);
    setError(null);
    try {
      await submitReport(supabase, { targetType, targetId, reason, details, requestId });
      setSent(true);
      setOpen(false);
      setReason('');
      setDetails('');
    } catch (error) {
      setError(error instanceof ApiError ? error.message : text.reportError);
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  if (sent)
    return (
      <View style={styles.section}>
        <Text style={styles.body} accessibilityLiveRegion="polite">
          {text.reportSent}
        </Text>
        <CommunityButton label={text.myReports} onPress={() => router.push('/reports')} secondary />
      </View>
    );

  return (
    <View style={styles.section}>
      {open ? (
        <>
          <Text style={styles.body}>{text.reportHint}</Text>
          <Text style={styles.label}>{text.reportReason}</Text>
          <TextInput
            accessibilityLabel={text.reportReason}
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            editable={!sending && !cannotWrite}
          />
          <Text style={styles.muted}>
            {Array.from(reason.trim()).length} / {REPORT_REASON_MAX_LENGTH}
          </Text>
          <Text style={styles.label}>{text.reportDetails}</Text>
          <TextInput
            accessibilityLabel={text.reportDetails}
            style={[styles.input, styles.multiline]}
            value={details}
            onChangeText={setDetails}
            multiline
            editable={!sending && !cannotWrite}
          />
          <Text style={styles.muted}>
            {Array.from(details.trim()).length} / {REPORT_DETAILS_MAX_LENGTH}
          </Text>
          {error && <CommunityError>{error}</CommunityError>}
          <CommunityButton
            label={sending ? text.submittingReport : text.submitReport}
            disabled={sending || cannotWrite}
            onPress={() => void send()}
          />
          <CommunityButton
            label={text.cancelReport}
            disabled={sending}
            onPress={() => {
              setOpen(false);
              setError(null);
            }}
            secondary
          />
        </>
      ) : (
        <CommunityButton
          label={targetType === 'post' ? text.reportPost : text.reportComment}
          disabled={cannotWrite}
          onPress={() => {
            setOpen(true);
          }}
          secondary
        />
      )}
    </View>
  );
}
