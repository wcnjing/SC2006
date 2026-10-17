import type { Connection, Profile } from '../types';
import { requireUserId } from './auth';
import { ApiError, unwrap, type CommunityLinkClient } from './client';

export type ConnectionProfile = Pick<
  Profile,
  'id' | 'display_name' | 'avatar_url' | 'neighbourhood_id'
>;
export type CommunityConnection = Connection & {
  requester: ConnectionProfile | null;
  addressee: ConnectionProfile | null;
};
export interface ConnectionPerson {
  profile: ConnectionProfile;
  connection: Connection | null;
}
export type ConnectionView = 'incoming' | 'outgoing' | 'friends' | 'all';
export interface ConnectionRequestRef {
  requesterId: string;
  addresseeId: string;
  createdAt: string;
}
export type ConnectionCursor = ConnectionRequestRef;
export interface ConnectionListOptions {
  view?: ConnectionView;
  limit?: number;
  cursor?: ConnectionCursor | null;
  signal?: AbortSignal;
}
export interface ConnectionPage {
  connections: CommunityConnection[];
  nextCursor: ConnectionCursor | null;
}
export interface ConnectionPeopleOptions {
  query?: string;
  limit?: number;
  cursor?: string | null;
  signal?: AbortSignal;
}
export interface ConnectionPeoplePage {
  people: ConnectionPerson[];
  nextCursor: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
function validId(id: string) {
  if (!UUID.test(id)) throw new ApiError('Invalid resident ID.', 'validation');
}
function pageSize(limit: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new ApiError('Page size must be between 1 and 50.', 'validation');
}
function validRef(ref: ConnectionRequestRef) {
  validId(ref.requesterId);
  validId(ref.addresseeId);
  if (
    ref.requesterId === ref.addresseeId ||
    !TIMESTAMP.test(ref.createdAt) ||
    !Number.isFinite(Date.parse(ref.createdAt))
  )
    throw new ApiError('Invalid connection request.', 'validation');
}
export function connectionRequestRef(row: Connection): ConnectionRequestRef {
  return {
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    createdAt: row.created_at,
  };
}

/** Repeated/crossed sends return the existing relationship; they never auto-accept. */
export async function sendConnectionRequest(
  client: CommunityLinkClient,
  targetUserId: string,
): Promise<Connection> {
  validId(targetUserId);
  const me = await requireUserId(client);
  if (me === targetUserId) throw new ApiError('Choose another resident.', 'validation');
  return unwrap(
    await client.rpc('send_connection_request', { p_target_user: targetUserId }).single(),
  );
}

async function manage(
  client: CommunityLinkClient,
  ref: ConnectionRequestRef,
  action: 'accept' | 'reject' | 'cancel',
): Promise<Connection | null> {
  validRef(ref);
  const me = await requireUserId(client);
  if ((action === 'cancel' ? ref.requesterId : ref.addresseeId) !== me)
    throw new ApiError('You cannot perform this request action.', '42501');
  const response = await client
    .rpc('manage_connection_request', {
      p_requester: ref.requesterId,
      p_addressee: ref.addresseeId,
      p_created_at: ref.createdAt,
      p_action: action,
    })
    .maybeSingle();
  return unwrap(response);
}
export async function acceptConnectionRequest(
  client: CommunityLinkClient,
  ref: ConnectionRequestRef,
): Promise<Connection> {
  const row = await manage(client, ref, 'accept');
  if (!row) throw new ApiError('This request is no longer available.', 'not_found');
  return row;
}
export async function rejectConnectionRequest(
  client: CommunityLinkClient,
  ref: ConnectionRequestRef,
): Promise<void> {
  await manage(client, ref, 'reject');
}
export async function cancelConnectionRequest(
  client: CommunityLinkClient,
  ref: ConnectionRequestRef,
): Promise<void> {
  await manage(client, ref, 'cancel');
}

export async function listConnections(
  client: CommunityLinkClient,
  { view = 'all', limit = 20, cursor, signal }: ConnectionListOptions = {},
): Promise<ConnectionPage> {
  pageSize(limit);
  if (!['incoming', 'outgoing', 'friends', 'all'].includes(view))
    throw new ApiError('Invalid connections view.', 'validation');
  if (cursor) validRef(cursor);
  const me = await requireUserId(client);
  let query = client
    .from('connections')
    .select(
      '*, requester:profiles!connections_requester_id_fkey(id, display_name, avatar_url, neighbourhood_id), addressee:profiles!connections_addressee_id_fkey(id, display_name, avatar_url, neighbourhood_id)',
    )
    .order('created_at', { ascending: false })
    .order('requester_id', { ascending: false })
    .order('addressee_id', { ascending: false })
    .limit(limit + 1);
  if (view === 'incoming') query = query.eq('addressee_id', me).eq('status', 'pending');
  if (view === 'outgoing') query = query.eq('requester_id', me).eq('status', 'pending');
  if (view === 'friends') query = query.eq('status', 'accepted');
  const participant = `or(requester_id.eq.${me},addressee_id.eq.${me})`;
  const older = cursor
    ? `or(created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},requester_id.lt.${cursor.requesterId}),and(created_at.eq.${cursor.createdAt},requester_id.eq.${cursor.requesterId},addressee_id.lt.${cursor.addresseeId}))`
    : null;
  const filters = [
    ...(view === 'friends' || view === 'all' ? [participant] : []),
    ...(older ? [older] : []),
  ];
  if (filters.length) query = query.or(`and(${filters.join(',')})`);
  const rows = unwrap(await (signal ? query.abortSignal(signal) : query));
  const connections = rows.slice(0, limit);
  const last = connections.at(-1);
  return {
    connections,
    nextCursor: rows.length > limit && last ? connectionRequestRef(last) : null,
  };
}

export async function findConnectionPeople(
  client: CommunityLinkClient,
  { query = '', limit = 20, cursor, signal }: ConnectionPeopleOptions = {},
): Promise<ConnectionPeoplePage> {
  pageSize(limit);
  const term = query.trim();
  if (Array.from(term).length > 50)
    throw new ApiError('Search names using 50 characters or fewer.', 'validation');
  if (cursor) validId(cursor);
  await requireUserId(client);
  const request = client.rpc('find_connection_people', {
    p_query: term,
    p_limit: limit + 1,
    ...(cursor ? { p_after: cursor } : {}),
  });
  const rows = unwrap(await (signal ? request.abortSignal(signal) : request));
  const people: ConnectionPerson[] = rows.slice(0, limit).map((row) => ({
    profile: {
      id: row.id,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      neighbourhood_id: row.neighbourhood_id,
    },
    connection:
      row.requester_id && row.addressee_id && row.connection_status && row.connection_created_at
        ? {
            requester_id: row.requester_id,
            addressee_id: row.addressee_id,
            status: row.connection_status,
            created_at: row.connection_created_at,
            responded_at: row.responded_at,
          }
        : null,
  }));
  return { people, nextCursor: rows.length > limit ? people.at(-1)!.profile.id : null };
}
