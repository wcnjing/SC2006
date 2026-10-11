import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const migration = (name: string) => read(`docs/proposals/migrations/${name}`);
const baseline = '20261010150000_p2_save_join_baseline.sql';
const management = '20261010160000_p2_activity_management.sql';
const ratings = '20261010170000_p2_activity_ratings.sql';
const swipe = '20261010180000_p2_swipe_discovery.sql';
const hardening = '20261010190000_p2_integration_hardening.sql';
const sql = (source: string) =>
  source
    .replace(/--[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
function definition(source: string, name: string) {
  const pattern = new RegExp(
    `create (?:or replace )?function public\\.${name}\\([\\s\\S]*?\\$\\$;`,
  );
  const match = source.match(pattern);
  if (!match) throw new Error(`Missing function: ${name}`);
  return sql(match[0]);
}

// These fingerprints deliberately pin the existing history and original review
// artifacts (management includes the reviewed UC #7-03 pre-start correction).
// Any future change needs an explicit migration/history review rather
// than silently editing a previously applied payload or hiding changes in copies.
const originals: [string, string][] = [
  [
    'supabase/migrations/20261003142605_init_schema.sql',
    'bb9f5f58e9791e5f61ad2a887fe1e564cf7738f3c2c5e04e0500c2bb91fb2cdc',
  ],
  [
    'supabase/migrations/20261003142606_auth_rbac.sql',
    '2c9584164041479785a40f7233dbdd2d314b743cab6116aeec6576d0e3e86d6f',
  ],
  [
    'supabase/migrations/20261003142607_rls_policies.sql',
    '24b53c662e4724aa2e69caee3f52592d2dad2bc27eecf8cab524c23b0c7aac7f',
  ],
  [
    'supabase/migrations/20261003142608_reference_data.sql',
    'eaf20b82be6b85aec841de80994a242642add1f154a743df2a029eb7b7adcec4',
  ],
  [
    `docs/proposals/migrations/${management}`,
    '9704a75f7f1630f8e240a5d52def00c32d571ffa72a71828e470fb6ec2189e4b',
  ],
  [
    `docs/proposals/migrations/${ratings}`,
    'af653575208458f3e0168829e1e53ca742d0fbcdefc8212fe87d73188562bfa3',
  ],
  [
    'docs/proposals/p2-save-join.sql',
    'c45204710e4e6d8e97d85ecc2e97270b1de2ba9c27ad8367ff1bffaf5f1ad2e2',
  ],
  [
    'docs/proposals/p2-swipe-discovery.sql',
    '9c62ab74ca220a581fade5beae35973b1cb7f3d1f4f481a191ec5c4c4086bf22',
  ],
];

describe('P2 migration history and ordering (static only)', () => {
  it('guards organiser cancellation against direct updates at or after the original start', () => {
    const source = definition(migration(management), 'guard_activity_management');
    expect(source).toContain("if actor_role <> 'admin' then");
    expect(source).toContain(
      "if cancellation_only and old.starts_at <= clock_timestamp() then raise exception using errcode = 'P0001', message = 'This activity has already started and cannot be cancelled.'; end if;",
    );
    expect(sql(migration(management))).toContain(
      'before insert or update on public.activities for each row execute function public.guard_activity_management()',
    );
  });

  it.each(originals)('preserves the original bytes of %s', (path, checksum) => {
    expect(createHash('sha256').update(read(path)).digest('hex')).toBe(checksum);
  });
  it.each([
    [baseline, 'docs/proposals/p2-save-join.sql'],
    [swipe, 'docs/proposals/p2-swipe-discovery.sql'],
  ])('registers %s without changing the original payload', (target, source) => {
    expect(migration(target).endsWith(read(source))).toBe(true);
    expect(sql(migration(target))).toBe(sql(read(source)));
  });
 it('has unique P2 migration versions in the correct order', () => {
  const files = readdirSync(resolve(root, 'docs/proposals/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  expect(new Set(files.map((name) => name.split('_')[0])).size)
    .toBe(files.length);

  expect(files).toEqual([
    baseline,
    management,
    ratings,
    swipe,
    hardening,
  ]);
});
  it.each([baseline, management, ratings, swipe, hardening])(
    'labels %s proposed and wraps it in a transaction',
    (name) => {
      const source = migration(name);
      expect(source).toMatch(/^-- PROPOSED/);
      expect(sql(source).startsWith('begin;')).toBe(true);
      expect(sql(source).endsWith('commit;')).toBe(true);
    },
  );
  it('keeps the legacy saved-row conversion confined to the baseline, before its targeted deletion', () => {
    const source = sql(migration(baseline));
    expect(
      source.indexOf('insert into public.activity_bookmarks(activity_id, user_id, created_at)'),
    ).toBeLessThan(
      source.indexOf("delete from public.activity_participants where status = 'saved'"),
    );
    for (const name of [management, ratings, swipe, hardening]) {
      expect(sql(migration(name))).not.toMatch(
        /delete from public\.activity_participants where status = 'saved'/,
      );
      expect(sql(migration(name))).not.toMatch(/\b(drop|truncate)\s+(table|schema|type)\b/);
    }
  });
});

describe('P2 permission and timing safeguards (source invariants, not DB execution)', () => {
  it('preserves prerequisite restrictive policies and enforces them before hardening', () => {
    expect(sql(migration(management))).toContain('as restrictive for update to authenticated');
    expect(sql(migration(ratings))).toContain('as restrictive for insert to authenticated');
    const source = sql(migration(hardening));
    expect(source).toContain("not polpermissive and polcmd = 'w'");
    expect(source).toContain("not polpermissive and polcmd = 'a'");
    expect(source).toContain("tgenabled in ('O', 'A')");
  });
  it('closes direct participant DELETE without removing read privileges or changing RLS policies', () => {
    const source = sql(migration(hardening));
    expect(source).toContain(
      'revoke delete on public.activity_participants from public, anon, authenticated;',
    );
    expect(source).not.toMatch(/revoke[^;]*\bselect\b/);
    expect(source).not.toMatch(/(?:create|drop|alter) policy/);
    expect(source).not.toMatch(/grant (?:insert|update|delete)/);
  });
  it('closes rating UPDATE/DELETE at both table and all existing column grant levels', () => {
    const source = sql(migration(hardening));
    expect(source).toContain(
      'revoke update, delete on public.activity_ratings from public, anon, authenticated;',
    );
    expect(source).toContain(
      'revoke update(activity_id, user_id, rating, comment, created_at) on public.activity_ratings from public, anon, authenticated;',
    );
  });
  it.each([
    ['set_activity_registration', 'docs/proposals/p2-save-join.sql'],
    ['skip_activity', 'docs/proposals/p2-swipe-discovery.sql'],
  ])(
    'preserves the original %s RPC logic apart from reviewed clock/isolation safeguards',
    (name, source) => {
      const original = definition(read(source), name);
      const next = definition(migration(hardening), name);
      expect(
        next
          .replace('create or replace function', 'create function')
          .replace(
            sql(`if should_join and pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
          raise exception using errcode = '0A000', message = 'Joining requires READ COMMITTED transaction isolation.';
          end if;`),
            '',
          )
          .replace('activity.starts_at <= clock_timestamp()', 'activity.starts_at <= now()')
          .replace(/\s+/g, ' '),
      ).toBe(original);
      expect(next.indexOf('for update;')).toBeLessThan(
        next.indexOf('activity.starts_at <= clock_timestamp()'),
      );
      expect(next).toContain("security definer set search_path = ''");
      expect(next).toContain('resident_id uuid := auth.uid()');
    },
  );
  it('rejects stale-snapshot isolation for joining and capacity edits, while retaining the capacity guard', () => {
    const source = sql(migration(hardening));
    const joining = definition(migration(hardening), 'set_activity_registration');
    expect(joining).toContain(
      "if should_join and pg_catalog.current_setting('transaction_isolation') <> 'read committed'",
    );
    expect(joining.indexOf("pg_catalog.current_setting('transaction_isolation')")).toBeLessThan(
      joining.indexOf('for update;'),
    );
    const capacity = definition(migration(hardening), 'guard_activity_capacity');
    expect(capacity).toContain(
      "if pg_catalog.current_setting('transaction_isolation') <> 'read committed'",
    );
    expect(capacity.indexOf("pg_catalog.current_setting('transaction_isolation')")).toBeLessThan(
      capacity.indexOf('select count(*)'),
    );
    expect(source).toContain(
      'revoke all on function public.guard_activity_capacity() from public, anon, authenticated;',
    );
    const withoutCheck = capacity
      .replace('create or replace function', 'create function')
      .replace(
        sql(`if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
      raise exception using errcode = '0A000', message = 'Capacity edits require READ COMMITTED transaction isolation.';
      end if;`),
        '',
      )
      .replace(/\s+/g, ' ');
    expect(withoutCheck).toBe(
      definition(read('docs/proposals/p2-save-join.sql'), 'guard_activity_capacity'),
    );
  });
  it('reasserts restricted RPC EXECUTE grants and does not add competing triggers', () => {
    const source = sql(migration(hardening));
    for (const signature of ['set_activity_registration(uuid, boolean)', 'skip_activity(uuid)']) {
      expect(source).toContain(
        `revoke all on function public.${signature} from public, anon, authenticated;`,
      );
      expect(source).toContain(`grant execute on function public.${signature} to authenticated;`);
    }
    expect(source).not.toContain('create trigger');
    expect(source).not.toContain('drop trigger');
  });
});
