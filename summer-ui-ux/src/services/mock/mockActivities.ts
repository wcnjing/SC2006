import { findNeighbourhood } from '@/config/catalog';
import { distanceKm, hasCoordinates } from '@/lib/geo';
import { readJSON, writeJSON } from '@/lib/storage';
import type {
  Activity,
  ActivityFilters,
  ActivityRating,
  ActivityRecommendation,
  MyActivityCard,
  RecommendationOrigin,
  UserAccount,
  UserProfile,
} from '@/types/models';

import { ServiceError, type ActivityDiscoverySession, type ActivityService } from '../types';
import { currentMockUser } from './mockBackend';

type CurrentUser = () => Promise<{ account: UserAccount; profile: UserProfile | null }>;

/**
 * Who is logged in. The mock auth backend by default; with Supabase login
 * (before P2's API is wired in) it is the real Supabase user, so activity
 * data is mocked but saves and joins belong to the real account.
 */
let currentUser: CurrentUser = currentMockUser;
export const setMockActivityUser = (fn: CurrentUser) => {
  currentUser = fn;
};

/**
 * In-device stand-in for P2's activity API (@communitylink/shared, `shyanne`
 * branch). Behaviour follows P2's code and docs/p2-*.md:
 *  - only upcoming `scheduled` activities are listed / swiped / recommended
 *  - Like/Save = bookmark (never a registration); Skip = own `skipped` row
 *  - Join checks status, start time and capacity; Leave frees the seat
 *  - recommendations use P2's ranking (accessibility needs are hard filters)
 *
 * Activities are rebuilt on every launch relative to today, so "upcoming"
 * and "past" stay correct whenever the demo runs. Only each user's own
 * decisions (bookmarks, joins, skips, ratings) are persisted.
 */

const STATE_KEY = 'mock-activity-state-v1';
const LATENCY_MS = 350;
const delay = (ms = LATENCY_MS) => new Promise((r) => setTimeout(r, ms));

/* ----------------------------- seed activities ---------------------------- */

const SGT_OFFSET_H = 8;
/** ISO time for `dayOffset` days from today at hh:mm Singapore time. */
function sgt(dayOffset: number, hour: number, minute = 0): string {
  const nowSg = new Date(Date.now() + SGT_OFFSET_H * 3600_000);
  return new Date(
    Date.UTC(
      nowSg.getUTCFullYear(),
      nowSg.getUTCMonth(),
      nowSg.getUTCDate() + dayOffset,
      hour - SGT_OFFSET_H,
      minute,
    ),
  ).toISOString();
}

const uuid = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tampines = findNeighbourhood('tampines')!;
const hoodDbId = (id: string) => findNeighbourhood(id)!.dbId;

const ORGANISERS: Record<string, string> = {
  'org-tampines-cc': 'Tampines Community Club',
  'org-tampines-west': 'Tampines West CC',
  'org-ourtampineshub': 'Our Tampines Hub',
  'org-bedok-cc': 'Bedok Community Centre',
};

type Seed = Partial<Activity> &
  Pick<Activity, 'title' | 'description' | 'category' | 'location_name'> & {
    n: number;
    day: number;
    start: [number, number];
    end: [number, number];
    /** Offset from the Tampines centre in degrees (~111 m per 0.001). */
    near?: [number, number];
    hood?: string;
    /** Other residents already joined (the mock has no other real users). */
    othersJoined?: number;
  };

