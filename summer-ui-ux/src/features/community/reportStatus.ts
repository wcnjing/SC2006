import type { ContentReportTarget, ReportStatus } from '@communitylink/shared';

import type { IconName, TagTone } from '@/components/ui';
import type { TranslationKey } from '@/i18n/en';

/** Label and tag colour for each report status (My reports, admin queue). */
export const REPORT_STATUS: Record<ReportStatus, { label: TranslationKey; tone: TagTone }> = {
  open: { label: 'admin.statusOpen', tone: 'primary' },
  actioned: { label: 'admin.statusActioned', tone: 'nature' },
  dismissed: { label: 'admin.statusDismissed', tone: 'neutral' },
};

/** Reportable content types (FR 8.4): label, admin queue title and tile icon. */
export const REPORT_TYPES = {
  post: { label: 'admin.typePost', queue: 'admin.reportedPosts', icon: 'document-text-outline' },
  comment: {
    label: 'admin.typeComment',
    queue: 'admin.reportedComments',
    icon: 'chatbox-ellipses-outline',
  },
  activity: {
    label: 'admin.typeActivity',
    queue: 'admin.reportedActivities',
    icon: 'calendar-outline',
  },
} as const satisfies Record<
  ContentReportTarget,
  { label: TranslationKey; queue: TranslationKey; icon: IconName }
>;

export const reportTypeLabel = (type: string): TranslationKey =>
  REPORT_TYPES[type as ContentReportTarget]?.label ?? 'admin.typePost';
