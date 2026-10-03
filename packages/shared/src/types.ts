import type { Database, Enums, Tables, TablesInsert, TablesUpdate } from './database.types';

export type { Database, Enums, Tables, TablesInsert, TablesUpdate };

// Enums
export type UserRole = Enums<'user_role'>;
export type AccountStatus = Enums<'account_status'>;
export type ActivityStatus = Enums<'activity_status'>;
export type ActivitySource = Enums<'activity_source'>;
export type ParticipationStatus = Enums<'participation_status'>;
export type ConnectionStatus = Enums<'connection_status'>;
export type ReportTarget = Enums<'report_target'>;
export type ReportStatus = Enums<'report_status'>;

// Row types — one per table. Use these instead of redeclaring shapes.
export type Neighbourhood = Tables<'neighbourhoods'>;
export type Profile = Tables<'profiles'>;
export type Activity = Tables<'activities'>;
export type ActivityParticipant = Tables<'activity_participants'>;
export type ActivityRating = Tables<'activity_ratings'>;
export type Post = Tables<'posts'>;
export type Comment = Tables<'comments'>;
export type PostLike = Tables<'post_likes'>;
export type Connection = Tables<'connections'>;
export type Message = Tables<'messages'>;
export type Block = Tables<'blocks'>;
export type Report = Tables<'reports'>;
export type AuditLogEntry = Tables<'audit_log'>;
export type Notification = Tables<'notifications'>;

// Columns a user may change on their own profile (matches the column grants
// in supabase/migrations/*_rls_policies.sql).
export type ProfileUpdate = Pick<
  TablesUpdate<'profiles'>,
  | 'display_name'
  | 'avatar_url'
  | 'bio'
  | 'neighbourhood_id'
  | 'interests'
  | 'accessibility_needs'
  | 'preferred_language'
  | 'onboarded'
>;
