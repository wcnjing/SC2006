import {
  getMyProfile,
  signIn,
  signOut,
  signUp,
  updateMyProfile,
  type CommunityLinkClient,
} from '@communitylink/shared';
import type { Session as AuthSession } from '@supabase/supabase-js';

import { mockpassAuthUrl } from '@/lib/supabase';
import type { ProfileInput, Session } from '@/types/models';

import { ServiceError, type AuthService, type ProfileService } from '../types';
import { call } from './errors';
import { neighbourhoodIds, toSession, toUserProfile } from './mapping';

/**
 * AuthService / ProfileService on P1's Supabase auth (@communitylink/shared:
 * signUp, signIn, signOut, getMyProfile, updateMyProfile). Email + password,
 * as P1 built it. The profile row is created by P1's handle_new_user trigger;
 * `onboarded = false` sends the user to Complete Your Profile.
 */
export function createSupabaseAuth(client: CommunityLinkClient): {
  auth: AuthService;
  profile: ProfileService;
} {
  /** Load the profile for a fresh Supabase session; suspended accounts are signed straight out (FR 12.1.3). */
  async function sessionFor(authSession: AuthSession): Promise<Session> {
    const profile = await getMyProfile(client);
    if (profile.status === 'suspended') {
      await signOut(client).catch(() => {});
      throw new ServiceError('ACCOUNT_SUSPENDED');
    }
    return toSession(client, authSession, profile);
  }

  const auth: AuthService = {
    register: (email, password) =>
      call(async () => {
        // P1's signUp needs a display name; use the email's first part until
        // Complete Your Profile sets the real one (P1's trigger does the same).
        const authSession = await signUp(client, {
          email,
          password,
          displayName: email.trim().split('@')[0] || 'Resident',
        });
        // Null when the Supabase project has email confirmation switched on.
        if (!authSession) throw new ServiceError('CONFIRM_EMAIL');
        return sessionFor(authSession);
      }),

    login: (email, password) =>
      call(async () => sessionFor(await signIn(client, { email, password }))),

    singpassStartUrl: () =>
      mockpassAuthUrl ? `${mockpassAuthUrl.replace(/\/$/, '')}/auth/mockpass/start` : null,

    completeSingpassRedirect: ({ accessToken, refreshToken }) =>
      call(async () => {
        const { data, error } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error || !data.session) throw new ServiceError('SINGPASS_FAILED');
        const session = await sessionFor(data.session);
        const raw = await getMyProfile(client);
        // Xavier's bridge names new users "Mockpass user S1234567A"; don't prefill that.
        const name = raw.display_name.startsWith('Mockpass user') ? null : raw.display_name;
        return { session, isNew: !raw.onboarded, displayName: name };
      }),

    // The in-app mock consent screen only exists for the mock backend.
    loginWithSingpass: async () => {
      throw new ServiceError('SINGPASS_FAILED');
    },

    restore: async () => {
      try {
        const { data } = await client.auth.getSession();
        return data.session ? await sessionFor(data.session) : null;
      } catch {
        return null;
      }
    },

    logout: () => call(() => signOut(client)),
  };

  const profile: ProfileService = {
    saveProfile: (_accountId, input: ProfileInput) =>
      call(async () => {
        const { idBySlug } = await neighbourhoodIds(client);
        const neighbourhoodId = idBySlug.get(input.neighbourhoodId);
        if (neighbourhoodId === undefined) throw new ServiceError('NOT_FOUND');
        // FR 2.1 / 2.2: one update, so a failed save leaves no partial profile.
        const row = await updateMyProfile(client, {
          display_name: input.displayName,
          avatar_url: input.pictureUrl,
          neighbourhood_id: neighbourhoodId,
          interests: input.interestIds,
          accessibility_needs: input.accessibilityTagIds,
          preferred_language: input.preferredLanguage,
          onboarded: true,
        });
        const mapped = await toUserProfile(client, row);
        if (!mapped) throw new ServiceError('NOT_FOUND');
        return mapped;
      }),

    /**
     * Upload to a Supabase Storage bucket named "avatars" (public read). P1's
     * migrations don't create one yet; until they do this throws UPLOAD_FAILED
     * and the form asks the user to save without a photo.
     */
    uploadAvatar: (accountId, localUri) =>
      call(async () => {
        if (/^https?:\/\//.test(localUri)) return localUri; // already uploaded
        try {
          const blob = await (await fetch(localUri)).blob();
          const ext = blob.type.split('/')[1] ?? 'jpg';
          const path = `${accountId}/${Date.now()}.${ext}`;
          const { error } = await client.storage
            .from('avatars')
            .upload(path, blob, { contentType: blob.type, upsert: true });
          if (error) throw error;
          return client.storage.from('avatars').getPublicUrl(path).data.publicUrl;
        } catch {
          throw new ServiceError('UPLOAD_FAILED');
        }
      }),
  };

  return { auth, profile };
}
