import type { Activity, Profile } from '../types';
import { hasRole } from '../rbac';
import { requireUserId } from './auth';
import { getProfile } from './profile';
import { getActivity, validCoordinates, validateActivityId } from './activities';
import { ApiError, unwrap, type CommunityLinkClient } from './client';

export type ActivityInput = Pick<
  Activity,
  | 'title'
  | 'description'
  | 'category'
  | 'location_name'
  | 'address'
  | 'starts_at'
  | 'ends_at'
  | 'capacity'
  | 'is_outdoor'
  | 'cost_cents'
  | 'accessibility_features'
  | 'tags'
  | 'lat'
  | 'lng'
>;

export function canManageActivity(
  profile: Pick<Profile, 'id' | 'role' | 'status'> | null,
  userId: string | undefined,
  activity?: Pick<Activity, 'organiser_id' | 'source'>,
): boolean {
  return (
    !!profile &&
    profile.id === userId &&
    hasRole(profile, 'organiser') &&
    (!activity || (activity.organiser_id === profile.id && activity.source === 'organiser'))
  );
}

function validTimestamp(value: string): boolean {
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/i.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const day = new Date(`${match[1]}T00:00:00Z`);
  return (
    Number.isFinite(day.getTime()) &&
    day.toISOString().slice(0, 10) === match[1] &&
    Number(match[2]) < 24 &&
    Number(match[3]) < 60 &&
    Number(match[4] ?? 0) < 60
  );
}

export function validateActivityInput(input: ActivityInput, now = Date.now()): ActivityInput {
  const clean = {
    ...input,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category.trim(),
    location_name: input.location_name.trim(),
    address: input.address?.trim() || null,
    tags: [...new Set(input.tags.map((value) => value.trim()).filter(Boolean))],
    accessibility_features: [
      ...new Set(input.accessibility_features.map((value) => value.trim()).filter(Boolean)),
    ],
  };
  const fail = (message: string): never => {
    throw new ApiError(message, 'validation');
  };
  if (clean.title.length < 3 || clean.title.length > 120)
    fail('Activity name must be 3–120 characters.');
  if (!clean.description) fail('Description is required.');
  if (!clean.category) fail('Category is required.');
  if (!clean.location_name) fail('Location is required.');
  const start = Date.parse(clean.starts_at),
    end = Date.parse(clean.ends_at);
  if (!validTimestamp(clean.starts_at) || !validTimestamp(clean.ends_at))
    fail('Valid start and end date/time are required.');
  if (start <= now) fail('Start date/time must be in the future.');
  if (end <= start) fail('End date/time must be after the start.');
  if (
    clean.capacity !== null &&
    (!Number.isInteger(clean.capacity) || clean.capacity <= 0 || clean.capacity > 2147483647)
  )
    fail('Capacity must be a positive whole number or left blank.');
  if (!Number.isInteger(clean.cost_cents) || clean.cost_cents < 0 || clean.cost_cents > 2147483647)
    fail('Cost must be a non-negative whole number of cents.');
  if ((clean.lat !== null || clean.lng !== null) && !validCoordinates(clean))
    fail('Provide both valid latitude and longitude, or leave both blank.');
  return {
    ...clean,
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(end).toISOString(),
  };
}

async function requireOrganiser(client: CommunityLinkClient): Promise<string> {
  const id = await requireUserId(client);
  const profile = await getProfile(client, id);
  if (!canManageActivity(profile, id))
    throw new ApiError('An active organiser account is required.', 'forbidden');
  return id;
}

async function ownActivity(
  client: CommunityLinkClient,
  id: string,
  organiserId: string,
): Promise<Activity> {
  const activity = await getActivity(client, id);
  if (!activity || activity.organiser_id !== organiserId || activity.source !== 'organiser')
    throw new ApiError('You can only manage your own organiser activities.', 'forbidden');
  if (activity.status !== 'scheduled')
    throw new ApiError('Only scheduled activities can be managed.', 'validation');
  return activity;
}

export async function createActivity(
  client: CommunityLinkClient,
  input: ActivityInput,
): Promise<Activity> {
  const clean = validateActivityInput(input);
  const organiserId = await requireOrganiser(client);
  // Explicit allow-list: never accept ownership, source, status or generated columns from callers.
  return unwrap(
    await client
      .from('activities')
      .insert({
        ...editableColumns(clean),
        organiser_id: organiserId,
        source: 'organiser',
        status: 'scheduled',
      })
      .select('*')
      .single(),
  );
}

