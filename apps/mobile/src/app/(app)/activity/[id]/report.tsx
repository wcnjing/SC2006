import { useLocalSearchParams } from 'expo-router';

import { useT } from '@/context/SettingsContext';
import { ReportForm } from '@/features/community/ReportForm';

/** Report an activity (FR 8.4.3, UC ReportActivity). Goes to the same admin queue as posts. */
export default function ReportActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  return <ReportForm title={t('detail.report')} targetType="activity" targetId={id} />;
}
