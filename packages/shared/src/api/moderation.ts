import type { AuditLogEntry, Report, ReportStatus } from '../types';
import { requireUserId } from './auth';
import { ApiError, unwrap, type CommunityLinkClient } from './client';
import type { PostAuthor } from './posts';
import type { ReportCursor, ContentReportTarget } from './reports';

export const MODERATION_REASON_MAX_LENGTH = 1000;
export type ModerationAction = 'remove' | 'dismiss';
export type ModerationStatus = ReportStatus | 'all';
export interface ModerationListOptions {
  status?: ModerationStatus;
  limit?: number;
  cursor?: ReportCursor | null;
  signal?: AbortSignal;
}
export interface ModerationPage {
  reports: Report[];
  nextCursor: ReportCursor | null;
}
export interface ModerationContent {
  id: string;
  type: ContentReportTarget;
  authorId: string;
  author: PostAuthor | null;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  isRemoved: boolean;
  removedReason: string | null;
  parentPost: { id: string; body: string; is_removed: boolean } | null;
}
export interface ModerationReview {
  report: Report;
  content: ModerationContent | null;
}
export interface ModerationAuditOptions {
  limit?: number;
  cursor?: number | null;
  signal?: AbortSignal;
}
export interface ModerationAuditPage {
  entries: AuditLogEntry[];
  nextCursor: number | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validId(id: string) {
  if (!UUID.test(id)) throw new ApiError('Invalid report ID.', 'validation');
}
function pageSize(limit: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new ApiError('Page size must be between 1 and 50.', 'validation');
}
export function validateModerationReason(reason: string): string | null {
  if (!reason.trim()) return 'Enter a reason for this moderation decision.';
  if (Array.from(reason.trim()).length > MODERATION_REASON_MAX_LENGTH)
    return `Moderation reasons must be ${MODERATION_REASON_MAX_LENGTH} characters or fewer.`;
  return null;
}
// RLS is authoritative; this guard also prevents a resident's own report rows
// from being mistaken for an admin queue by a caller that bypasses the UI.
async function requireAdmin(client: CommunityLinkClient, signal?: AbortSignal) {
  const userId = await requireUserId(client);
  const query = client.from('profiles').select('role, status').eq('id', userId);
  const response = await (signal ? query.abortSignal(signal) : query).maybeSingle();
  const profile = unwrap(response);
  if (profile?.role !== 'admin' || profile.status !== 'active')
    throw new ApiError('Only active admins can moderate reports.', '42501');
}

export async function listModerationReports(
  client: CommunityLinkClient,
  { status = 'open', limit = 20, cursor, signal }: ModerationListOptions = {},
): Promise<ModerationPage> {
  pageSize(limit);
  if (!['open', 'actioned', 'dismissed', 'all'].includes(status))
    throw new ApiError('Invalid report status.', 'validation');
  if (cursor) {
    validId(cursor.id);
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        cursor.createdAt,
      ) ||
      !Number.isFinite(Date.parse(cursor.createdAt))
    )
      throw new ApiError('Invalid report cursor.', 'validation');
  }
  await requireAdmin(client, signal);
  let query = client
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
  if (status !== 'all') query = query.eq('status', status);
  if (cursor)
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  const rows = unwrap(await (signal ? query.abortSignal(signal) : query));
  const reports = rows.slice(0, limit);
  const oldest = reports.at(-1);
  return {
    reports,
    nextCursor:
      rows.length > limit && oldest ? { createdAt: oldest.created_at, id: oldest.id } : null,
  };
}

/** Review current content, including removed content. Missing targets remain dismissible. */
export async function getModerationReport(
  client: CommunityLinkClient,
  id: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<ModerationReview | null> {
  validId(id);
  await requireAdmin(client, signal);
  const query = client.from('reports').select('*').eq('id', id);
  const response = await (signal ? query.abortSignal(signal) : query).maybeSingle();
  const report = unwrap(response);
  if (!report) return null;
  let content: ModerationContent | null = null;
  if (report.target_type === 'post') {
    const target = client
      .from('posts')
      .select('*, author:profiles!posts_author_id_fkey(id, display_name, avatar_url)')
      .eq('id', report.target_id);
    const response = await (signal ? target.abortSignal(signal) : target).maybeSingle();
    const post = unwrap(response);
    if (post)
      content = {
        id: post.id,
        type: 'post',
        authorId: post.author_id,
        author: post.author,
        body: post.body,
        imageUrl: post.image_url,
        createdAt: post.created_at,
        isRemoved: post.is_removed,
        removedReason: post.removed_reason,
        parentPost: null,
      };
  } else if (report.target_type === 'comment') {
    const target = client
      .from('comments')
      .select(
        '*, author:profiles!comments_author_id_fkey(id, display_name, avatar_url), parent:posts(id, body, is_removed)',
      )
      .eq('id', report.target_id);
    const response = await (signal ? target.abortSignal(signal) : target).maybeSingle();
    const comment = unwrap(response);
    if (comment)
      content = {
        id: comment.id,
        type: 'comment',
        authorId: comment.author_id,
        author: comment.author,
        body: comment.body,
        imageUrl: null,
        createdAt: comment.created_at,
        isRemoved: comment.is_removed,
        removedReason: comment.removed_reason,
        parentPost: comment.parent,
      };
  }
  return { report, content };
}

/** Content, report outcome and audit entry commit or roll back together on the server. */
export async function reviewContentReport(
  client: CommunityLinkClient,
  reportId: string,
  action: ModerationAction,
  reason: string,
): Promise<Report> {
  validId(reportId);
  if (action !== 'remove' && action !== 'dismiss')
    throw new ApiError('Choose remove or dismiss.', 'validation');
  const invalid = validateModerationReason(reason);
  if (invalid) throw new ApiError(invalid, 'validation');
  await requireUserId(client);
  return unwrap(
    await client
      .rpc('review_content_report', {
        p_report_id: reportId,
        p_action: action,
        p_reason: reason.trim(),
      })
      .single(),
  );
}

export async function listModerationAudit(
  client: CommunityLinkClient,
  { limit = 20, cursor, signal }: ModerationAuditOptions = {},
): Promise<ModerationAuditPage> {
  pageSize(limit);
  if (cursor != null && (!Number.isSafeInteger(cursor) || cursor < 1))
    throw new ApiError('Invalid audit cursor.', 'validation');
  await requireAdmin(client, signal);
  let query = client
    .from('audit_log')
    .select('*')
    .in('action', ['remove_content', 'dismiss_report'])
    .order('id', { ascending: false })
    .limit(limit + 1);
  if (cursor != null) query = query.lt('id', cursor);
  const rows = unwrap(await (signal ? query.abortSignal(signal) : query));
  const entries = rows.slice(0, limit);
  return { entries, nextCursor: rows.length > limit ? entries.at(-1)!.id : null };
}