function editableColumns(input: ActivityInput): ActivityInput {
  const {
    title,
    description,
    category,
    location_name,
    address,
    starts_at,
    ends_at,
    capacity,
    is_outdoor,
    cost_cents,
    accessibility_features,
    tags,
    lat,
    lng,
  } = input;
  return {
    title,
    description,
    category,
    location_name,
    address,
    starts_at,
    ends_at,
    capacity,
    is_outdoor,
    cost_cents,
    accessibility_features,
    tags,
    lat,
    lng,
  };
}

export async function updateActivity(
  client: CommunityLinkClient,
  id: string,
  input: ActivityInput,
  expectedUpdatedAt?: string,
): Promise<Activity> {
  validateActivityId(id);
  const clean = validateActivityInput(input);
  const organiserId = await requireOrganiser(client);
  const activity = await ownActivity(client, id, organiserId);
  if (expectedUpdatedAt && activity.updated_at !== expectedUpdatedAt)
    throw new ApiError('Activity changed. Reopen it before editing.', 'conflict');
  if (Date.parse(activity.starts_at) <= Date.now())
    throw new ApiError('Activities cannot be edited after they start.', 'validation');
  const count = await client
    .from('activity_participants')
    .select('activity_id', { count: 'exact', head: true })
    .eq('activity_id', id)
    .eq('status', 'joined');
  if (count.error) unwrap(count);
  if (count.count === null)
    throw new ApiError('Unable to verify the joined participant count. Try again.');
  if (clean.capacity !== null && clean.capacity < count.count)
    throw new ApiError(
      `Capacity cannot be below the ${count.count} joined participants.`,
      'validation',
    );
  // Client checks improve feedback; RLS and triggers are the security/concurrency boundary.
  const result = unwrap(
    await client
      .from('activities')
      .update(editableColumns(clean))
      .eq('id', id)
      .eq('organiser_id', organiserId)
      .eq('status', 'scheduled')
      .gt('starts_at', new Date().toISOString())
      .eq('updated_at', activity.updated_at)
      .select('*')
      .maybeSingle(),
  );
  if (!result)
    throw new ApiError(
      'Activity changed or is no longer editable. Reopen it and try again.',
      'conflict',
    );
  return result;
}

export async function cancelActivity(
  client: CommunityLinkClient,
  id: string,
  reason: string,
  expectedUpdatedAt?: string,
): Promise<Activity> {
  validateActivityId(id);
  const cancelled_reason = reason.trim();
  if (!cancelled_reason) throw new ApiError('A cancellation reason is required.', 'validation');
  const organiserId = await requireOrganiser(client);
  const activity = await ownActivity(client, id, organiserId);
  if (expectedUpdatedAt && activity.updated_at !== expectedUpdatedAt)
    throw new ApiError('Activity changed. Reopen it before cancelling.', 'conflict');
  const now = Date.now();
  if (Date.parse(activity.starts_at) <= now)
    throw new ApiError('This activity has already started and cannot be cancelled.', 'validation');
  const result = unwrap(
    await client
      .from('activities')
      .update({ status: 'cancelled', cancelled_reason })
      .gt('starts_at', new Date(now).toISOString())
      .eq('id', id)
      .eq('organiser_id', organiserId)
      .eq('status', 'scheduled')
      .eq('updated_at', activity.updated_at)
      .select('*')
      .maybeSingle(),
  );
  if (!result)
    throw new ApiError(
      'Activity changed, has already started or is already cancelled. Reopen it and try again.',
      'conflict',
    );
  return result;
}

export async function listMyActivities(client: CommunityLinkClient): Promise<Activity[]> {
  const organiserId = await requireOrganiser(client);
  const rows: Activity[] = [];
  while (true) {
    const page = unwrap(
      await client
        .from('activities')
        .select('*')
        .eq('organiser_id', organiserId)
        .eq('source', 'organiser')
        .order('starts_at')
        .order('id')
        .range(rows.length, rows.length + 499),
    );
    if (!page.length) return rows;
    rows.push(...page);
  }
}
