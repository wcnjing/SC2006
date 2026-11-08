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

/** ActivityService on P2's @communitylink/shared functions (README "For P2"). */
export function createSupabaseActivities(client: CommunityLinkClient): ActivityService {
  return {
    getRecommendations: (o) => call(() => getActivityRecommendations(client, o)),
    listActivities: (f) =>
      call(async () => filterActivities(await listActivities(client), f ?? {})),
    getActivity: (id) => call(() => getActivity(client, id)),
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
    listMine: () => call(() => listMyActivityCollections(client)),
    createDiscoverySession: (ids) =>
      call(async () => {
        const session = await createActivityDiscoverySession(client, ids);
        return {
          get excludedActivityIds() {
            return session.excludedActivityIds;
          },
          load: (o) => call(() => session.load(o)),
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