const SEEDS: Seed[] = [
  {
    n: 1,
    title: 'Community Gardening',
    category: 'gardening',
    tags: ['outdoors', 'volunteering'],
    accessibility_features: ['wheelchair-access', 'elderly-friendly'],
    is_outdoor: true,
    location_name: 'Tampines Community Garden (Block 412)',
    address: '412 Tampines Street 41, Singapore 520412',
    near: [0.0035, -0.0012],
    organiser_id: 'org-tampines-cc',
    day: 3,
    start: [9, 0],
    end: [11, 0],
    capacity: 20,
    othersJoined: 12,
    description:
      'Get your hands green! Join us for a relaxing morning of planting. No gardening experience is needed and all ages are welcome. Tools, gloves and materials will be provided.',
  },
  {
    n: 2,
    title: 'Morning Yoga',
    category: 'wellness',
    tags: ['fitness', 'outdoors'],
    accessibility_features: ['elderly-friendly', 'low-intensity'],
    is_outdoor: true,
    location_name: 'Tampines Community Club',
    address: '1 Tampines Walk, Singapore 528523',
    near: [0.0052, 0.0047],
    organiser_id: 'org-tampines-cc',
    day: 5,
    start: [8, 30],
    end: [10, 0],
    capacity: 25,
    othersJoined: 9,
    description:
      'Come join us for a relaxing yoga session to unwind and meet new friends! All experience levels are welcome. Bring a mat and a water bottle.',
  },
  {
    n: 3,
    title: 'Art Workshop',
    category: 'arts-crafts',
    tags: ['learning', 'social'],
    accessibility_features: ['wheelchair-access', 'elderly-friendly'],
    is_outdoor: false,
    location_name: 'Tampines Community Club',
    address: '1 Tampines Walk, Singapore 528523',
    near: [0.0052, 0.0047],
    organiser_id: 'org-tampines-cc',
    day: 8,
    start: [9, 0],
    end: [12, 0],
    capacity: 15,
    othersJoined: 6,
    description:
      'Try watercolour painting with a local artist. We will paint the Tampines skyline together, step by step. All materials provided.',
  },
  {
    n: 4,
    title: 'Community Badminton',
    category: 'sports',
    tags: ['social', 'fitness'],
    accessibility_features: [],
    is_outdoor: false,
    location_name: 'Tampines Sports Hall',
    address: '1 Tampines Walk, Level 4, Singapore 528523',
    near: [-0.0085, 0.0062],
    organiser_id: 'org-ourtampineshub',
    day: 2,
    start: [19, 0],
    end: [21, 0],
    capacity: 16,
    othersJoined: 10,
    description:
      'Friendly doubles games for intermediate players. Rackets are available to borrow. Shuttlecocks provided.',
  },
  {
    n: 5,
    title: 'Pickleball Lesson',
    category: 'sports',
    tags: ['learning'],
    accessibility_features: ['low-intensity'],
    is_outdoor: true,
    location_name: 'Pickleball Court @ Our Tampines Hub',
    address: '1 Tampines Walk, Singapore 528523',
    near: [0.0049, 0.0051],
    organiser_id: 'org-ourtampineshub',
    day: 6,
    start: [9, 0],
    end: [10, 30],
    capacity: 12,
    othersJoined: 12,
    description:
      'Learn the basics of pickleball, the fastest-growing sport in Singapore. Paddles and balls provided.',
  },
  {
    n: 6,
    title: 'Kopi & Chat for Seniors',
    category: 'social',
    tags: ['wellness'],
    accessibility_features: ['wheelchair-access', 'elderly-friendly', 'low-intensity'],
    is_outdoor: false,
    location_name: 'Tampines West Community Club',
    address: '5 Tampines Avenue 3, Singapore 529705',
    near: [0.0021, -0.0098],
    organiser_id: 'org-tampines-west',
    day: 1,
    start: [15, 0],
    end: [16, 30],
    capacity: 10,
    othersJoined: 10,
    description:
      'An easy afternoon of kopi, kueh and conversation. A great way to meet neighbours. Volunteers will be there to say hello.',
  },
  {
    n: 7,
    title: 'Beach Clean-up',
    category: 'volunteering',
    tags: ['outdoors'],
    accessibility_features: [],
    is_outdoor: true,
    location_name: 'Pasir Ris Beach Park',
    address: 'Pasir Ris Road, Singapore 519113',
    hood: 'pasir-ris',
    near: [0.0261, -0.0055],
    organiser_id: 'org-tampines-cc',
    day: 4,
    start: [8, 0],
    end: [10, 30],
    capacity: 40,
    othersJoined: 18,
    description:
      'Help keep our coastline clean. Gloves, trash bags and refreshments provided. Wear comfortable shoes and a hat.',
  },
  {
    n: 8,
    title: 'Tampines Heritage Walk',
    category: 'outdoors',
    tags: ['learning', 'social'],
    accessibility_features: ['elderly-friendly', 'low-intensity'],
    is_outdoor: true,
    location_name: 'Tampines Eco Green',
    address: 'Tampines Avenue 12, Singapore 529138',
    near: [0.0128, -0.0041],
    source: 'dataset',
    external_id: 'datagov-heritage-trail-tampines',
    day: 7,
    start: [17, 0],
    end: [18, 30],
    capacity: null,
    othersJoined: 7,
    description:
      'A gentle guided walk through the history of Tampines, from its kampong days to the modern town. Listed from the National Heritage Board heritage trails dataset.',
  },
  {
    n: 9,
    title: 'Healthy Cooking Class',
    category: 'cooking',
    tags: ['wellness', 'learning'],
    accessibility_features: ['wheelchair-access', 'elderly-friendly'],
    is_outdoor: false,
    location_name: 'Tampines North Community Club',
    address: '2 Tampines Street 41, Singapore 529204',
    near: [0.0168, -0.0028],
    organiser_id: 'org-tampines-cc',
    day: 9,
    start: [10, 0],
    end: [12, 0],
    capacity: 12,
    othersJoined: 4,
    cost_cents: 500,
    description:
      'Cook three low-salt, low-sugar local dishes with a dietitian. Take home the recipes and what you cook. $5 covers ingredients.',
  },
  {
    n: 10,
    title: 'Smartphone Basics for Seniors',
    category: 'technology',
    tags: ['learning'],
    accessibility_features: ['elderly-friendly', 'low-intensity', 'hearing-support'],
    is_outdoor: false,
    location_name: 'Tampines Regional Library',
    address: '1 Tampines Walk, Level 2, Singapore 528523',
    near: [0.0049, 0.0049],
    organiser_id: 'org-ourtampineshub',
    day: 2,
    start: [14, 0],
    end: [15, 30],
    capacity: 15,
    othersJoined: 11,
    description:
      'Learn to video call your family, use WhatsApp and stay safe from scams. Bring your own phone. Hearing loops available.',
  },
  {
    n: 11,
    title: 'Karaoke Afternoon',
    category: 'music',
    tags: ['social'],
    accessibility_features: ['elderly-friendly', 'wheelchair-access'],
    is_outdoor: false,
    location_name: 'Bedok Community Centre',
    address: '850 New Upper Changi Road, Singapore 467352',
    hood: 'bedok',
    near: [-0.0262, -0.0295],
    organiser_id: 'org-bedok-cc',
    day: 10,
    start: [14, 0],
    end: [17, 0],
    capacity: 30,
    othersJoined: 21,
    description: 'Sing your favourite evergreen hits with friends old and new. Song list provided.',
  },
  {
    n: 12,
    title: 'Board Games Night',
    category: 'games',
    tags: ['social'],
    accessibility_features: ['wheelchair-access'],
    is_outdoor: false,
    location_name: 'Tampines Changkat Community Club',
    address: '13 Tampines Street 11, Singapore 529453',
    near: [-0.0042, -0.0105],
    organiser_id: 'org-tampines-cc',
    day: 3,
    start: [19, 30],
    end: [22, 0],
    capacity: 24,
    othersJoined: 8,
    description:
      'Catan, Ticket to Ride, mahjong and more. Beginners welcome, our volunteers will teach you the rules.',
  },
  {
    n: 13,
    title: 'Tai Chi in the Park',
    category: 'fitness',
    tags: ['wellness', 'outdoors'],
    accessibility_features: ['elderly-friendly', 'low-intensity'],
    is_outdoor: true,
    location_name: 'Tampines Central Park',
    address: 'Tampines Avenue 4, Singapore 529684',
    near: [0.0012, 0.0021],
    organiser_id: 'org-tampines-cc',
    day: 4,
    start: [7, 0],
    end: [8, 0],
    capacity: 30,
    othersJoined: 5,
    status: 'cancelled',
    cancelled_reason: 'The park is closed for maintenance this week.',
    description: 'Gentle tai chi to start the morning. Suitable for beginners and seniors.',
  },
  {
    n: 14,
    title: 'Self-Defence Lesson',
    category: 'fitness',
    tags: ['learning'],
    accessibility_features: ['low-intensity'],
    is_outdoor: false,
    location_name: 'Tampines ActiveSG Gym',
    address: '1 Tampines Walk, Level 3, Singapore 528523',
    near: [0.0049, 0.0049],
    organiser_id: 'org-ourtampineshub',
    day: -5,
    start: [17, 0],
    end: [18, 30],
    capacity: 22,
    othersJoined: 21,
    status: 'completed',
    description: 'Simple, practical self-defence moves taught by a certified instructor.',
  },
  {
    n: 15,
    title: 'Mooncake Making Workshop',
    category: 'cooking',
    tags: ['social', 'arts-crafts'],
    accessibility_features: ['elderly-friendly', 'wheelchair-access'],
    is_outdoor: false,
    location_name: 'Tampines Community Club',
    address: '1 Tampines Walk, Singapore 528523',
    near: [0.0052, 0.0047],
    organiser_id: 'org-tampines-cc',
    day: -12,
    start: [14, 0],
    end: [16, 0],
    capacity: 20,
    othersJoined: 17,
    status: 'completed',
    description: 'Make snowskin mooncakes for the Mid-Autumn Festival and take a box home.',
  },
];

