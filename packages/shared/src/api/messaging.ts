import type { Message } from '../types';
import type { ConnectionProfile } from './connections';
import { requireUserId } from './auth';
import { ApiError, unwrap, type CommunityLinkClient } from './client';

export const DIRECT_MESSAGE_MAX_LENGTH = 2000;
export interface SendDirectMessageInput {
  recipientId: string;
  body: string;
  requestId?: string;
}
export interface MessageCursor {
  createdAt: string;
  id: string;
}
export interface DirectMessageOptions {
  limit?: number;
  cursor?: MessageCursor | null;
  signal?: AbortSignal;
}
export interface DirectMessagePage {
  messages: Message[];
  nextCursor: MessageCursor | null;
}
export interface DirectConversation {
  profile: ConnectionProfile;
  connected: boolean;
  blockedByMe: boolean;
  canSend: boolean;
}
export interface BlockedUser {
  id: string;
  createdAt: string;
  profile: ConnectionProfile | null;
}
export interface BlockedUserPage {
  users: BlockedUser[];
  nextCursor: MessageCursor | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validId(id: string) {
  if (!UUID.test(id)) throw new ApiError('Invalid resident or message ID.', 'validation');
}
function options(limit: number, cursor?: MessageCursor | null) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new ApiError('Page size must be between 1 and 50.', 'validation');
  if (cursor) {
    validId(cursor.id);
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        cursor.createdAt,
      ) ||
      !Number.isFinite(Date.parse(cursor.createdAt))
    )
      throw new ApiError('Invalid page cursor.', 'validation');
  }
}
async function otherUser(client: CommunityLinkClient, id: string) {
  validId(id);
  const me = await requireUserId(client);
  if (me === id) throw new ApiError('Choose another resident.', 'validation');
  return me;
}
export function validateDirectMessageBody(body: string): string | null {
  if (!body.trim()) return 'Write a message before sending.';
  if (Array.from(body.trim()).length > DIRECT_MESSAGE_MAX_LENGTH)
    return `Messages must be ${DIRECT_MESSAGE_MAX_LENGTH} characters or fewer.`;
  return null;
}
export async function sendDirectMessage(
  client: CommunityLinkClient,
  input: SendDirectMessageInput,
): Promise<Message> {
  const invalid = validateDirectMessageBody(input.body);
  if (invalid) throw new ApiError(invalid, 'validation');
  if (input.requestId !== undefined) validId(input.requestId);
  await otherUser(client, input.recipientId);
  return unwrap(
    await client
      .rpc('send_direct_message', {
        p_recipient: input.recipientId,
        p_body: input.body.trim(),
        ...(input.requestId ? { p_request_id: input.requestId } : {}),
      })
      .single(),
  );
}
export async function getDirectConversation(
  client: CommunityLinkClient,
  userId: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<DirectConversation | null> {
  await otherUser(client, userId);
  const query = client.rpc('get_direct_conversation', { p_other_user: userId });
  const response = await (signal ? query.abortSignal(signal) : query).maybeSingle();
  const row = unwrap(response);
  return row
    ? {
        profile: {
          id: row.id,
          display_name: row.display_name,
          avatar_url: row.avatar_url,
          neighbourhood_id: row.neighbourhood_id,
        },
        connected: row.connected,
        blockedByMe: row.blocked_by_me,
        canSend: row.can_send,
      }
    : null;
}
export async function listDirectMessages(
  client: CommunityLinkClient,
  peerId: string,
  { limit = 20, cursor, signal }: DirectMessageOptions = {},
): Promise<DirectMessagePage> {
  options(limit, cursor);
  const me = await otherUser(client, peerId);
  const pair = `or(and(sender_id.eq.${me},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${me}))`;
  const older = cursor
    ? `,or(created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id}))`
    : '';
  const query = client
    .from('messages')
    .select('*')
    .or(`and(${pair}${older})`)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
  const rows = unwrap(await (signal ? query.abortSignal(signal) : query));
  const messages = rows.slice(0, limit).reverse();
  const oldest = messages[0];
  return {
    messages,
    nextCursor:
      rows.length > limit && oldest ? { createdAt: oldest.created_at, id: oldest.id } : null,
  };
}
export async function blockUser(client: CommunityLinkClient, userId: string): Promise<void> {
  await otherUser(client, userId);
  unwrap(await client.rpc('set_user_block', { p_target_user: userId, p_blocked: true }));
}
export async function unblockUser(client: CommunityLinkClient, userId: string): Promise<void> {
  await otherUser(client, userId);
  unwrap(await client.rpc('set_user_block', { p_target_user: userId, p_blocked: false }));
}
export async function listBlockedUsers(
  client: CommunityLinkClient,
  { limit = 20, cursor, signal }: DirectMessageOptions = {},
): Promise<BlockedUserPage> {
  options(limit, cursor);
  const me = await requireUserId(client);
  let query = client
    .from('blocks')
    .select(
      'blocked_id, created_at, profile:profiles!blocks_blocked_id_fkey(id, display_name, avatar_url, neighbourhood_id)',
    )
    .eq('blocker_id', me)
    .order('created_at', { ascending: false })
    .order('blocked_id', { ascending: false })
    .limit(limit + 1);
  if (cursor)
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},blocked_id.lt.${cursor.id})`,
    );
  const rows = unwrap(await (signal ? query.abortSignal(signal) : query));
  const users = rows
    .slice(0, limit)
    .map((row) => ({ id: row.blocked_id, createdAt: row.created_at, profile: row.profile }));
  const last = users.at(-1);
  return {
    users,
    nextCursor: rows.length > limit && last ? { createdAt: last.createdAt, id: last.id } : null,
  };
}
