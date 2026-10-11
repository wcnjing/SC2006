import type { Activity, Profile } from '../types';
import { hasRole } from '../rbac';
import { requireUserId } from './auth';
import { getProfile, listNeighbourhoods } from './profile';
import { activityDistanceKm, listActivities, validCoordinates } from './activities';
import { ApiError, unwrap, type CommunityLinkClient } from './client';

export const RECOMMENDATION_DEADLINE_MS = 3000;
export interface RecommendationOrigin {
  lat: number;
  lng: number;
  label: string;
  source: 'device' | 'neighbourhood';
}
export interface ActivityRecommendation {
  activity: Activity;
  score: number;
  reasons: string[];
  distanceKm: number | null;
  joinedCount: number;
  scores: { interests: number; proximity: number; popularity: number };
}
export interface ActivityRecommendations {
  recommendations: ActivityRecommendation[];
  personalised: boolean;
  origin: RecommendationOrigin | null;
}
type Preferences = Pick<Profile, 'interests' | 'accessibility_needs'>;
const normalise = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
const uniquePreferences = (values: readonly string[]) => [
  ...new Set(values.map(normalise).filter(Boolean)),
];

function preferenceEligible(activity: Activity, needs: readonly string[], now: number): boolean {
  return (
    activity.status === 'scheduled' &&
    Date.parse(activity.starts_at) > now &&
    needs.every((need) =>
      activity.accessibility_features.some((feature) => normalise(feature) === need),
    )
  );
}

// Pure, deterministic ranking. Accessibility requirements are hard constraints,
// never a score that can be outweighed by popularity or an interest match.
export function rankActivityRecommendations(
  activities: readonly Activity[],
  profile: Preferences,
  counts: ReadonlyMap<string, number>,
  joined: ReadonlySet<string>,
  origin: RecommendationOrigin | null,
  now = Date.now(),
): ActivityRecommendation[] {
  const interests = uniquePreferences(profile.interests);
  const needs = uniquePreferences(profile.accessibility_needs);
  const location = origin && validCoordinates(origin) ? origin : null;
  const weights = interests.length
    ? { interests: 60, proximity: 25, popularity: 15 }
    : { interests: 0, proximity: 60, popularity: 40 };
  const results: ActivityRecommendation[] = [];
  for (const activity of activities) {
    const joinedCount = counts.get(activity.id) ?? 0;
    if (
      !preferenceEligible(activity, needs, now) ||
      joined.has(activity.id) ||
      (activity.capacity !== null && joinedCount >= activity.capacity)
    )
      continue;
    const topics = new Set(
      [activity.category, ...activity.tags, ...(activity.is_outdoor ? ['outdoors'] : [])].map(
        normalise,
      ),
    );
    const matching = interests.filter((interest) => topics.has(interest));
    const distanceKm =
      location && validCoordinates(activity)
        ? activityDistanceKm(location, { lat: activity.lat!, lng: activity.lng! })
        : null;
    const scores = {
      interests: interests.length ? (weights.interests * matching.length) / interests.length : 0,
      proximity: distanceKm === null ? 0 : weights.proximity / (1 + distanceKm / 5),
      popularity: (weights.popularity * joinedCount) / (joinedCount + 5),
    };
    const reasons: string[] = [];
    if (matching.length) reasons.push(`Matches your interests: ${matching.join(', ')}.`);
    if (needs.length)
      reasons.push(`Meets all your accessibility requirements: ${needs.join(', ')}.`);
    if (distanceKm !== null)
      reasons.push(
        `About ${distanceKm.toFixed(1)} km from ${location!.label} (straight-line${location!.source === 'neighbourhood' ? ', approximate' : ''}).`,
      );
    else
      reasons.push('Proximity unavailable: resident location or activity coordinates are missing.');
    if (joinedCount) reasons.push(`${joinedCount} joined registrations contribute to popularity.`);
    if (!matching.length && !joinedCount)
      reasons.push('Upcoming eligible activity; no interest match or existing registrations.');
    results.push({
      activity,
      score: scores.interests + scores.proximity + scores.popularity,
      scores,
      reasons,
      distanceKm,
      joinedCount,
    });
  }
  return results.sort(
    (a, b) =>
      b.score - a.score ||
      Date.parse(a.activity.starts_at) - Date.parse(b.activity.starts_at) ||
      (a.activity.id < b.activity.id ? -1 : a.activity.id > b.activity.id ? 1 : 0),
  );
}