function buildActivity(s: Seed): Activity {
  const hood = findNeighbourhood(s.hood) ?? tampines;
  const [dLat, dLng] = s.near ?? [0, 0];
  const created = sgt(-30, 10);
  return {
    id: uuid(s.n),
    title: s.title,
    description: s.description,
    category: s.category,
    tags: s.tags ?? [],
    accessibility_features: s.accessibility_features ?? [],
    is_outdoor: s.is_outdoor ?? false,
    location_name: s.location_name,
    address: s.address ?? null,
    lat: tampines.lat + dLat,
    lng: tampines.lng + dLng,
    neighbourhood_id: hoodDbId(hood.id),
    organiser_id: s.source === 'dataset' ? null : (s.organiser_id ?? null),
    source: s.source ?? 'organiser',
    starts_at: sgt(s.day, ...s.start),
    ends_at: sgt(s.day, ...s.end),
    status: s.status ?? 'scheduled',
    capacity: s.capacity === undefined ? null : s.capacity,
    cost_cents: s.cost_cents ?? 0,
    cancelled_reason: s.cancelled_reason ?? null,
    external_id: s.external_id ?? null,
    created_at: created,
    updated_at: created,
  };
}

let cachedActivities: Activity[] | null = null;
function allActivities(): Activity[] {
  cachedActivities ??= SEEDS.map(buildActivity);
  return cachedActivities;
}
const othersJoined = (id: string) => SEEDS.find((s) => uuid(s.n) === id)?.othersJoined ?? 0;

