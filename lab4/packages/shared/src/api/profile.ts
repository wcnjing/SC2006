import type { Neighbourhood, Profile, ProfileUpdate } from '../types';
import { validateDisplayName } from '../validation';
import { ApiError, unwrap, type CommunityLinkClient } from './client';
import { requireUserId } from './auth';

export async function getMyProfile(client: CommunityLinkClient): Promise<Profile> {
  const userId = await requireUserId(client);
  return getProfile(client, userId);
}

export async function getProfile(client: CommunityLinkClient, userId: string): Promise<Profile> {
  return unwrap(await client.from('profiles').select('*').eq('id', userId).single());
}

export async function updateMyProfile(
  client: CommunityLinkClient,
  patch: ProfileUpdate,
): Promise<Profile> {
  if (patch.display_name !== undefined) {
    const invalid = validateDisplayName(patch.display_name);
    if (invalid) throw new ApiError(invalid, 'validation');
    patch = { ...patch, display_name: patch.display_name.trim() };
  }
  const userId = await requireUserId(client);
  return unwrap(await client.from('profiles').update(patch).eq('id', userId).select('*').single());
}

export interface OnboardingInput {
  neighbourhoodId: number;
  interests: string[];
  accessibilityNeeds: string[];
  preferredLanguage: string;
}

// FR 2: profile setup after first login.
export async function completeOnboarding(
  client: CommunityLinkClient,
  input: OnboardingInput,
): Promise<Profile> {
  return updateMyProfile(client, {
    neighbourhood_id: input.neighbourhoodId,
    interests: input.interests,
    accessibility_needs: input.accessibilityNeeds,
    preferred_language: input.preferredLanguage,
    onboarded: true,
  });
}

export async function listNeighbourhoods(client: CommunityLinkClient): Promise<Neighbourhood[]> {
  return unwrap(await client.from('neighbourhoods').select('*').order('name'));
}
