import type { Activity, ActivityRating } from '../types';
import { hasRole } from '../rbac';
import { requireUserId } from './auth';
import { getProfile } from './profile';
import { getActivity, validateActivityId } from './activities';
import { ApiError, toApiError, unwrap, type CommunityLinkClient } from './client';

export interface ActivityRatingInput {
  rating: number;
  comment?: string | null;
}

export function validateActivityRating(input: ActivityRatingInput): {
  rating: number;
  comment: string | null;
} {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
    throw new ApiError('Choose a whole-number rating from 1 to 5 stars.', 'validation');
  const comment = input.comment?.trim() || null;
  // PostgreSQL char_length counts Unicode code points, not UTF-16 code units.
  if (comment && [...comment].length > 1000)
    throw new ApiError('Written feedback must be 1,000 characters or fewer.', 'validation');
  return { rating: input.rating, comment };
}

export async function listActivityRatings(
  client: CommunityLinkClient,
  activityId: string,
): Promise<ActivityRating[]> {
  validateActivityId(activityId);
  await requireUserId(client); // Existing read grant/RLS is signed-in only.
  const ratings: ActivityRating[] = [];
  while (true) {
    const page = unwrap(
      await client
        .from('activity_ratings')
        .select('*')
        .eq('activity_id', activityId)
        .order('created_at', { ascending: false })
        .order('user_id')
        .range(ratings.length, ratings.length + 499),
    );
    if (!page.length) return ratings;
    ratings.push(...page);
  }
}

export function averageActivityRating(
  ratings: readonly Pick<ActivityRating, 'rating'>[],
): number | null {
  return ratings.length ? ratings.reduce((sum, row) => sum + row.rating, 0) / ratings.length : null;
}

export interface ActivityRatingEligibility {
  activity: Activity;
  joined: boolean;
  rating: ActivityRating | null;
}

export function activityRatingUnavailableReason(
  data: ActivityRatingEligibility,
  now: number,
): string | null {
  if (data.rating) return 'You have already rated this activity.';
  if (!data.joined) return 'Only residents registered as joined can rate this activity.';
  if (data.activity.status === 'cancelled') return 'Cancelled activities cannot be rated.';
  const end = Date.parse(data.activity.ends_at);
  // Match existing RLS's strict ends_at < now(), including the equality boundary.
  if (!Number.isFinite(end) || end >= now)
    return 'You can rate this activity after it has concluded.';
  return null;
}

async function requireRatingResident(client: CommunityLinkClient): Promise<string> {
  const userId = await requireUserId(client);
  const profile = await getProfile(client, userId);
  if (profile?.id !== userId || !hasRole(profile, 'resident'))
    throw new ApiError('An active resident account is required to rate activities.', 'forbidden');
  return userId;
}

async function loadEligibility(
  client: CommunityLinkClient,
  activityId: string,
  userId: string,
): Promise<ActivityRatingEligibility> {
  const [activity, participation, rating] = await Promise.all([
    getActivity(client, activityId),
    client
      .from('activity_participants')
      .select('status')
      .eq('activity_id', activityId)
      .eq('user_id', userId)
      .maybeSingle(),
    client
      .from('activity_ratings')
      .select('*')
      .eq('activity_id', activityId)
      .eq('user_id', userId)
      .maybeSingle(),
  ]);
  const joined = unwrap(participation)?.status === 'joined';
  const ownRating = unwrap(rating);
  if (!activity) throw new ApiError('Activity not found.', 'not_found');
  return { activity, joined, rating: ownRating };
}

export async function getMyActivityRatingEligibility(
  client: CommunityLinkClient,
  activityId: string,
): Promise<ActivityRatingEligibility> {
  validateActivityId(activityId);
  return loadEligibility(client, activityId, await requireRatingResident(client));
}

export async function submitActivityRating(
  client: CommunityLinkClient,
  activityId: string,
  input: ActivityRatingInput,
): Promise<ActivityRating> {
  validateActivityId(activityId);
  const clean = validateActivityRating(input);
  const userId = await requireRatingResident(client);
  const unavailable = activityRatingUnavailableReason(
    await loadEligibility(client, activityId, userId),
    Date.now(),
  );
  if (unavailable) throw new ApiError(unavailable, 'validation');
  // INSERT only. The composite primary key is the final duplicate/concurrency guard.
  const result = await client
    .from('activity_ratings')
    .insert({ activity_id: activityId, user_id: userId, ...clean })
    .select('*')
    .single();
  if (result.error?.code === '23505')
    throw new ApiError('You have already rated this activity.', '23505', result.error);
  if (result.error) throw toApiError(result.error);
  if (!result.data)
    throw new ApiError('Unable to confirm your rating. Refresh before trying again.');
  return result.data;
}

// The upcoming list excludes concluded activities. Reuse the participant FK to
// give residents a path to rate/view their joined activities after the end time.
export async function listMyConcludedActivities(client: CommunityLinkClient): Promise<Activity[]> {
  const userId = await requireRatingResident(client);
  const endsBefore = new Date().toISOString();
  const activities: Activity[] = [];
  while (true) {
    const page = unwrap(
      await client
        .from('activity_participants')
        .select('activities!inner(*)')
        .eq('user_id', userId)
        .eq('status', 'joined')
        .lt('activities.ends_at', endsBefore)
        .neq('activities.status', 'cancelled')
        .order('activity_id')
        .range(activities.length, activities.length + 499),
    );
    if (!page.length) return activities;
    activities.push(...page.map((row) => row.activities));
  }
}
