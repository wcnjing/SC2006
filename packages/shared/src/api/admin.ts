import type { AccountStatus, AuditLogEntry, Profile, UserRole } from '../types';
import { unwrap, type CommunityLinkClient } from './client';

// Admin-only. The database rejects these for non-admins (error code 42501).

export async function setUserRole(
  client: CommunityLinkClient,
  userId: string,
  role: UserRole,
): Promise<void> {
  unwrap(await client.rpc('set_user_role', { target_user: userId, new_role: role }));
}

export async function setUserStatus(
  client: CommunityLinkClient,
  userId: string,
  status: AccountStatus,
  reason?: string,
): Promise<void> {
  unwrap(await client.rpc('set_user_status', { target_user: userId, new_status: status, reason }));
}

export type ManagedUser = Pick<
  Profile,
  'id' | 'display_name' | 'avatar_url' | 'role' | 'status' | 'suspended_reason'
>;

/** Every account for the Manage users screen. RLS returns all profiles only to admins. */
export async function listUsers(client: CommunityLinkClient): Promise<ManagedUser[]> {
  return unwrap(
    await client
      .from('profiles')
      .select('id, display_name, avatar_url, role, status, suspended_reason')
      .order('display_name'),
  );
}

export async function listAuditLog(
  client: CommunityLinkClient,
  { limit = 50, before }: { limit?: number; before?: string } = {},
): Promise<AuditLogEntry[]> {
  let query = client
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (before) query = query.lt('created_at', before);
  return unwrap(await query);
}