/* ----------------------------- seed ratings ------------------------------- */

const REVIEWERS = ['Siti', 'Kumar', 'Xin Yi', 'Jian Hao', 'Auntie Mei', 'Hafiz', 'Priya', 'Ben'];
const COMMENTS = [
  'So relaxing and everyone was friendly. Will come again!',
  'Well organised, and the volunteers were very patient with us.',
  'Good activity, but it started a bit late.',
  'Met two neighbours from my block. Lovely morning.',
  null,
  null,
];

/** Deterministic spread of stars that averages close to `avg`. */
function seededRatings(n: number, count: number, avg: number): ActivityRating[] {
  return Array.from({ length: count }, (_, i) => {
    const low = Math.floor(avg);
    const highShare = avg - low;
    const rating = Math.min(5, (i % 10) / 10 < highShare ? low + 1 : low);
    return {
      activity_id: uuid(n),
      user_id: `seed-user-${i}`,
      rating,
      comment: i < 6 ? COMMENTS[i % COMMENTS.length] : null,
      created_at: sgt(-1 - i, 12),
      reviewer_name: REVIEWERS[i % REVIEWERS.length],
    };
  });
}

const SEED_RATINGS: ActivityRating[] = [
  ...seededRatings(1, 26, 4.5),
  ...seededRatings(2, 12, 4.8),
  ...seededRatings(4, 9, 4.2),
  ...seededRatings(14, 14, 4.4),
  ...seededRatings(15, 8, 4.9),
];

