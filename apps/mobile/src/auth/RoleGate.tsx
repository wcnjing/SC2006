import { can, hasRole, type Permission, type UserRole } from '@communitylink/shared';
import { useAuth } from './AuthProvider';

type RoleGateProps = { fallback?: React.ReactNode; children: React.ReactNode } & (
  { permission: Permission; roles?: never } | { roles: UserRole[]; permission?: never }
);

// Show children only to users with the permission/role, e.g.
//   <RoleGate permission="activity:create"><CreateActivityButton /></RoleGate>
// The database enforces the same rules; this just hides UI that would fail.
export function RoleGate({ permission, roles, fallback = null, children }: RoleGateProps) {
  const { profile } = useAuth();
  const allowed = permission ? can(profile, permission) : hasRole(profile, ...roles!);
  return <>{allowed ? children : fallback}</>;
}

export function usePermission(permission: Permission): boolean {
  const { profile } = useAuth();
  return can(profile, permission);
}
