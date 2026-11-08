import {
  ApiError,
  getMyProfile,
  setUserStatus,
  type CommunityLinkClient,
} from '@communitylink/shared';

import { ServiceError, type AdminService } from '../types';
import { call } from './errors';

export function createSupabaseAdmin(client: CommunityLinkClient): AdminService {
  return {
    listUsers: () =>
      call(async () => {
        const actor = await getMyProfile(client);
        if (actor.role !== 'admin' || actor.status !== 'active')
          throw new ServiceError('FORBIDDEN');
        // Fetch every page rather than silently truncating at the Data API row limit.
        const users = [];
        for (let offset = 0; ; offset += 200) {
          const { data, error } = await client
            .from('profiles')
            .select('id, display_name, avatar_url, role, status, suspended_reason')
            .order('id')
            .range(offset, offset + 199);
          if (error) throw new ApiError(error.message, error.code);
          users.push(
            ...(data ?? []).map((row) => ({
              id: row.id,
              displayName: row.display_name,
              avatarUrl: row.avatar_url,
              role: row.role,
              status: row.status,
              reason: row.suspended_reason,
            })),
          );
          if (!data || data.length < 200) return users;
        }
      }),
    setStatus: (id, status, reason) =>
      call(() => setUserStatus(client, id, status, reason?.trim())),
  };
}
