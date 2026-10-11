import type { Activity, Profile } from '../types';
import { ApiError, unwrap, type CommunityLinkClient } from './client';

export async function listActivities(
  client: CommunityLinkClient,
  options?: { signal?: AbortSignal },
): Promise<Activity[]> {
  const activities: Activity[] = [];
  const startsAfter = new Date().toISOString();
  const pageSize = 500;
  while (true) {
    const query = client
      .from('activities')
      .select('*')
      .eq('status', 'scheduled')
      .gte('starts_at', startsAfter)
      .order('starts_at')
      .order('id')
      .range(activities.length, activities.length + pageSize - 1);
    const page = unwrap(await (options?.signal ? query.abortSignal(options.signal) : query));
    if (!page.length) return activities;
    activities.push(...page);
    // Continue until empty, even if the server's configured row cap is lower
    // than pageSize. Otherwise client-side filters silently miss later activities.
  }
}

export async function getActivity(
  client: CommunityLinkClient,
  id: string,
): Promise<Activity | null> {
  validateActivityId(id);
  return unwrap(await client.from('activities').select('*').eq('id', id).maybeSingle());
}

// Retrieve only the public-facing name; never load private profile fields.
export async function getActivityOrganiserName(
  client: CommunityLinkClient,
  activity: Pick<Activity, 'source' | 'organiser_id'>,
): Promise<string | null> {
  if (activity.source !== 'organiser' || !activity.organiser_id) return null;
  const profile = unwrap<Pick<Profile, 'display_name'> | null>(
    await client
      .from('profiles')
      .select('display_name')
      .eq('id', activity.organiser_id)
      .maybeSingle(),
  );
  return profile?.display_name.trim() || null;
}

export interface ActivityFilters {
  keyword?: string;
  category?: string;
  location?: string;
  neighbourhoodId?: number;
  dateFrom?: string;
  dateTo?: string;
  accessibility?: string[];
  environment?: 'indoor' | 'outdoor';
  distance?: { origin: { lat: number; lng: number }; maxKm: number };
}

export function validCoordinates(point: { lat: number | null; lng: number | null }): boolean {
  return (
    point.lat !== null &&
    point.lng !== null &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  );
}

// Great-circle distance, not walking/driving distance. No geocoding or external service.
export function activityDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const h =
    Math.sin(radians(b.lat - a.lat) / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(radians(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function activityFilterError(filters: ActivityFilters): string | null {
  for (const value of [filters.dateFrom, filters.dateTo]) {
    if (!value) continue;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value
    )
      return 'Enter valid dates as YYYY-MM-DD.';
  }
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo)
    return 'From date must be on or before to date.';
  if (
    filters.distance &&
    (!validCoordinates(filters.distance.origin) ||
      !Number.isFinite(filters.distance.maxKm) ||
      filters.distance.maxKm <= 0)
  )
    return 'Distance requires a valid location and a positive radius.';
  return null;
}

// Filter the upcoming activities returned by listActivities without another request.
export function filterActivities<
  T extends Pick<
    Activity,
    'title' | 'description' | 'tags' | 'category' | 'location_name' | 'address'
  > &
    Partial<
      Pick<
        Activity,
        'neighbourhood_id' | 'starts_at' | 'accessibility_features' | 'is_outdoor' | 'lat' | 'lng'
      >
    >,
>(activities: readonly T[], filters: ActivityFilters): T[] {
  if (activityFilterError(filters)) return [];
  const keyword = filters.keyword?.trim().toLowerCase() ?? '';
  const category = filters.category?.trim().toLowerCase() ?? '';
  const location = filters.location?.trim().toLowerCase() ?? '';
  const dateFormatter =
    filters.dateFrom || filters.dateTo
      ? new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Singapore',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
      : null;
  return activities.filter((activity) => {
    // Calendar dates are Singapore dates, independent of the visitor's timezone.
    const start = new Date(activity.starts_at ?? '');
    const parts =
      dateFormatter && Number.isFinite(start.getTime()) ? dateFormatter.formatToParts(start) : [];
    const date = parts.length
      ? ['year', 'month', 'day']
          .map((type) => parts.find((part) => part.type === type)!.value)
          .join('-')
      : '';
    const features = (activity.accessibility_features ?? []).map((value) =>
      value.trim().toLowerCase(),
    );
    const point = { lat: activity.lat ?? null, lng: activity.lng ?? null };
    return (
      (!keyword ||
        [activity.title, activity.description, ...activity.tags].some((value) =>
          value.toLowerCase().includes(keyword),
        )) &&
      (!category || activity.category.trim().toLowerCase() === category) &&
      (!location ||
        [activity.location_name, activity.address ?? ''].some((value) =>
          value.toLowerCase().includes(location),
        )) &&
      (filters.neighbourhoodId === undefined ||
        activity.neighbourhood_id === filters.neighbourhoodId) &&
      (!filters.dateFrom || (!!date && date >= filters.dateFrom)) &&
      (!filters.dateTo || (!!date && date <= filters.dateTo)) &&
      (!filters.accessibility?.length ||
        filters.accessibility.every((value) => features.includes(value.trim().toLowerCase()))) &&
      (!filters.environment || activity.is_outdoor === (filters.environment === 'outdoor')) &&
      (!filters.distance ||
        (validCoordinates(point) &&
          activityDistanceKm(filters.distance.origin, { lat: point.lat!, lng: point.lng! }) <=
            filters.distance.maxKm))
    );
  });
}

export function validateActivityId(id: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ApiError('Invalid activity ID.', 'validation');
  }
}
