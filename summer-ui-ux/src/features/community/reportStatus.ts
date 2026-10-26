import type { ReportStatus } from '@communitylink/shared';

import type { TagTone } from '@/components/ui';
import type { TranslationKey } from '@/i18n/en';

/** Label and tag colour for each report status (My reports, admin queue). */
export const REPORT_STATUS: Record<ReportStatus, { label: TranslationKey; tone: TagTone }> = {
  open: { label: 'admin.statusOpen', tone: 'primary' },
  actioned: { label: 'admin.statusActioned', tone: 'nature' },
  dismissed: { label: 'admin.statusDismissed', tone: 'neutral' },
};
