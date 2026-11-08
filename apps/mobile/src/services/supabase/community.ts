import * as shared from '@communitylink/shared';

import { COMMUNITY_API, type CommunityService } from '../types';
import { call } from './errors';

/** CommunityService on P3's @communitylink/shared functions: each one with the client bound. */
export function createSupabaseCommunity(client: shared.CommunityLinkClient): CommunityService {
  const api = shared as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
  return Object.fromEntries(
    COMMUNITY_API.map((name) => [
      name,
      (...args: unknown[]) => call(() => api[name](client, ...args)),
    ]),
  ) as CommunityService;
}
