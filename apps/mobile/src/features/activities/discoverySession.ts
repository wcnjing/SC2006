import { activityService, type ActivityDiscoverySession } from '@/services';

/**
 * One Discover browsing session per login (P2: "create once per resident
 * browsing session, never globally"). Keyed by the session token, so a new
 * login, or a different user on the same device, always starts fresh.
 * It survives tab switches and leaving Discover, which is what FR 3.2.5
 * ("same browsing session") needs.
 */
let cached: { token: string; session: Promise<ActivityDiscoverySession> } | null = null;

export function getDiscoverySession(token: string): Promise<ActivityDiscoverySession> {
  if (cached?.token !== token) {
    const session = activityService.createDiscoverySession();
    cached = { token, session };
    // Don't cache a failed start; the next call retries.
    session.catch(() => {
      if (cached?.session === session) cached = null;
    });
  }
  return cached.session;
}
