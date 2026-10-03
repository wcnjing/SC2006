// Seeds test accounts, activities and posts. Safe to re-run.
//
//   npm run seed
//
// Reads from the repo-root .env (never commit it):
//   SUPABASE_URL=https://<ref>.supabase.co
//   SUPABASE_SECRET_KEY=sb_secret_...      (Project Settings -> API Keys)
//   SEED_PASSWORD=<shared test password>   (share in the group chat, not the repo)
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SECRET_KEY, SEED_PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !SEED_PASSWORD) {
  console.error(
    'Set SUPABASE_URL, SUPABASE_SECRET_KEY and SEED_PASSWORD in .env (see .env.example).',
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

function check({ data, error }, what) {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
const USERS = [
  {
    key: 'admin',
    email: 'admin@test.com',
    name: 'Admin Aisha',
    role: 'admin',
    hood: 'Bishan',
    interests: ['volunteering'],
  },
  {
    key: 'organiser',
    email: 'organiser@test.com',
    name: 'Organiser Omar',
    role: 'organiser',
    hood: 'Toa Payoh',
    interests: ['fitness', 'outdoors'],
  },
  {
    key: 'organiser2',
    email: 'organiser2@test.com',
    name: 'Organiser Priya',
    role: 'organiser',
    hood: 'Tampines',
    interests: ['arts-crafts', 'cooking'],
  },
  {
    key: 'resident',
    email: 'resident@test.com',
    name: 'Resident Rachel',
    role: 'resident',
    hood: 'Toa Payoh',
    interests: ['fitness', 'gardening', 'social'],
  },
  {
    key: 'resident2',
    email: 'resident2@test.com',
    name: 'Uncle Tan',
    role: 'resident',
    hood: 'Bishan',
    interests: ['games', 'music'],
    access: ['elderly-friendly', 'low-intensity'],
  },
  {
    key: 'resident3',
    email: 'resident3@test.com',
    name: 'Wei Ming',
    role: 'resident',
    hood: 'Tampines',
    interests: ['sports', 'technology'],
  },
];

async function findUserByEmail(email) {
  for (let page = 1; ; page++) {
    const { users } = check(await db.auth.admin.listUsers({ page, perPage: 200 }), 'list users');
    const found = users.find((u) => u.email === email);
    if (found || users.length < 200) return found;
  }
}

const hoods = check(await db.from('neighbourhoods').select('id, name, lat, lng'), 'neighbourhoods');
const hoodByName = Object.fromEntries(hoods.map((h) => [h.name, h]));

const ids = {};
for (const u of USERS) {
  let user = await findUserByEmail(u.email);
  if (!user) {
    user = check(
      await db.auth.admin.createUser({
        email: u.email,
        password: SEED_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: u.name },
      }),
      `create ${u.email}`,
    ).user;
  } else {
    // Accounts made by hand in the dashboard: align password so everyone can log in.
    check(
      await db.auth.admin.updateUserById(user.id, { password: SEED_PASSWORD, email_confirm: true }),
      `update ${u.email}`,
    );
  }
  ids[u.key] = user.id;
  check(
    await db
      .from('profiles')
      .update({
        display_name: u.name,
        role: u.role,
        neighbourhood_id: hoodByName[u.hood].id,
        interests: u.interests,
        accessibility_needs: u.access ?? [],
        onboarded: true,
      })
      .eq('id', user.id),
    `profile ${u.email}`,
  );
}
console.log(`✓ ${USERS.length} users`);

// ---------------------------------------------------------------------------
// Activities (dates are relative to today so the data never goes stale)
// ---------------------------------------------------------------------------
function at(dayOffset, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const near = (hood, dLat = 0, dLng = 0) => ({
  neighbourhood_id: hoodByName[hood].id,
  lat: hoodByName[hood].lat + dLat,
  lng: hoodByName[hood].lng + dLng,
});

const ACTIVITIES = [
  {
    id: 'seed-01',
    org: 'organiser',
    title: 'Morning Tai Chi by the Park',
    category: 'fitness',
    tags: ['outdoors', 'wellness'],
    ...near('Toa Payoh', 0.002, -0.001),
    location_name: 'Toa Payoh Town Park',
    day: 2,
    start: 7,
    hours: 1,
    outdoor: true,
    access: ['elderly-friendly', 'low-intensity'],
  },
  {
    id: 'seed-02',
    org: 'organiser',
    title: 'Community Garden Workday',
    category: 'gardening',
    tags: ['outdoors', 'volunteering'],
    ...near('Toa Payoh', -0.003, 0.002),
    location_name: 'Lorong 1 Community Garden',
    day: 3,
    start: 9,
    hours: 2,
    outdoor: true,
    access: ['wheelchair-access'],
  },
  {
    id: 'seed-03',
    org: 'organiser',
    title: 'Evening Neighbourhood Walk',
    category: 'outdoors',
    tags: ['fitness', 'social'],
    ...near('Bishan', 0.001, 0.003),
    location_name: 'Bishan-Ang Mo Kio Park',
    day: 1,
    start: 19,
    hours: 1,
    outdoor: true,
    access: ['low-intensity'],
  },
  {
    id: 'seed-04',
    org: 'organiser',
    title: 'Badminton Social',
    category: 'sports',
    tags: ['social'],
    ...near('Toa Payoh', 0.004, 0.001),
    location_name: 'Toa Payoh Sports Hall',
    day: 4,
    start: 20,
    hours: 2,
    capacity: 16,
  },
  {
    id: 'seed-05',
    org: 'organiser',
    title: 'Kopi & Chat Morning',
    category: 'social',
    tags: ['elderly'],
    ...near('Bishan'),
    location_name: 'Bishan Community Club',
    day: 5,
    start: 10,
    hours: 2,
    access: ['elderly-friendly', 'wheelchair-access'],
  },
  {
    id: 'seed-06',
    org: 'organiser2',
    title: 'Batik Painting Workshop',
    category: 'arts-crafts',
    tags: ['learning'],
    ...near('Tampines', 0.002, 0.001),
    location_name: 'Our Tampines Hub',
    day: 6,
    start: 14,
    hours: 3,
    capacity: 20,
    cost: 1500,
  },
  {
    id: 'seed-07',
    org: 'organiser2',
    title: 'Peranakan Cooking Class',
    category: 'cooking',
    tags: ['learning', 'social'],
    ...near('Tampines', -0.001, 0.002),
    location_name: 'Tampines West CC',
    day: 8,
    start: 18,
    hours: 2,
    capacity: 12,
    cost: 2000,
  },
  {
    id: 'seed-08',
    org: 'organiser2',
    title: 'Beach Clean-up at Pasir Ris',
    category: 'volunteering',
    tags: ['outdoors'],
    ...near('Pasir Ris', 0.001, 0.001),
    location_name: 'Pasir Ris Beach Park',
    day: 9,
    start: 8,
    hours: 3,
    outdoor: true,
  },
  {
    id: 'seed-09',
    org: 'organiser2',
    title: 'Smartphone Basics for Seniors',
    category: 'technology',
    tags: ['learning', 'elderly'],
    ...near('Tampines'),
    location_name: 'Tampines Regional Library',
    day: 3,
    start: 15,
    hours: 2,
    capacity: 15,
    access: ['elderly-friendly', 'hearing-support'],
  },
  {
    id: 'seed-10',
    org: 'organiser',
    title: 'Board Games Night',
    category: 'games',
    tags: ['social'],
    ...near('Toa Payoh', -0.001, -0.002),
    location_name: 'Toa Payoh Central CC',
    day: 2,
    start: 19,
    hours: 3,
    capacity: 24,
  },
  {
    id: 'seed-11',
    org: 'organiser',
    title: 'Sunrise Yoga',
    category: 'wellness',
    tags: ['fitness', 'outdoors'],
    ...near('Bishan', -0.002, 0.001),
    location_name: 'Bishan Park Lawn',
    day: 7,
    start: 7,
    hours: 1,
    outdoor: true,
  },
  {
    id: 'seed-12',
    org: 'organiser',
    title: 'Ukulele Jam Session',
    category: 'music',
    tags: ['social'],
    ...near('Bishan', 0.003, -0.001),
    location_name: 'Bishan Public Library',
    day: 10,
    start: 16,
    hours: 2,
  },
  {
    id: 'seed-13',
    org: 'organiser2',
    title: 'Futsal Pickup Game',
    category: 'sports',
    tags: ['outdoors'],
    ...near('Tampines', 0.003, -0.002),
    location_name: 'Tampines Street 81 Court',
    day: 5,
    start: 20,
    hours: 2,
    outdoor: true,
    capacity: 10,
  },
  {
    id: 'seed-14',
    org: 'organiser',
    title: 'Cancelled: Kite Flying',
    category: 'outdoors',
    tags: [],
    ...near('Punggol'),
    location_name: 'Punggol Waterway Park',
    day: 4,
    start: 16,
    hours: 2,
    outdoor: true,
    status: 'cancelled',
    cancelled_reason: 'Weather warning',
  },
  // Past activities (for ratings and "My Activities > Past")
  {
    id: 'seed-15',
    org: 'organiser',
    title: 'Last Week: Mahjong Afternoon',
    category: 'games',
    tags: ['social', 'elderly'],
    ...near('Toa Payoh'),
    location_name: 'Toa Payoh East CC',
    day: -5,
    start: 14,
    hours: 3,
    status: 'completed',
    access: ['elderly-friendly'],
  },
  {
    id: 'seed-16',
    org: 'organiser2',
    title: 'Last Week: Bread Baking',
    category: 'cooking',
    tags: ['learning'],
    ...near('Tampines'),
    location_name: 'Tampines West CC',
    day: -3,
    start: 10,
    hours: 2,
    status: 'completed',
  },
];

const activityRows = ACTIVITIES.map((a) => ({
  source: 'organiser',
  external_id: a.id,
  organiser_id: ids[a.org],
  title: a.title,
  description: `${a.title} at ${a.location_name}. All residents welcome!`,
  category: a.category,
  tags: a.tags,
  neighbourhood_id: a.neighbourhood_id,
  location_name: a.location_name,
  lat: a.lat,
  lng: a.lng,
  starts_at: at(a.day, a.start),
  ends_at: at(a.day, a.start + a.hours),
  capacity: a.capacity ?? null,
  is_outdoor: a.outdoor ?? false,
  cost_cents: a.cost ?? 0,
  accessibility_features: a.access ?? [],
  status: a.status ?? 'scheduled',
  cancelled_reason: a.cancelled_reason ?? null,
}));

const activities = check(
  await db
    .from('activities')
    .upsert(activityRows, { onConflict: 'source,external_id' })
    .select('id, external_id'),
  'activities',
);
const actId = Object.fromEntries(activities.map((a) => [a.external_id, a.id]));
console.log(`✓ ${activities.length} activities`);

// ---------------------------------------------------------------------------
// Participation, ratings, social graph
// ---------------------------------------------------------------------------
const participation = [
  ['seed-01', 'resident', 'joined'],
  ['seed-10', 'resident', 'joined'],
  ['seed-02', 'resident', 'saved'],
  ['seed-04', 'resident', 'skipped'],
  ['seed-15', 'resident', 'joined'],
  ['seed-05', 'resident2', 'joined'],
  ['seed-15', 'resident2', 'joined'],
  ['seed-06', 'resident3', 'saved'],
  ['seed-16', 'resident3', 'joined'],
].map(([a, u, status]) => ({ activity_id: actId[a], user_id: ids[u], status }));
check(await db.from('activity_participants').upsert(participation), 'participation');

check(
  await db.from('activity_ratings').upsert([
    {
      activity_id: actId['seed-15'],
      user_id: ids.resident2,
      rating: 5,
      comment: 'Very fun, met new kakis!',
    },
    { activity_id: actId['seed-16'], user_id: ids.resident3, rating: 4, comment: 'Learned a lot.' },
  ]),
  'ratings',
);

// Connections are unique per pair in either direction, so only insert missing ones.
const wantedConnections = [
  ['resident', 'resident2', 'accepted'],
  ['resident3', 'resident', 'pending'],
];
for (const [a, b, status] of wantedConnections) {
  const existing = check(
    await db
      .from('connections')
      .select('requester_id')
      .or(
        `and(requester_id.eq.${ids[a]},addressee_id.eq.${ids[b]}),and(requester_id.eq.${ids[b]},addressee_id.eq.${ids[a]})`,
      ),
    'connections lookup',
  );
  if (existing.length === 0) {
    check(
      await db.from('connections').insert({
        requester_id: ids[a],
        addressee_id: ids[b],
        status,
        responded_at: status === 'accepted' ? new Date().toISOString() : null,
      }),
      'connections',
    );
  }
}

// Posts: only seed once (posts have no natural key to upsert on).
const { count } = await db
  .from('posts')
  .select('id', { count: 'exact', head: true })
  .in('author_id', Object.values(ids));
if (!count) {
  const posts = check(
    await db
      .from('posts')
      .insert([
        {
          author_id: ids.resident,
          neighbourhood_id: hoodByName['Toa Payoh'].id,
          body: 'Anyone keen for tai chi this weekend? First time going!',
        },
        {
          author_id: ids.resident2,
          neighbourhood_id: hoodByName['Bishan'].id,
          body: 'The Kopi & Chat session was great last month. Highly recommend.',
        },
        {
          author_id: ids.organiser,
          neighbourhood_id: hoodByName['Toa Payoh'].id,
          body: 'Garden workday needs 5 more volunteers. Gloves provided!',
          activity_id: actId['seed-02'],
        },
        {
          author_id: ids.resident3,
          neighbourhood_id: hoodByName['Tampines'].id,
          body: 'Looking for futsal kakis around Tampines.',
        },
      ])
      .select('id, author_id'),
    'posts',
  );
  check(
    await db.from('comments').insert([
      { post_id: posts[0].id, author_id: ids.resident2, body: 'Go lah, very relaxing.' },
      { post_id: posts[3].id, author_id: ids.organiser2, body: 'Join our pickup game on Friday!' },
    ]),
    'comments',
  );
  check(
    await db.from('post_likes').insert([
      { post_id: posts[0].id, user_id: ids.resident2 },
      { post_id: posts[2].id, user_id: ids.resident },
    ]),
    'likes',
  );
  check(
    await db.from('messages').insert({
      sender_id: ids.resident2,
      recipient_id: ids.resident,
      body: 'See you at board games night?',
    }),
    'messages',
  );
  console.log('✓ posts, comments, likes, messages');
} else {
  console.log('• posts already seeded, skipping');
}

console.log('\nTest accounts (password = SEED_PASSWORD):');
for (const u of USERS) console.log(`  ${u.role.padEnd(10)} ${u.email}`);