/* ------------------------------ user state -------------------------------- */

type UserState = {
  bookmarks: string[];
  /** Mirrors activity_participants.status for this user. */
  participation: Record<string, 'joined' | 'skipped'>;
  ratings: ActivityRating[];
};
type StateDB = Record<string, UserState>;

/** The demo resident (Mrs Tan, mrstan@test.com) starts with a realistic history, so every My activities tab has content. */
function initialState(email: string | null, accountId: string, name: string): UserState {
  if (email !== 'mrstan@test.com') return { bookmarks: [], participation: {}, ratings: [] };
  return {
    bookmarks: [uuid(2), uuid(13)],
    participation: { [uuid(1)]: 'joined', [uuid(14)]: 'joined', [uuid(15)]: 'joined' },
    ratings: [
      {
        activity_id: uuid(15),
        user_id: accountId,
        rating: 5,
        comment: 'My mooncakes actually looked nice! Thank you to the CC volunteers.',
        created_at: sgt(-11, 20),
        reviewer_name: name,
      },
    ],
  };
}

async function withUser<T>(fn: (state: UserState, accountId: string) => T | Promise<T>) {
  const { account, profile } = await currentUser();
  const db = (await readJSON<StateDB>(STATE_KEY)) ?? {};
  const state = (db[account.accountId] ??= initialState(
    account.email,
    account.accountId,
    profile?.displayName ?? '',
  ));
  const result = await fn(state, account.accountId);
  await writeJSON(STATE_KEY, db);
  return result;
}

const find = (id: string) => allActivities().find((a) => a.id === id) ?? null;
const isUpcoming = (a: Activity, now = Date.now()) =>
  a.status === 'scheduled' && Date.parse(a.starts_at) > now;
const joinedCount = (id: string, state: UserState) =>
  othersJoined(id) + (state.participation[id] === 'joined' ? 1 : 0);

/* --------------------------- filters & ranking ---------------------------- */

const sgDate = (iso: string) =>
  new Date(Date.parse(iso) + SGT_OFFSET_H * 3600_000).toISOString().slice(0, 10);

/** Same semantics as P2's `filterActivities`. */
function applyFilters(list: Activity[], f: ActivityFilters = {}): Activity[] {
  const kw = f.keyword?.trim().toLowerCase();
  return list.filter(
    (a) =>
      (!kw || [a.title, a.description, ...a.tags].some((v) => v.toLowerCase().includes(kw))) &&
      (!f.category || a.category === f.category) &&
      (f.neighbourhoodId === undefined || a.neighbourhood_id === f.neighbourhoodId) &&
      (!f.dateFrom || sgDate(a.starts_at) >= f.dateFrom) &&
      (!f.dateTo || sgDate(a.starts_at) <= f.dateTo) &&
      (!f.accessibility?.length ||
        f.accessibility.every((x) => a.accessibility_features.includes(x))) &&
      (!f.environment || a.is_outdoor === (f.environment === 'outdoor')) &&
      (!f.distance || (hasCoordinates(a) && distanceKm(f.distance.origin, a) <= f.distance.maxKm)),
  );
}

