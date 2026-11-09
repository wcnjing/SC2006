import type { Profile, UserRole } from './types';

// UI-side permission checks for showing/hiding screens and buttons.
// The database enforces the same rules with RLS, so these are a convenience,
// not the security boundary. Keep this table in sync with the RLS migration.
const PERMISSIONS = {
  'activity:create': ['organiser', 'admin'],
  'activity:manage-any': ['admin'],
  'report:review': ['admin'],
  'user:suspend': ['admin'],
  'user:set-role': ['admin'],
  'audit-log:read': ['admin'],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

type ProfileLike = Pick<Profile, 'role' | 'status'> | null | undefined;

export function hasRole(profile: ProfileLike, ...roles: UserRole[]): boolean {
  return !!profile && profile.status === 'active' && roles.includes(profile.role);
}

export function can(profile: ProfileLike, permission: Permission): boolean {
  return hasRole(profile, ...PERMISSIONS[permission]);
}
