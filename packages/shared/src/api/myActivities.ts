import type { Activity } from '../types';
import { unwrap, type CommunityLinkClient } from './client';
import { requireActivityResident } from './participation';

export interface MyActivityCard {
  activity: Activity;
  saved: boolean;
  joined: boolean;
}

export interface MyActivityCollections {
  saved: MyActivityCard[];
  joined: MyActivityCard[];
  history: MyActivityCard[];
}

type RelatedActivity = { activities: Activity | null };

async function readOwnActivities(
  client: CommunityLinkClient,
  userId: string,
  table: 'activity_bookmarks' | 'activity_participants',
): Promise<Activity[]> {
  const activities: Activity[] = [];
  let offset = 0;
  while (true) {
    const query =
      table === 'activity_participants'
        ? client
            .from('activity_participants')
            .select('activities!inner(*)')
            .eq('user_id', userId)
            .eq('status', 'joined')
        : client.from('activity_bookmarks').select('activities!inner(*)').eq('user_id', userId);
    const page = unwrap<RelatedActivity[]>(
      await query.order('activity_id').range(offset, offset + 499),
    );
    if (!page.length) return activities;
    offset += page.length;
    for (const row of page) if (row.activities) activities.push(row.activities);
  }
}

// No caller-supplied resident ID. Personal collections always use the authenticated
// active resident and explicit own-user predicates, in addition to existing RLS.
export async function listMyActivityCollections(
  client: CommunityLinkClient,
): Promise<MyActivityCollections> {
  const userId = await requireActivityResident(client);
  const now = Date.now();
  const [bookmarks, registrations] = await Promise.all([
    readOwnActivities(client, userId, 'activity_bookmarks'),
    readOwnActivities(client, userId, 'activity_participants'),
  ]);
  const savedIds = new Set(bookmarks.map((activity) => activity.id));
  const joinedIds = new Set(registrations.map((activity) => activity.id));
  const cards = (activities: Activity[], newestFirst = false): MyActivityCard[] =>
    [...new Map(activities.map((activity) => [activity.id, activity])).values()]
      .sort((a, b) => {
        const startOrder = Date.parse(a.starts_at) - Date.parse(b.starts_at);
        return (newestFirst ? -startOrder : startOrder) || a.id.localeCompare(b.id);
      })
      .map((activity) => ({
        activity,
        saved: savedIds.has(activity.id),
        joined: joinedIds.has(activity.id),
      }));
  return {
    saved: cards(bookmarks),
    joined: cards(
      registrations.filter(
        (activity) => activity.status === 'scheduled' && Date.parse(activity.starts_at) > now,
      ),
    ),
    history: cards(
      registrations.filter((activity) => Date.parse(activity.starts_at) <= now),
      true,
    ),
  };
}

export async function listMySavedActivities(
  client: CommunityLinkClient,
): Promise<MyActivityCard[]> {
  return (await listMyActivityCollections(client)).saved;
}

export async function listMyJoinedActivities(
  client: CommunityLinkClient,
): Promise<MyActivityCard[]> {
  return (await listMyActivityCollections(client)).joined;
}

export async function listMyActivityHistory(
  client: CommunityLinkClient,
): Promise<MyActivityCard[]> {
  return (await listMyActivityCollections(client)).history;
}
