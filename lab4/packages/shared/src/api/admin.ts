import type { AccountStatus, AuditLogEntry, UserRole } from '../types';
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
