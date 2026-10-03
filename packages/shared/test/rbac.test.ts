import { describe, expect, it } from 'vitest';
import { can, hasRole } from '../src/rbac';

const resident = { role: 'resident', status: 'active' } as const;
const organiser = { role: 'organiser', status: 'active' } as const;
const admin = { role: 'admin', status: 'active' } as const;
const suspendedAdmin = { role: 'admin', status: 'suspended' } as const;

describe('can', () => {
  it('lets organisers and admins create activities, not residents', () => {
    expect(can(resident, 'activity:create')).toBe(false);
    expect(can(organiser, 'activity:create')).toBe(true);
    expect(can(admin, 'activity:create')).toBe(true);
  });

  it('reserves moderation for admins', () => {
    expect(can(organiser, 'report:review')).toBe(false);
    expect(can(admin, 'report:review')).toBe(true);
  });

  it('denies everything to suspended or missing profiles', () => {
    expect(can(suspendedAdmin, 'report:review')).toBe(false);
    expect(can(null, 'activity:create')).toBe(false);
  });
});

describe('hasRole', () => {
  it('matches any of the given roles', () => {
    expect(hasRole(organiser, 'resident', 'organiser')).toBe(true);
    expect(hasRole(resident, 'admin')).toBe(false);
  });
});