const byStart = (a: Activity, b: Activity) =>
  Date.parse(a.starts_at) - Date.parse(b.starts_at) || a.id.localeCompare(b.id);

const normalise = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');

/** Port of P2's `rankActivityRecommendations` (same weights and hard accessibility filter). */
function rank(
  activities: Activity[],
  profile: Pick<UserProfile, 'interestIds' | 'accessibilityTagIds'>,
  state: UserState,
  origin: RecommendationOrigin | null,
): ActivityRecommendation[] {
  const interests = [...new Set(profile.interestIds.map(normalise))];
  const needs = [...new Set(profile.accessibilityTagIds.map(normalise))];
  const w = interests.length
    ? { interests: 60, proximity: 25, popularity: 15 }
    : { interests: 0, proximity: 60, popularity: 40 };
  const out: ActivityRecommendation[] = [];
  for (const activity of activities) {
    const count = joinedCount(activity.id, state);
    if (
      !isUpcoming(activity) ||
      !needs.every((n) => activity.accessibility_features.some((f) => normalise(f) === n)) ||
      state.participation[activity.id] === 'joined' ||
      (activity.capacity !== null && count >= activity.capacity)
    )
      continue;
    const topics = new Set(
      [activity.category, ...activity.tags, ...(activity.is_outdoor ? ['outdoors'] : [])].map(
        normalise,
      ),
    );
    const matching = interests.filter((i) => topics.has(i));
    const km = origin && hasCoordinates(activity) ? distanceKm(origin, activity) : null;
    const scores = {
      interests: interests.length ? (w.interests * matching.length) / interests.length : 0,
      proximity: km === null ? 0 : w.proximity / (1 + km / 5),
      popularity: (w.popularity * count) / (count + 5),
    };
    const reasons: string[] = [];
    if (matching.length) reasons.push(`Matches your interests: ${matching.join(', ')}.`);
    if (needs.length)
      reasons.push(`Meets all your accessibility requirements: ${needs.join(', ')}.`);
    if (km !== null) reasons.push(`About ${km.toFixed(1)} km from ${origin!.label}.`);
    if (count) reasons.push(`${count} joined registrations contribute to popularity.`);
    out.push({
      activity,
      score: scores.interests + scores.proximity + scores.popularity,
      scores,
      reasons,
      distanceKm: km,
      joinedCount: count,
    });
  }
  return out.sort((a, b) => b.score - a.score || byStart(a.activity, b.activity));
}

/* -------------------------------- service --------------------------------- */

const requireActivity = (id: string) => {
  const a = find(id);
  if (!a) throw new ServiceError('NOT_FOUND');
  return a;
};

const card = (activity: Activity, state: UserState): MyActivityCard => ({
  activity,
  saved: state.bookmarks.includes(activity.id),
  joined: state.participation[activity.id] === 'joined',
});

