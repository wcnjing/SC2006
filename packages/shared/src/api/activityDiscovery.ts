import type { Activity } from '../types';
import { requireUserId } from './auth';
import {
  activityFilterError,
  filterActivities,
  listActivities,
  validateActivityId,
  type ActivityFilters,
} from './activities';
import { requireActivityResident, saveActivity } from './participation';
import { ApiError, toApiError, unwrap, type CommunityLinkClient } from './client';

export type ActivityDiscoveryAction = 'like' | 'skip' | 'save';
export interface SwipeActivityOptions {
  filters?: ActivityFilters;
  /** IDs already handled in this browsing session, including cached cards. */
  excludedActivityIds?: readonly string[];
  /** Default 20, maximum 100. P5 renders one card at a time from this batch. */
  limit?: number;
  signal?: AbortSignal;
}

async function readExcludedIds(
  client: CommunityLinkClient,
  residentId: string,
  table: 'activity_participants' | 'activity_bookmarks',
  signal?: AbortSignal,
): Promise<string[]> {
  const ids: string[] = [];
  while (true) {
    const query = (
      table === 'activity_participants'
        ? client
            .from(table)
            .select('activity_id')
            .eq('user_id', residentId)
            .in('status', ['skipped', 'joined'])
        : client.from(table).select('activity_id').eq('user_id', residentId)
    )
      .order('activity_id')
      .range(ids.length, ids.length + 499);
    const page = unwrap(await (signal ? query.abortSignal(signal) : query));
    if (!page.length) return ids;
    ids.push(...page.map((row) => row.activity_id));
  }
}

/** Chronological deck batches, excluding own skipped, joined and saved activities. */
export async function listSwipeActivities(
  client: CommunityLinkClient,
  options: SwipeActivityOptions = {},
): Promise<Activity[]> {
  const limit = options.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new ApiError('Swipe activity limit must be an integer from 1 to 100.', 'validation');
  const invalid = activityFilterError(options.filters ?? {});
  if (invalid) throw new ApiError(invalid, 'validation');
  const residentId = await requireActivityResident(client);
  const [activities, participants, bookmarks] = await Promise.all([
    listActivities(client, { signal: options.signal }),
    readExcludedIds(client, residentId, 'activity_participants', options.signal),
    readExcludedIds(client, residentId, 'activity_bookmarks', options.signal),
  ]);
  const excluded = new Set([...participants, ...bookmarks, ...(options.excludedActivityIds ?? [])]);
  const now = Date.now();
  return filterActivities(activities, options.filters ?? {})
    .filter(
      (activity) =>
        activity.status === 'scheduled' &&
        Date.parse(activity.starts_at) > now &&
        !excluded.has(activity.id),
    )
    .slice(0, limit);
}

/** Persistent Skip. Requires the reviewed Skip RPC; never writes participants directly. */
export async function skipActivity(client: CommunityLinkClient, activityId: string): Promise<void> {
  validateActivityId(activityId);
  await requireActivityResident(client);
  const result = await client.rpc('skip_activity', { target_activity: activityId });
  if (result.error?.code === 'PGRST202' || result.error?.code === '42883')
    throw new ApiError(
      'Persistent Skip is unavailable until the team approves and applies the P2 Skip RPC.',
      'skip_unavailable',
      result.error,
    );
  if (result.error) throw toApiError(result.error);
  if (result.data !== true)
    throw new ApiError('Unable to confirm Skip. Refresh and try again.', 'conflict');
}

/** Like is an independent bookmark, never a registration or participant status change. */
export const likeActivity = saveActivity;

function canonicalAction(action: ActivityDiscoveryAction): 'save' | 'skip' {
  if (action === 'like' || action === 'save') return 'save';
  if (action === 'skip') return 'skip';
  throw new ApiError('Choose Like, Save or Skip.', 'validation');
}
export function recordActivityInteraction(
  client: CommunityLinkClient,
  activityId: string,
  action: ActivityDiscoveryAction,
): Promise<void> {
  // Convert synchronous validation errors into the same Promise error contract as writes.
  return Promise.resolve().then(() =>
    canonicalAction(action) === 'skip'
      ? skipActivity(client, activityId)
      : saveActivity(client, activityId),
  );
}

export interface ActivityDiscoverySession {
  readonly excludedActivityIds: readonly string[];
  load(options?: SwipeActivityOptions): Promise<Activity[]>;
  act(activityId: string, action: ActivityDiscoveryAction): Promise<void>;
}

/** Headless state for P5. Create once per resident browsing session, never globally. */
export async function createActivityDiscoverySession(
  client: CommunityLinkClient,
  /** Optional per-resident IDs restored by P5 from sessionStorage on web refresh. */
  excludedActivityIds: readonly string[] = [],
): Promise<ActivityDiscoverySession> {
  const residentId = await requireActivityResident(client);
  const excluded = new Set(excludedActivityIds);
  const pending = new Map<string, { action: 'save' | 'skip'; promise: Promise<void> }>();
  async function assertOwner() {
    if ((await requireUserId(client)) !== residentId)
      throw new ApiError(
        'The resident changed. Start a new activity browsing session.',
        'forbidden',
      );
  }
  return {
    get excludedActivityIds() {
      return [...excluded];
    },
    async load(options = {}) {
      await assertOwner();
      const rows = await listSwipeActivities(client, {
        ...options,
        excludedActivityIds: [
          ...excluded,
          ...pending.keys(),
          ...(options.excludedActivityIds ?? []),
        ],
      });
      await assertOwner();
      // A Skip/Like may finish while this fetch is in flight. Do not revive a cached card.
      return rows.filter((row) => !excluded.has(row.id) && !pending.has(row.id));
    },
    act(activityId, action) {
      let canonical: 'save' | 'skip';
      try {
        validateActivityId(activityId);
        canonical = canonicalAction(action);
      } catch (error) {
        return Promise.reject(error);
      }
      const existing = pending.get(activityId);
      if (existing)
        return existing.action === canonical
          ? existing.promise
          : Promise.reject(new ApiError('This activity action is already in progress.', 'busy'));
      const promise = (async () => {
        await assertOwner();
        await recordActivityInteraction(client, activityId, action);
        await assertOwner();
        excluded.add(activityId);
      })().finally(() => pending.delete(activityId));
      pending.set(activityId, { action: canonical, promise });
      return promise;
    },
  };
}
