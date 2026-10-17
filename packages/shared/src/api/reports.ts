import type { Report, ReportTarget } from '../types';
import { requireUserId } from './auth';
import { ApiError, unwrap, type CommunityLinkClient } from './client';

export const REPORT_REASON_MAX_LENGTH = 100;
export const REPORT_DETAILS_MAX_LENGTH = 1000;
export type ContentReportTarget = Extract<ReportTarget, 'post' | 'comment'>;
// Reviewer identity is unnecessary on the reporter's history screen.
export type SubmittedReport = Omit<Report, 'reviewed_by'>;
export interface SubmitReportInput {
  targetType: ContentReportTarget;
  targetId: string;
  reason: string;
  details?: string | null;
  requestId?: string;
}
export interface ReportCursor {
  createdAt: string;
  id: string;
}
export interface MyReportListOptions {
  limit?: number;
  cursor?: ReportCursor | null;
  signal?: AbortSignal;
}
export interface MyReportPage {
  reports: SubmittedReport[];
  nextCursor: ReportCursor | null;
}

const REPORT_SELECT =
  'id, reporter_id, target_type, target_id, reason, details, status, created_at, reviewed_at, resolution_note';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validId(id: string) {
  if (!UUID.test(id)) throw new ApiError('Invalid report or content ID.', 'validation');
}
export function validateReportContent(reason: string, details?: string | null): string | null {
  if (!reason.trim()) return 'Enter a reason for your report.';
  if (Array.from(reason.trim()).length > REPORT_REASON_MAX_LENGTH)
    return `Report reasons must be ${REPORT_REASON_MAX_LENGTH} characters or fewer.`;
  if (Array.from(details?.trim() ?? '').length > REPORT_DETAILS_MAX_LENGTH)
    return `Report details must be ${REPORT_DETAILS_MAX_LENGTH} characters or fewer.`;
  return null;
}

/** Submit only reporter-controlled fields. RLS checks the target's visibility. */
export async function submitReport(
  client: CommunityLinkClient,
  input: SubmitReportInput,
): Promise<SubmittedReport> {
  if (input.targetType !== 'post' && input.targetType !== 'comment')
    throw new ApiError('You can report a post or comment here.', 'validation');
  validId(input.targetId);
  if (input.requestId !== undefined) validId(input.requestId);
  const invalid = validateReportContent(input.reason, input.details);
  if (invalid) throw new ApiError(invalid, 'validation');
  const reporterId = await requireUserId(client);
  const reason = input.reason.trim();
  const details = input.details?.trim() || null;

  async function existingReport(): Promise<SubmittedReport | null> {
    const response = await client
      .from('reports')
      .select(REPORT_SELECT)
      .eq('id', input.requestId!)
      .eq('reporter_id', reporterId)
      .maybeSingle();
    const existing = unwrap(response);
    if (
      existing &&
      (existing.target_type !== input.targetType ||
        existing.target_id !== input.targetId ||
        existing.reason !== reason ||
        existing.details !== details)
    )
      throw new ApiError(
        'This report was already submitted with different details. Check My reports before sending another.',
        'conflict',
      );
    return existing;
  }

  // Recover a lost response even if the target has since been removed or deleted.
  if (input.requestId) {
    const existing = await existingReport();
    if (existing) return existing;
  }
  const result = await client
    .from('reports')
    .insert({
      ...(input.requestId ? { id: input.requestId } : {}),
      reporter_id: reporterId,
      target_type: input.targetType,
      target_id: input.targetId,
      reason,
      details,
    })
    .select(REPORT_SELECT)
    .single();
  // Two concurrent retries may both miss the first lookup.
  if (result.error?.code === '23505' && input.requestId) {
    const existing = await existingReport();
    if (existing) return existing;
    throw new ApiError(
      'Unable to recover this report. Check My reports and try again.',
      'conflict',
    );
  }
  return unwrap(result);
}

/** Explicit reporter filtering also keeps admins' own history separate from moderation. */
export async function listMyReports(
  client: CommunityLinkClient,
  { limit = 20, cursor, signal }: MyReportListOptions = {},
): Promise<MyReportPage> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new ApiError('Report page size must be between 1 and 50.', 'validation');
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
  const reporterId = await requireUserId(client);
  let query = client
    .from('reports')
    .select(REPORT_SELECT)
    .eq('reporter_id', reporterId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
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