export const mockActivities: ActivityService = {
  async getRecommendations(options) {
    await delay();
    const { profile } = await currentUser();
    const hood = findNeighbourhood(profile?.neighbourhoodId);
    const origin: RecommendationOrigin | null = options?.deviceLocation
      ? { ...options.deviceLocation, source: 'device', label: 'your device location' }
      : hood
        ? { lat: hood.lat, lng: hood.lng, source: 'neighbourhood', label: hood.id }
        : null;
    return withUser((state) => ({
      recommendations: rank(
        allActivities(),
        profile ?? { interestIds: [], accessibilityTagIds: [] },
        state,
        origin,
      ).slice(0, 20),
      personalised: (profile?.interestIds.length ?? 0) > 0,
      origin,
    }));
  },

  async listActivities(filters) {
    await delay();
    return applyFilters(
      allActivities().filter((a) => isUpcoming(a)),
      filters,
    ).sort(byStart);
  },

  async getActivity(id) {
    await delay(200);
    return find(id);
  },

  async getOrganiserName(activity) {
    if (activity.source !== 'organiser' || !activity.organiser_id) return null;
    return ORGANISERS[activity.organiser_id] ?? null;
  },

  async getParticipation(activityId) {
    await delay(200);
    const activity = requireActivity(activityId);
    return withUser((state) => ({
      ...card(activity, state),
      joinedCount: joinedCount(activityId, state),
    }));
  },

  async save(activityId) {
    await delay();
    requireActivity(activityId);
    await withUser((state) => {
      if (!state.bookmarks.includes(activityId)) state.bookmarks.push(activityId);
    });
  },

  async unsave(activityId) {
    await delay();
    await withUser((state) => {
      state.bookmarks = state.bookmarks.filter((id) => id !== activityId);
    });
  },

  async join(activityId) {
    await delay();
    const activity = requireActivity(activityId);
    await withUser((state) => {
      if (state.participation[activityId] === 'joined') return;
      if (!isUpcoming(activity)) throw new ServiceError('ACTIVITY_UNAVAILABLE');
      if (activity.capacity !== null && joinedCount(activityId, state) >= activity.capacity)
        throw new ServiceError('ACTIVITY_FULL');
      state.participation[activityId] = 'joined';
    });
  },

  async leave(activityId) {
    await delay();
    await withUser((state) => {
      if (state.participation[activityId] === 'joined') delete state.participation[activityId];
    });
  },

  async listRatings(activityId) {
    await delay(200);
    return withUser((state) =>
      [...state.ratings, ...SEED_RATINGS]
        .filter((r) => r.activity_id === activityId)
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    );
  },

  async listMine() {
    await delay();
    const now = Date.now();
    return withUser((state) => {
      const joined = allActivities().filter((a) => state.participation[a.id] === 'joined');
      const saved = state.bookmarks.map(find).filter((a): a is Activity => !!a);
      return {
        saved: saved.sort(byStart).map((a) => card(a, state)),
        joined: joined
          .filter((a) => isUpcoming(a, now))
          .sort(byStart)
          .map((a) => card(a, state)),
        history: joined
          .filter((a) => Date.parse(a.starts_at) <= now)
          .sort((a, b) => byStart(b, a))
          .map((a) => card(a, state)),
      };
    });
  },

  async createDiscoverySession(restoredIds = []) {
    const { account } = await currentUser();
    const excluded = new Set(restoredIds);
    const pending = new Set<string>();
    const session: ActivityDiscoverySession = {
      get excludedActivityIds() {
        return [...excluded];
      },
      async load(options) {
        await delay();
        if ((await currentUser()).account.accountId !== account.accountId)
          throw new ServiceError('NOT_AUTHENTICATED');
        return withUser((state) =>
          applyFilters(
            allActivities().filter(
              (a) =>
                isUpcoming(a) &&
                !state.bookmarks.includes(a.id) &&
                !state.participation[a.id] &&
                !excluded.has(a.id) &&
                !pending.has(a.id),
            ),
            options?.filters,
          )
            .sort(byStart)
            .slice(0, options?.limit ?? 20),
        );
      },
      async act(activityId, action) {
        if (pending.has(activityId)) throw new ServiceError('BUSY');
        pending.add(activityId);
        try {
          await delay();
          requireActivity(activityId);
          await withUser((state) => {
            if (action === 'skip') {
              // P2's skip RPC rejects skipping an activity you've joined.
              if (state.participation[activityId] === 'joined')
                throw new ServiceError('ACTIVITY_UNAVAILABLE');
              state.participation[activityId] = 'skipped';
            } else if (!state.bookmarks.includes(activityId)) {
              state.bookmarks.push(activityId);
            }
          });
          excluded.add(activityId);
        } finally {
          pending.delete(activityId);
        }
      },
    };
    return session;
  },
};
