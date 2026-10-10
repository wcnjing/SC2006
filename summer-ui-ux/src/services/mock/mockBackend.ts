import { readJSON, remove, writeJSON } from '@/lib/storage';
import { normalisePhone } from '@/lib/validation';
import type {
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

const DB_KEY = 'mock-db-v1';
const SESSION_KEY = 'mock-session-v1';
const LATENCY_MS = 400;

const now = () => new Date().toISOString();
const id = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const delay = () => new Promise((r) => setTimeout(r, LATENCY_MS));

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

function seedAccount(phone: string, roles: UserAccount['roles']): UserAccount {
  return {
    accountId: id('acct'),
    phoneNumber: phone,
    roles,
    status: 'active',
    createdAt: now(),
    linkedSingpass: false,
  };
}

/** Demo accounts, documented in README.md. Password for all: Password1 */
function seed(): DB {
  return {
    rows: [
      {
        account: { ...seedAccount('91234567', ['consumer']), linkedSingpass: true },
        password: 'Password1',
        singpassUinfin: 'S1234567A',
        profile: seedProfile(
          'Mrs Tan',
          'tampines',
          ['nature', 'volunteering', 'social'],
          ['elderly'],
        ),
      },
      {
        account: seedAccount('92345678', ['consumer', 'organiser']),
        password: 'Password1',
        singpassUinfin: null,
        profile: seedProfile('Tampines CC', 'tampines', ['sports', 'learning']),
      },
      {
        account: seedAccount('93456789', ['consumer', 'admin']),
        password: 'Password1',
        singpassUinfin: null,
        profile: seedProfile('Admin Alex', 'bishan', []),
      },
      {
        account: { ...seedAccount('94567890', ['consumer']), status: 'suspended' },
        password: 'Password1',
        singpassUinfin: null,
        profile: seedProfile('Suspended Sam', 'bedok', []),
      },
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

export const mockAuth: AuthService = {
  async register(rawPhone, password) {
    await delay();
    const phone = normalisePhone(rawPhone);
    const db = await load();
    if (db.rows.some((r) => r.account.phoneNumber === phone)) throw new ServiceError('PHONE_TAKEN');
    const row: Row = {
      account: seedAccount(phone, ['consumer']),
      password,
      singpassUinfin: null,
      profile: null,
    };
    db.rows.push(row);
    await save(db);
    return startSession(row);
  },

  async login(rawPhone, password) {
    await delay();
    const phone = normalisePhone(rawPhone);
    const db = await load();
    const row = db.rows.find((r) => r.account.phoneNumber === phone);
    if (!row || row.password !== password) throw new ServiceError('INVALID_CREDENTIALS');
    if (row.account.status === 'suspended') throw new ServiceError('ACCOUNT_SUSPENDED');
    return startSession(row);
  },

  async loginWithSingpass(identity: SingpassIdentity) {
    await delay();
    const db = await load();
    let row = db.rows.find((r) => r.singpassUinfin === identity.uinfin);
    let isNew = false;
    if (!row && identity.mobile) {
      // FR 1.3.5: associate with an existing phone-number account if one exists.
      row = db.rows.find((r) => r.account.phoneNumber === identity.mobile);
      if (row) {
        row.singpassUinfin = identity.uinfin;
        row.account.linkedSingpass = true;
      }
    }
    if (!row) {
      row = {
        account: {
          ...seedAccount(identity.mobile ?? '', ['consumer']),
          phoneNumber: identity.mobile,
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
};

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
  { uinfin: 'S1234567A', name: 'Tan Mei Ling', mobile: '91234567' }, // linked to the demo consumer
  { uinfin: 'S7654321B', name: 'Lim Wei Jie', mobile: '98765432' }, // new user: goes through onboarding
];
