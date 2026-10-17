import {
  ApiError,
  MODERATION_REASON_MAX_LENGTH,
  validateModerationReason,
  type ModerationAction,
} from '@communitylink/shared';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { getModerationReport, reviewContentReport } from '../services/community';
import { AdminGuard } from './AdminGuard';
import {
  CommunityButton,
  CommunityError,
  PostImage,
  communityStyles as styles,
  communityText as text,
} from './communityUi';
import { useCommunityQuery } from './useCommunityQuery';

function Review({ id }: { id: string }) {
  const load = useCallback(
    (signal: AbortSignal) => getModerationReport(supabase, id, { signal }),
    [id],
  );
  const query = useCommunityQuery(load);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState<ModerationAction | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  function choose(action: ModerationAction) {
    const invalid = validateModerationReason(reason);
    setError(invalid);
    if (!invalid) setConfirm(action);
  }
  async function decide() {
    if (busy.current || !confirm) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await reviewContentReport(supabase, id, confirm, reason);
      router.dismissTo('/admin/moderation');
    } catch (error) {
      setError(error instanceof ApiError ? error.message : text.moderationError);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const report = query.data?.report;
  const content = query.data?.content;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {query.loading ? (
        <ActivityIndicator accessibilityLabel="Loading report review" />
      ) : query.error ? (
        <>
          <CommunityError>{query.error}</CommunityError>
          <CommunityButton label={text.retry} onPress={query.retry} />
        </>
      ) : !report ? (
        <Text style={styles.body}>{text.reportUnavailable}</Text>
      ) : (
        <>
          <Text style={styles.heading} accessibilityRole="header">
            {text.reviewReport}
          </Text>
          <View style={styles.card}>
            <Text style={styles.label}>
              {report.target_type} report · {text.reportStatuses[report.status]}
            </Text>
            <Text style={styles.body}>{report.reason}</Text>
            {report.details && <Text style={styles.body}>{report.details}</Text>}
            <Text style={styles.muted}>Reporter: {report.reporter_id}</Text>
            <Text style={styles.muted}>{new Date(report.created_at).toLocaleString()}</Text>
            {report.resolution_note && (
              <Text style={styles.body}>Review outcome: {report.resolution_note}</Text>
            )}
          </View>
          <Text style={styles.label}>{text.currentContent}</Text>
          {content ? (
            <View style={styles.card}>
              <Text style={styles.label}>
                {content.author?.display_name || text.authorFallback}
              </Text>
              <Text style={styles.body} testID="moderation-content-body">
                {content.body}
              </Text>
              {content.imageUrl && <PostImage url={content.imageUrl} />}
              {content.isRemoved && (
                <Text style={styles.body}>
                  {text.alreadyRemoved} {content.removedReason}
                </Text>
              )}
              {content.parentPost && (
                <>
                  <Text style={styles.label}>
                    Parent post{content.parentPost.is_removed ? ' (removed)' : ''}
                  </Text>
                  <Text style={styles.body}>{content.parentPost.body}</Text>
                </>
              )}
            </View>
          ) : (
            <Text style={styles.body}>
              {report.target_type === 'post' || report.target_type === 'comment'
                ? text.deletedModerationContent
                : text.unsupportedModerationContent}
            </Text>
          )}
          <CommunityButton
            label={text.refreshReview}
            onPress={() => {
              setConfirm(null);
              query.retry();
            }}
            disabled={saving}
            secondary
          />
          {report.status === 'open' && (
            <View style={styles.section}>
              <Text style={styles.label}>{text.moderationReason}</Text>
              <Text style={styles.muted}>{text.moderationReasonHint}</Text>
              <TextInput
                accessibilityLabel={text.moderationReason}
                style={[styles.input, styles.multiline]}
                value={reason}
                onChangeText={(value) => {
                  setReason(value);
                  setConfirm(null);
                }}
                multiline
                editable={!saving}
              />
              <Text style={styles.muted}>
                {Array.from(reason.trim()).length} / {MODERATION_REASON_MAX_LENGTH}
              </Text>
              {confirm ? (
                <>
                  <Text style={styles.body}>
                    {confirm === 'remove' ? text.confirmRemovalHint : text.confirmDismissalHint}
                  </Text>
                  <CommunityButton
                    label={
                      saving
                        ? text.saving
                        : confirm === 'remove'
                          ? text.confirmRemove
                          : text.confirmDismiss
                    }
                    disabled={saving}
                    onPress={() => void decide()}
                  />
                  <CommunityButton
                    label={text.keepReviewing}
                    disabled={saving}
                    onPress={() => setConfirm(null)}
                    secondary
                  />
                </>
              ) : (
                <>
                  {content && (
                    <CommunityButton
                      label={content.isRemoved ? text.resolveRemoved : text.removeContent}
                      onPress={() => choose('remove')}
                    />
                  )}
                  <CommunityButton
                    label={text.dismissReport}
                    onPress={() => choose('dismiss')}
                    secondary
                  />
                </>
              )}
              {error && <CommunityError>{error}</CommunityError>}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
export function ModerationReviewScreen({ id }: { id: string }) {
  return (
    <AdminGuard>
      <Review key={id} id={id} />
    </AdminGuard>
  );
}
