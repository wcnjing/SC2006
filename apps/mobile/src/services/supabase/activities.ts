import {
  cancelActivity,
  createActivity,
  createActivityDiscoverySession,
  filterActivities,
  getActivity,
  getActivityOrganiserName,
  getActivityRecommendations,
  getMyActivityParticipation,
  joinActivity,
  leaveActivity,
  listActivities,
  listActivityRatings,
  listMyActivities,
  listMyActivityCollections,
  saveActivity,
  submitActivityRating,
  unsaveActivity,
  updateActivity,
  type CommunityLinkClient,
} from '@communitylink/shared';

import type { ActivityService } from '../types';
import { call } from './errors';
import { listActivityImages } from './uploads';

async function withImages(
  client: CommunityLinkClient,
  activity: Awaited<ReturnType<typeof getActivity>>,
) {
  if (!activity) return activity;
  const images = await listActivityImages(activity.organiser_id, activity.id);
  return { ...activity, image_urls: images.map((image) => image.uri) };
}

/** ActivityService on P2's @communitylink/shared functions (README "For P2"). */
export function createSupabaseActivities(client: CommunityLinkClient): ActivityService {
  return {
    // Recommendations come from the raw activity rows, so attach uploaded images
    // here too or Home's "Recommended for you" cards fall back to the category photo.
    getRecommendations: (o) =>
      call(async () => {
        const result = await getActivityRecommendations(client, o);
        const recommendations = await Promise.all(
          result.recommendations.map(async (rec) => ({
            ...rec,
            activity: (await withImages(client, rec.activity)) ?? rec.activity,
          })),
        );
        return { ...result, recommendations };
      }),
    listActivities: (f) =>
      call(async () => {
        const rows = filterActivities(await listActivities(client), f ?? {});
        const loaded = await Promise.all(rows.map((activity) => withImages(client, activity)));
        return loaded.filter((activity): activity is NonNullable<typeof activity> => !!activity);
      }),
    getActivity: (id) => call(async () => withImages(client, await getActivity(client, id))),
    getOrganiserName: (a) => call(() => getActivityOrganiserName(client, a)),
    getParticipation: (id) => call(() => getMyActivityParticipation(client, id)),
    save: (id) => call(() => saveActivity(client, id)),
    unsave: (id) => call(() => unsaveActivity(client, id)),
    join: (id) => call(() => joinActivity(client, id)),
    leave: (id) => call(() => leaveActivity(client, id)),
    // The review list needs reviewers' public display names, which the rating rows don't carry.
    listRatings: (id) =>
      call(async () => {
        const rows = await listActivityRatings(client, id);
        const ids = [...new Set(rows.map((r) => r.user_id))];
        const { data } = ids.length
          ? await client.from('profiles').select('id, display_name').in('id', ids)
          : { data: [] };
        const names = new Map((data ?? []).map((p) => [p.id, p.display_name]));
        return rows.map((r) => ({ ...r, reviewer_name: names.get(r.user_id) ?? null }));
      }),
    // Attach each activity's uploaded images so rows show the first one as the cover.
    // An activity can appear in several lists (saved + joined), so load each only once.
    listMine: () =>
      call(async () => {
        const lists = await listMyActivityCollections(client);
        const cards = [...lists.saved, ...lists.joined, ...lists.history];
        const byId = new Map(cards.map((card) => [card.activity.id, card.activity]));
        const loaded = new Map(
          await Promise.all(
            [...byId.values()].map(
              async (activity) => [activity.id, await withImages(client, activity)] as const,
            ),
          ),
        );
        const attach = (list: typeof cards) =>
          list.map((card) => ({
            ...card,
            activity: loaded.get(card.activity.id) ?? card.activity,
          }));
        return {
          saved: attach(lists.saved),
          joined: attach(lists.joined),
          history: attach(lists.history),
        };
      }),
    createDiscoverySession: (ids) =>
      call(async () => {
        const session = await createActivityDiscoverySession(client, ids);
        return {
          get excludedActivityIds() {
            return session.excludedActivityIds;
          },
          // Attach uploaded images so Discover cards show the first one, not the category photo.
          load: (o) =>
            call(async () => {
              const rows = await session.load(o);
              return Promise.all(
                rows.map(async (activity) => (await withImages(client, activity)) ?? activity),
              );
            }),
          act: (id, action) => call(() => session.act(id, action)),
        };
      }),
    rate: (id, input) =>
      call(async () => {
        await submitActivityRating(client, id, input);
      }),
    listOrganised: () => call(() => listMyActivities(client)),
    create: (input) => call(() => createActivity(client, input)),
    update: (id, input, at) => call(() => updateActivity(client, id, input, at)),
    cancel: (id, reason, at) => call(() => cancelActivity(client, id, reason, at)),
  };
}
