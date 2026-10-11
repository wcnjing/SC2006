import type { Activity } from '../types';
import { hasRole } from '../rbac';
import { requireUserId } from './auth';
import { getProfile } from './profile';
import { getActivity, validateActivityId } from './activities';
import { ApiError, toApiError, unwrap, type CommunityLinkClient } from './client';

export async function requireActivityResident(client: CommunityLinkClient) {
  const id = await requireUserId(client);
  const profile = await getProfile(client, id);
  if (profile?.id !== id || !hasRole(profile, 'resident')) {
    throw new ApiError('An active resident account is required.', 'forbidden');
  }
  return id;
}

export interface ActivityParticipation {
  saved: boolean;
  joined: boolean;
  activity: Activity;
  joinedCount: number;
}

// UI guidance only: registration is always validated atomically by the RPC.
export function activityJoinUnavailableReason(
  activity: Pick<Activity, 'status' | 'starts_at' | 'capacity'>,
  joinedCount: number,
  now: number,
): string | null {
  if (activity.status !== 'scheduled')
    return `This activity is ${activity.status} and cannot be joined.`;
  if (Date.parse(activity.starts_at) <= now)
    return 'This activity has already started and cannot be joined.';
  if (activity.capacity !== null && joinedCount >= activity.capacity)
    return 'This activity is full.';
  return null;
}

export async function getMyActivityParticipation(
  client: CommunityLinkClient,
  activityId: string,
): Promise<ActivityParticipation> {
  validateActivityId(activityId);
  const userId = await requireActivityResident(client);
  const [bookmark, participant, count, activity] = await Promise.all([
    client
      .from('activity_bookmarks')
      .select('activity_id')
      .eq('activity_id', activityId)
      .eq('user_id', userId)
      .maybeSingle(),
    client
      .from('activity_participants')
      .select('status')
      .eq('activity_id', activityId)
      .eq('user_id', userId)
      .maybeSingle(),
    client
      .from('activity_participants')
      .select('activity_id', { count: 'exact', head: true })
      .eq('activity_id', activityId)
      .eq('status', 'joined'),
    getActivity(client, activityId),
  ]);
  const saved = !!unwrap(bookmark);
  const joined = unwrap(participant)?.status === 'joined';
  if (count.error) throw toApiError(count.error);
  if (count.count === null)
    throw new ApiError('Unable to load registration count. Please try again.');
  if (!activity) throw new ApiError('Activity not found.', 'not_found');
  return { saved, joined, activity, joinedCount: count.count };
}

export async function saveActivity(client: CommunityLinkClient, activityId: string): Promise<void> {
  validateActivityId(activityId);
  const userId = await requireActivityResident(client);
  // INSERT, not UPSERT: bookmark RLS deliberately grants no UPDATE permission.
  const result = await client
    .from('activity_bookmarks')
    .insert({ activity_id: activityId, user_id: userId });
  if (result.error?.code === '23505') {
    // A retry may arrive after the first save committed. Confirm the own bookmark
    // before treating a unique conflict as success.
    const bookmark = unwrap(
      await client
        .from('activity_bookmarks')
        .select('activity_id')
        .eq('activity_id', activityId)
        .eq('user_id', userId)
        .maybeSingle(),
    );
    if (bookmark) return;
  }
  if (result.error) throw toApiError(result.error);
}

export async function unsaveActivity(
  client: CommunityLinkClient,
  activityId: string,
): Promise<void> {
  validateActivityId(activityId);
  const userId = await requireActivityResident(client);
  const rows = unwrap(
    await client
      .from('activity_bookmarks')
      .delete()
      .eq('activity_id', activityId)
      .eq('user_id', userId)
      .select('activity_id'),
  );
  // An absent bookmark is already unsaved. RLS can silently filter a DELETE,
  // so confirm absence before claiming success when no row was returned.
  if (!rows.length) {
    const bookmark = unwrap(
      await client
        .from('activity_bookmarks')
        .select('activity_id')
        .eq('activity_id', activityId)
        .eq('user_id', userId)
        .maybeSingle(),
    );
    if (bookmark)
      throw new ApiError('Unable to unsave this activity. Refresh and try again.', 'conflict');
  }
}

async function setRegistration(
  client: CommunityLinkClient,
  activityId: string,
  shouldJoin: boolean,
): Promise<void> {
  validateActivityId(activityId);
  await requireActivityResident(client);
  // No user ID is accepted: the RPC derives it from auth.uid().
  const result = unwrap(
    await client.rpc('set_activity_registration', {
      target_activity: activityId,
      should_join: shouldJoin,
    }),
  );
  if (result !== shouldJoin)
    throw new ApiError('Unable to confirm registration. Refresh and try again.');
}

export const joinActivity = (client: CommunityLinkClient, activityId: string) =>
  setRegistration(client, activityId, true);
export const leaveActivity = (client: CommunityLinkClient, activityId: string) =>
  setRegistration(client, activityId, false);
