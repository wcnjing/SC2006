import { listNeighbourhoods, type CommunityLinkClient, type Profile } from '@communitylink/shared';
import type { Session as AuthSession } from '@supabase/supabase-js';

import { NEIGHBOURHOODS } from '@/config/catalog';
import type { Session, UserAccount, UserProfile } from '@/types/models';

const slugify = (name: string) => name.trim().toLowerCase().replace(/\s+/g, '-');

let hoodCache: Promise<{ slugById: Map<number, string>; idBySlug: Map<string, number> }> | null =
  null;

/**
 * neighbourhoods.id ↔ catalog slug, matched by name ("Toa Payoh" → "toa-payoh").
 * Read from the table instead of trusting serial ids, so it works on any database.
 */
export function neighbourhoodIds(client: CommunityLinkClient) {
  hoodCache ??= listNeighbourhoods(client).then((rows) => {
    const slugById = new Map<number, string>();
    const idBySlug = new Map<string, number>();
    for (const row of rows) {
      const slug = slugify(row.name);
      slugById.set(row.id, slug);
      idBySlug.set(slug, row.id);
    }
    // Fall back to the catalog's dbId for anything the table didn't return.
    for (const n of NEIGHBOURHOODS) if (!idBySlug.has(n.id)) idBySlug.set(n.id, n.dbId);
    return { slugById, idBySlug };
  });
  hoodCache.catch(() => (hoodCache = null));
  return hoodCache;
}

const LANGS = ['en', 'zh', 'ms', 'ta'] as const;

/** P1 `profiles` row → shell UserProfile. Null until onboarding is complete (status 'onboarding'). */
export async function toUserProfile(
  client: CommunityLinkClient,
  p: Profile,
): Promise<UserProfile | null> {
  if (!p.onboarded) return null;
  const { slugById } = await neighbourhoodIds(client);
  return {
    profileId: p.id,
    displayName: p.display_name,
    pictureUrl: p.avatar_url,
    neighbourhoodId: (p.neighbourhood_id !== null && slugById.get(p.neighbourhood_id)) || '',
    interestIds: p.interests,
    accessibilityTagIds: p.accessibility_needs,
    preferredLanguage: (LANGS as readonly string[]).includes(p.preferred_language)
      ? (p.preferred_language as UserProfile['preferredLanguage'])
      : 'en',
    updatedAt: p.updated_at,
  };
}

export function toAccount(auth: AuthSession, p: Profile): UserAccount {
  return {
    accountId: auth.user.id,
    email: auth.user.email ?? null,
    roles: [p.role],
    status: p.status,
    createdAt: p.created_at,
    linkedSingpass: p.singpass_verified,
  };
}

export async function toSession(
  client: CommunityLinkClient,
  auth: AuthSession,
  p: Profile,
): Promise<Session> {
  return {
    account: toAccount(auth, p),
    profile: await toUserProfile(client, p),
    token: auth.access_token,
  };
}
