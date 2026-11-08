import { validateModerationReason, type ModerationAction } from '@communitylink/shared';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  ScreenHeader,
  Section,
  Tag,
  TextField,
} from '@/components/ui';
import { useT } from '@/context/SettingsContext';
import { formatAgo } from '@/features/community/format';
import { AuthorLine } from '@/features/community/PostCard';
import { REPORT_STATUS, reportTypeLabel } from '@/features/community/reportStatus';
import { useAsync } from '@/lib/useAsync';
import { communityService, errorMessageKey, errorText } from '@/services';
import { colors, spacing } from '@/theme/tokens';

/**
 * Review one report (FR 12.1.2 / 12.1.4, UC RemoveContent). Shows the reported
 * content as it is now (also if already removed), then Remove or Dismiss with
 * a required reason. P3's review_content_report updates the content, the
 * report and the audit log together.
 */
export default function ReviewReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<ModerationAction | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const page = useAsync(() => communityService.getModerationReport(id));

  const header = <ScreenHeader title={t('admin.reviewTitle')} />;
  if (!page.data) {
    return (
      <Screen header={header}>
        {page.loading ? (
          <LoadingState />
        ) : page.error ? (
          <ErrorState message={t(errorMessageKey(page.error))} onRetry={page.reload} />
        ) : (
          <EmptyState icon="document-outline" title={t('admin.reportMissing')} />
        )}
      </Screen>
    );
  }

  const { report, content } = page.data;
  const open = report.status === 'open';

  const decide = async (action: ModerationAction) => {
    setConfirmRemove(false);
    const invalid = validateModerationReason(reason);
    setReasonError(invalid);
    if (invalid) return;
    setBusy(action);
    setStatus(null);
    try {
      await communityService.reviewContentReport(report.id, action, reason);
      const text = t(action === 'remove' ? 'admin.removedToast' : 'admin.dismissedToast');
      setStatus({ tone: 'success', text });
      AccessibilityInfo.announceForAccessibility(text);
      await page.revalidate();
    } catch (e) {
      setStatus({ tone: 'error', text: errorText(t, e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      header={header}
      contentStyle={styles.content}
      footer={
        open && (
          <View style={styles.actions}>
            <Button
              label={t('admin.dismiss')}
              variant="outline"
              loading={busy === 'dismiss'}
              disabled={!!busy}
              onPress={() => decide('dismiss')}
              style={styles.flex}
            />
            <Button
              label={t('admin.remove')}
              variant="danger"
              icon="trash-outline"
              loading={busy === 'remove'}
              disabled={!!busy || !content || content.isRemoved}
              onPress={() => setConfirmRemove(true)}
              style={styles.flex}
            />
          </View>
        )
      }
    >
      {status && <Banner tone={status.tone}>{status.text}</Banner>}

      <View style={styles.head}>
        <AppText variant="h2" heading style={styles.flex}>
          {report.reason}
        </AppText>
        <Tag
          label={t(REPORT_STATUS[report.status].label)}
          tone={REPORT_STATUS[report.status].tone}
        />
      </View>
      <AppText variant="caption" color={colors.textMuted}>
        {t('admin.reportedWhen', {
          type: t(reportTypeLabel(report.target_type)),
          when: formatAgo(t, report.created_at),
        })}
      </AppText>
      {report.details && <AppText>{report.details}</AppText>}

      <Section title={t('admin.contentTitle')}>
        {!content ? (
          <Banner tone="info">{t('admin.contentGone')}</Banner>
        ) : (
          <Card variant="muted">
            <View style={styles.contentBody}>
              <AuthorLine
                name={content.author?.display_name ?? t('community.unknownUser')}
                uri={content.author?.avatar_url}
                when={formatAgo(t, content.createdAt)}
              />
              <AppText>{content.body}</AppText>
              {content.parentPost && (
                <AppText variant="caption" color={colors.textMuted} numberOfLines={2}>
                  {t('admin.onPost', { body: content.parentPost.body })}
                </AppText>
              )}
              {content.isRemoved && (
                <Banner tone="warning">
                  {t('admin.alreadyRemoved', { reason: content.removedReason ?? '' })}
                </Banner>
              )}
            </View>
          </Card>
        )}
      </Section>

      {open ? (
        <TextField
          label={t('admin.reasonLabel')}
          hint={t('admin.reasonHint')}
          value={reason}
          onChangeText={setReason}
          error={reasonError}
          multiline
        />
      ) : (
        report.resolution_note && (
          <Section title={t('admin.decisionTitle')}>
            <AppText>{report.resolution_note}</AppText>
          </Section>
        )
      )}

      <ConfirmDialog
        visible={confirmRemove}
        title={t('admin.removeTitle')}
        body={t(
          report.target_type === 'activity' ? 'admin.removeActivityBody' : 'admin.removeBody',
        )}
        confirmLabel={t('admin.remove')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => decide('remove')}
        onCancel={() => setConfirmRemove(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  contentBody: { gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.md },
});
