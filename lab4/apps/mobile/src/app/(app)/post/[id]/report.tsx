import { useLocalSearchParams } from 'expo-router';

import { useT } from '@/context/SettingsContext';
import { ReportForm } from '@/features/community/ReportForm';

/**
 * Report a post or a comment (FR 8.4.1–8.4.2, UC ReportContent).
 * /post/[id]/report reports the post; add ?comment=<id> to report a comment on it.
 */
export default function ReportPostScreen() {
  const { id, comment } = useLocalSearchParams<{ id: string; comment?: string }>();
  const t = useT();
  return (
    <ReportForm
      title={t(comment ? 'report.commentTitle' : 'report.postTitle')}
      targetType={comment ? 'comment' : 'post'}
      targetId={comment ?? id}
    />
  );
}
