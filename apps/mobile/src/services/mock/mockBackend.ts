import { readJSON, remove, writeJSON } from '@/lib/storage';
import { normaliseEmail } from '@/lib/validation';
import type {
  AccountStatus,
  ProfileInput,
  Session,
  SingpassIdentity,
  UserAccount,
  UserProfile,
} from '@/types/models';

import { ServiceError, type AuthService, type ProfileService } from '../types';

/**
 * In-device mock backend. It persists to AsyncStorage/localStorage so
 * register → log out → log in works across reloads during development.
 * Used whenever Supabase isn't configured (see src/lib/supabase.ts).
 *
 * NOT secure: passwords are stored in plain text. NFR Authentication Security
 * (salted hashing) is satisfied by Supabase Auth on the real backend.
 */

type Row = {
  account: UserAccount;
  password: string | null;
  singpassUinfin: string | null;
  profile: UserProfile | null;
};
type DB = { rows: Row[] };

// v4: fixed seed account ids, so the community and organiser mocks can refer to them.
const DB_KEY = 'mock-db-v4';
const SESSION_KEY = 'mock-session-v4';
const LATENCY_MS = 400;

const now = () => new Date().toISOString();
const id = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const delay = () => new Promise((r) => setTimeout(r, LATENCY_MS));
/** Random v4-shaped UUID for mock rows (P3's API validates ids as UUIDs). */
export const mockUuid = () =>
  'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );

function seedProfile(
  displayName: string,
  neighbourhoodId: string,
  interestIds: string[],
  access: string[] = [],
): UserProfile {
  return {
    profileId: id('prof'),
    displayName,
    pictureUrl: null,
    neighbourhoodId,
    interestIds,
    accessibilityTagIds: access,
    preferredLanguage: 'en',
    updatedAt: now(),
  };
}

function seedAccount(
  email: string,
  role: UserAccount['roles'][number],
  accountId = id('acct'),
): UserAccount {
  return {
    accountId,
    email,
    roles: [role],
    status: 'active',
    createdAt: now(),
    linkedSingpass: false,
  };
}

/**
 * Seed account ids. Omar's id is the organiser id the mock activities already
 * use for Tampines Community Club, so he can manage those activities.
 */
export const MOCK_IDS = {
  mrsTan: 'acct-mrstan',
  rachel: 'acct-rachel',
  omar: 'org-tampines-cc',
  aisha: 'acct-aisha',
  sam: 'acct-sam',
} as const;

/**
 * Demo accounts, documented in README.md. Password for all: Password1.
 * Apart from Mrs Tan (the mockup persona) and the suspended account, they
 * mirror P1's seed users in scripts/seed.mjs, so the same emails work on Supabase.
 */
function seed(): DB {
  const row = (account: UserAccount, profile: UserProfile, uinfin: string | null = null): Row => ({
    account,
    password: 'Password1',
    singpassUinfin: uinfin,
    profile,
  });
  return {
    rows: [
      row(
        { ...seedAccount('mrstan@test.com', 'resident', MOCK_IDS.mrsTan), linkedSingpass: true },
        seedProfile(
          'Mrs Tan',
          'tampines',
          ['gardening', 'volunteering', 'social'],
          ['elderly-friendly'],
        ),
        'S1234567A',
      ),
      row(
        seedAccount('resident@test.com', 'resident', MOCK_IDS.rachel),
        seedProfile('Resident Rachel', 'toa-payoh', ['fitness', 'gardening', 'social']),
      ),
      row(
        seedAccount('organiser@test.com', 'organiser', MOCK_IDS.omar),
        seedProfile('Organiser Omar', 'toa-payoh', ['fitness', 'outdoors']),
      ),
      row(
        seedAccount('admin@test.com', 'admin', MOCK_IDS.aisha),
        seedProfile('Admin Aisha', 'bishan', ['volunteering']),
      ),
      row(
        { ...seedAccount('suspended@test.com', 'resident', MOCK_IDS.sam), status: 'suspended' },
        seedProfile('Suspended Sam', 'bedok', []),
      ),
    ],
  };
}

async function load(): Promise<DB> {
  const db = await readJSON<DB>(DB_KEY);
  if (db) return db;
  const fresh = seed();
  await writeJSON(DB_KEY, fresh);
  return fresh;
}

const save = (db: DB) => writeJSON(DB_KEY, db);

function toSession(row: Row): Session {
  return { account: row.account, profile: row.profile, token: id('tok') };
}

async function startSession(row: Row): Promise<Session> {
  const session = toSession(row);
  await writeJSON(SESSION_KEY, { accountId: row.account.accountId, token: session.token });
  return session;
}

/**
 * The logged-in account's row, like auth.uid() on the server. Used by the
 * other mock services (activities) so they never take a user id from the UI.
 */
