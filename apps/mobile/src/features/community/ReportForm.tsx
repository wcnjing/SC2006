import { REPORT_DETAILS_MAX_LENGTH, validateReportContent } from '@communitylink/shared';
import type { ContentReportTarget } from '@communitylink/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import {
  AppText,
  Banner,
  Button,
  ChipGroup,
  EmptyState,
  Screen,
  ScreenHeader,
  TextField,
} from '@/components/ui';
import { useT } from '@/context/SettingsContext';
import { en, type TranslationKey } from '@/i18n/en';
import { communityService, errorText } from '@/services';
import { colors, spacing } from '@/theme/tokens';

const REASONS = [
  'report.reason.spam',
  'report.reason.harassment',
  'report.reason.inappropriate',
  'report.reason.misinformation',
  'report.reason.other',
] as const satisfies readonly TranslationKey[];
type Reason = (typeof REASONS)[number];

/**
 * Report form shared by posts, comments and activities (FR 8.4, UC ReportContent / ReportActivity).
 * The reason is stored in English, so admins read the same words whatever the reporter's language.
 */
export function ReportForm({
  title,
  targetType,
  targetId,
}: {
  title: string;
  targetType: ContentReportTarget;
  targetId: string;
}) {
  const t = useT();
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Screen header={<ScreenHeader title={title} />}>
        <EmptyState
          icon="shield-checkmark-outline"
          title={t('report.thanksTitle')}
          body={t('report.thanksBody')}
          actionLabel={t('common.done')}
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const submit = async () => {
    const invalid = reason ? validateReportContent(en[reason], details) : t('report.pickReason');
    setError(invalid);
    if (invalid || !reason) return;
    setBusy(true);
    try {
      await communityService.submitReport({
        targetType,
        targetId,
        reason: en[reason],
        details,
      });
      setDone(true);
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<ScreenHeader title={title} />}
      contentStyle={styles.content}
      footer={<Button label={t('report.submit')} icon="flag" loading={busy} onPress={submit} />}
    >
      <AppText color={colors.textMuted}>{t('report.intro')}</AppText>
      {error && <Banner tone="error">{error}</Banner>}
      <AppText variant="label">{t('report.reasonLabel')}</AppText>
      <ChipGroup
        accessibilityLabel={t('report.reasonLabel')}
        options={REASONS.map((r) => ({ value: r, label: t(r) }))}
        value={reason}
        onChange={(v) => setReason(v as Reason)}
      />
      <TextField
        label={t('report.detailsLabel')}
        hint={t('report.detailsHint', { max: REPORT_DETAILS_MAX_LENGTH })}
        optional
        multiline
        value={details}
        onChangeText={setDetails}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { gap: spacing.lg, paddingTop: spacing.sm } });
