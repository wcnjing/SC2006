import { ACCESSIBILITY_TAGS, CATEGORIES, findLabelKey } from '@/config/catalog';
import type { TranslationKey } from '@/i18n/en';
import type { LanguageCode } from '@/i18n/locales';
import type { Activity } from '@/types/models';

type T = (key: TranslationKey, vars?: Record<string, string | number>) => string;

const LOCALE: Record<LanguageCode, string> = {
  en: 'en-SG',
  zh: 'zh-SG',
  ms: 'ms-SG',
  ta: 'ta-SG',
};

/** All times are shown in Singapore time, whatever the device timezone. */
const TZ = 'Asia/Singapore';

/** "Sat, 13 Sep" / "9:00 am – 11:00 am" / both joined. */
export function formatWhen(activity: Pick<Activity, 'starts_at' | 'ends_at'>, lang: LanguageCode) {
  const locale = LOCALE[lang];
  const start = new Date(activity.starts_at);
  const end = new Date(activity.ends_at);
  const date = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: TZ,
  }).format(start);
  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TZ,
  });
  const time = `${timeFmt.format(start)} – ${timeFmt.format(end)}`;
  return { date, time, full: `${date}, ${time}` };
}

/** Metric distance (UC ViewRecommendations: "Distance must be shown using the Metric System"). */
export function formatDistance(t: T, km: number | null | undefined): string | null {
  if (km === null || km === undefined || !Number.isFinite(km)) return null;
  if (km < 1)
    return t('activity.distanceM', { value: Math.max(50, Math.round((km * 1000) / 50) * 50) });
  return t('activity.distanceKm', { value: km < 10 ? km.toFixed(1) : Math.round(km) });
}

/** Distance with the word "away" removed, for use inside a sentence. */
export function formatDistanceShort(t: T, km: number | null | undefined): string | null {
  if (km === null || km === undefined || !Number.isFinite(km)) return null;
  return km < 1
    ? `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`
    : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export const categoryLabel = (t: T, id: string) => {
  const key = findLabelKey(CATEGORIES, id);
  return key ? t(key as TranslationKey) : id;
};

export const accessLabel = (t: T, id: string) => {
  const key = findLabelKey(ACCESSIBILITY_TAGS, id);
  return key ? t(key as TranslationKey) : id;
};

/** Join a list as "A, B and C" in the current language. */
export function joinList(t: T, items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${t('reason.and')} ${items[items.length - 1]}`;
}

export function formatPrice(t: T, cents: number) {
  return cents > 0 ? t('activity.cost', { value: (cents / 100).toFixed(2) }) : t('activity.free');
}

export const hasStarted = (a: Pick<Activity, 'starts_at'>, now = Date.now()) =>
  Date.parse(a.starts_at) <= now;
export const hasEnded = (a: Pick<Activity, 'ends_at'>, now = Date.now()) =>
  Date.parse(a.ends_at) < now;