export async function currentMockUser(): Promise<{
  account: UserAccount;
  profile: UserProfile | null;
}> {
  const stored = await readJSON<{ accountId: string }>(SESSION_KEY);
  const row = stored && (await load()).rows.find((r) => r.account.accountId === stored.accountId);
  if (!row || row.account.status === 'suspended') throw new ServiceError('NOT_AUTHENTICATED');
  return { account: row.account, profile: row.profile };
}

/** Public profile fields of every mock account (what P3's APIs expose about other users). */
export async function mockPeople() {
  return (await load()).rows.map(({ account, profile }) => ({
    id: account.accountId,
    display_name: profile?.displayName ?? account.email ?? '',
    avatar_url: profile?.pictureUrl ?? null,
    neighbourhoodSlug: profile?.neighbourhoodId ?? null,
    role: account.roles[0],
    status: account.status,
  }));
}

export const mockAuth: AuthService = {
  async register(rawEmail, password) {
    await delay();
    const email = normaliseEmail(rawEmail);
    const db = await load();
    if (db.rows.some((r) => r.account.email === email)) throw new ServiceError('EMAIL_TAKEN');
    const row: Row = {
      account: seedAccount(email, 'resident'),
      password,
      singpassUinfin: null,
      profile: null,
    };
    db.rows.push(row);
    await save(db);
    return startSession(row);
  },

  async login(rawEmail, password) {
    await delay();
    const email = normaliseEmail(rawEmail);
    const db = await load();
    const row = db.rows.find((r) => r.account.email === email);
    if (!row || row.password !== password) throw new ServiceError('INVALID_CREDENTIALS');
    if (row.account.status === 'suspended') throw new ServiceError('ACCOUNT_SUSPENDED');
    return startSession(row);
  },

  // The mock uses the in-app consent screen (/singpass), not a redirect.
  singpassStartUrl: () => null,

  async completeSingpassRedirect() {
    throw new ServiceError('SINGPASS_FAILED');
  },

  async loginWithSingpass(identity: SingpassIdentity) {
    await delay();
    const db = await load();
    let row = db.rows.find((r) => r.singpassUinfin === identity.uinfin);
    let isNew = false;
    if (!row) {
      // FR 1.3.5: a new Singpass identity gets its own account (like Xavier's Mockpass bridge).
      row = {
        account: {
          ...seedAccount(`${identity.uinfin.toLowerCase()}@mockpass.local`, 'resident'),
          linkedSingpass: true,
        },
        password: null,
        singpassUinfin: identity.uinfin,
        profile: null,
      };
      db.rows.push(row);
      isNew = true;
    }
    if (row.account.status === 'suspended') throw new ServiceError('ACCOUNT_SUSPENDED');
    await save(db);
    return { session: await startSession(row), isNew };
  },

  async restore() {
    const stored = await readJSON<{ accountId: string; token: string }>(SESSION_KEY);
    if (!stored) return null;
    const db = await load();
    const row = db.rows.find((r) => r.account.accountId === stored.accountId);
    if (!row || row.account.status === 'suspended') return null;
    return { ...toSession(row), token: stored.token };
  },

  async logout() {
    await remove(SESSION_KEY);
  },

  async isSuspended() {
    const stored = await readJSON<{ accountId: string }>(SESSION_KEY);
    const row = stored && (await load()).rows.find((r) => r.account.accountId === stored.accountId);
    return row?.account.status === 'suspended';
  },
};

/** Admin suspend / reinstate (P1's set_user_status). The caller checks the admin role. */
export async function setMockStatus(accountId: string, status: AccountStatus) {
  const db = await load();
  const row = db.rows.find((r) => r.account.accountId === accountId);
  if (!row) throw new ServiceError('NOT_FOUND');
  row.account.status = status;
  await save(db);
}

export const mockProfile: ProfileService = {
  async saveProfile(accountId, input: ProfileInput) {
    await delay();
    const db = await load();
    const row = db.rows.find((r) => r.account.accountId === accountId);
    if (!row) throw new ServiceError('NOT_AUTHENTICATED');
    // Build the full record first, then write once, so a failed save leaves no partial profile (NFR Data Integrity).
    const profile: UserProfile = {
      profileId: row.profile?.profileId ?? id('prof'),
      ...input,
      displayName: input.displayName.trim(),
      updatedAt: now(),
    };
    row.profile = profile;
    await save(db);
    return profile;
  },

  async uploadAvatar(_accountId, localUri) {
    await delay();
    return localUri;
  },
};

/** Mock Singpass identities shown on the mock consent screen. */
export const MOCK_SINGPASS_IDENTITIES: SingpassIdentity[] = [
  { uinfin: 'S1234567A', name: 'Tan Mei Ling', mobile: '91234567' }, // linked to Mrs Tan
  { uinfin: 'S7654321B', name: 'Lim Wei Jie', mobile: '98765432' }, // new user: goes through onboarding
];