// Read-only: auth-derived profile and existing RLS-visible joined rows only.
// Fail rather than generate misleading eligibility/popularity from partial data.
export async function getActivityRecommendations(
  client: CommunityLinkClient,
  options?: { deviceLocation?: { lat: number; lng: number } },
): Promise<ActivityRecommendations> {
  if (options?.deviceLocation && !validCoordinates(options.deviceLocation))
    throw new ApiError('A valid device location is required.', 'validation');
  const controller = new AbortController();
  const timeoutError = () =>
    new ApiError('Recommendations took longer than 3 seconds. Please retry.', 'timeout');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = Date.now() + RECOMMENDATION_DEADLINE_MS;
  const checkDeadline = () => {
    if (controller.signal.aborted || Date.now() >= deadline) throw timeoutError();
  };
  const timedOut = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(timeoutError());
    }, RECOMMENDATION_DEADLINE_MS);
  });
  async function generate(): Promise<ActivityRecommendations> {
    const userId = await requireUserId(client);
    checkDeadline();
    const profile = await getProfile(client, userId);
    checkDeadline();
    if (!profile || profile.id !== userId || !hasRole(profile, 'resident'))
      throw new ApiError(
        'An active resident account is required for recommendations.',
        'forbidden',
      );
    const [activities, neighbourhoods] = await Promise.all([
      listActivities(client, { signal: controller.signal }),
      !options?.deviceLocation && profile.neighbourhood_id !== null
        ? listNeighbourhoods(client)
        : Promise.resolve([]),
    ]);
    checkDeadline();
    const neighbourhood = neighbourhoods.find((row) => row.id === profile.neighbourhood_id);
    const origin: RecommendationOrigin | null = options?.deviceLocation
      ? { ...options.deviceLocation, source: 'device', label: 'your device location' }
      : neighbourhood && validCoordinates(neighbourhood)
        ? {
            lat: neighbourhood.lat,
            lng: neighbourhood.lng,
            source: 'neighbourhood',
            label: `${neighbourhood.name} neighbourhood centre`,
          }
        : null;
    const needs = uniquePreferences(profile.accessibility_needs);
    const now = Date.now();
    const candidates = activities.filter((activity) => preferenceEligible(activity, needs, now));
    const counts = new Map<string, number>();
    const joined = new Set<string>();
    const chunks: string[][] = [];
    // Bound URL length and fetch at most four independent chunks concurrently.
    for (let offset = 0; offset < candidates.length; offset += 100)
      chunks.push(candidates.slice(offset, offset + 100).map((row) => row.id));
    async function readJoined(ids: string[]) {
      let offset = 0;
      while (true) {
        checkDeadline();
        const page = unwrap(
          await client
            .from('activity_participants')
            .select('activity_id,user_id')
            .eq('status', 'joined')
            .in('activity_id', ids)
            .order('activity_id')
            .order('user_id')
            .range(offset, offset + 499)
            .abortSignal(controller.signal),
        );
        if (!page.length) return;
        for (const row of page) {
          counts.set(row.activity_id, (counts.get(row.activity_id) ?? 0) + 1);
          if (row.user_id === userId) joined.add(row.activity_id);
        }
        offset += page.length;
      }
    }
    for (let offset = 0; offset < chunks.length; offset += 4) {
      await Promise.all(chunks.slice(offset, offset + 4).map(readJoined));
    }
    checkDeadline();
    const recommendations = rankActivityRecommendations(
      candidates,
      profile,
      counts,
      joined,
      origin,
    ).slice(0, 20);
    checkDeadline();
    return {
      recommendations,
      personalised: uniquePreferences(profile.interests).length > 0,
      origin,
    };
  }
  try {
    return await Promise.race([timedOut, generate()]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
