import { useLocalSearchParams } from 'expo-router';
import { useT } from '@/context/SettingsContext';
import { ReportForm } from '@/features/community/ReportForm';

export default function ReportUserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  return <ReportForm title={t('report.userTitle')} targetType="user" targetId={id} />;
}
