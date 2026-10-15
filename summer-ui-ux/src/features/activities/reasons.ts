import type { TranslationKey } from '@/i18n/en';
import type { ActivityRecommendation, UserProfile } from '@/types/models';

import { categoryLabel, formatDistanceShort, joinList } from './format';

type T = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/** Distance under which "it's nearby" is worth saying. */
const NEAR_KM = 2;

/**
 * FR 5.1.6: one plain-language reason per recommendation, e.g.
 * "Recommended because you like Gardening and it is 500 m away".
 *
 * P2's API also returns English `reasons` strings, but those can't be
 * translated, so the sentence is rebuilt here from the same inputs P2's
 * ranking uses (interest match on category/tags/outdoors, distance, popularity).
 */
export function recommendationReason(
  t: T,
  rec: ActivityRecommendation,
  profile: Pick<UserProfile, 'interestIds'> | null | undefined,
): string {
  const a = rec.activity;
  const topics = new Set([a.category, ...a.tags, ...(a.is_outdoor ? ['outdoors'] : [])]);
  const matched = (profile?.interestIds ?? []).filter((i) => topics.has(i));
  const interests = joinList(
    t,
    matched.slice(0, 2).map((id) => categoryLabel(t, id)),
  );
  const distance =
    rec.distanceKm !== null && rec.distanceKm <= NEAR_KM
      ? formatDistanceShort(t, rec.distanceKm)
      : null;

  if (interests && distance) return t('reason.interestNear', { interests, distance });
  if (interests) return t('reason.interest', { interests });
  if (distance) return t('reason.near', { distance });
  if (rec.joinedCount > 0) return t('reason.popular', { count: rec.joinedCount });
  return t('reason.fallback');
}
