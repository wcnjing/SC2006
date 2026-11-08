import type { TranslationKey } from '@/i18n/en';

type T = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/** "Just now" / "5 min ago" / "3 h ago" / "2 d ago", then a date (Singapore time). */
export function formatAgo(t: T, iso: string, now = Date.now()): string {
  const min = Math.floor((now - Date.parse(iso)) / 60_000);
  if (min < 1) return t('community.justNow');
  if (min < 60) return t('community.minutesAgo', { n: min });
  if (min < 24 * 60) return t('community.hoursAgo', { n: Math.floor(min / 60) });
  if (min < 7 * 24 * 60) return t('community.daysAgo', { n: Math.floor(min / 1440) });
  return new Intl.DateTimeFormat('en-SG', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Singapore',
  }).format(new Date(iso));
}
