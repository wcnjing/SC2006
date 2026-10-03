-- CommunityLink initial schema
-- Owner: P1 (Foundation & Auth). Domain tables are shaped with P2/P3/P4 input;
-- propose changes via a new migration in a PR, never by editing this file.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('resident', 'organiser', 'admin');
create type public.account_status as enum ('active', 'suspended');
create type public.activity_status as enum ('scheduled', 'cancelled', 'completed');
create type public.activity_source as enum ('organiser', 'dataset');
create type public.participation_status as enum ('joined', 'saved', 'skipped');
create type public.connection_status as enum ('pending', 'accepted');
create type public.report_target as enum ('post', 'comment', 'message', 'user', 'activity');
create type public.report_status as enum ('open', 'actioned', 'dismissed');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at fresh
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
create table public.neighbourhoods (
  id smallint generated always as identity primary key,
  name text not null unique,
  lat double precision not null,
  lng double precision not null
);

-- ---------------------------------------------------------------------------
-- Profiles (P1) — one row per auth.users row, created by trigger on sign-up
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 50),
  avatar_url text,
  bio text check (char_length(bio) <= 500),
  role public.user_role not null default 'resident',
  status public.account_status not null default 'active',
  suspended_reason text,
  neighbourhood_id smallint references public.neighbourhoods (id) on delete set null,
  interests text[] not null default '{}',
  accessibility_needs text[] not null default '{}',
  preferred_language text not null default 'en' check (preferred_language in ('en', 'zh', 'ms', 'ta')),
  singpass_verified boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create index profiles_neighbourhood_idx on public.profiles (neighbourhood_id);

-- ---------------------------------------------------------------------------
-- Activities (P2)
-- ---------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid references public.profiles (id) on delete set null,
  source public.activity_source not null default 'organiser',
  external_id text,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '',
  category text not null,
  tags text[] not null default '{}',
  neighbourhood_id smallint references public.neighbourhoods (id) on delete set null,
  location_name text not null,
  address text,
  lat double precision,
  lng double precision,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer check (capacity is null or capacity > 0),
  is_outdoor boolean not null default false,
  cost_cents integer not null default 0 check (cost_cents >= 0),
  accessibility_features text[] not null default '{}',
  status public.activity_status not null default 'scheduled',
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (source = 'dataset' or organiser_id is not null or status = 'cancelled'),
  unique (source, external_id)
);

create trigger activities_updated_at before update on public.activities
  for each row execute function public.set_updated_at();

create index activities_starts_at_idx on public.activities (starts_at);
create index activities_neighbourhood_idx on public.activities (neighbourhood_id);
create index activities_organiser_idx on public.activities (organiser_id);
create index activities_category_idx on public.activities (category);

-- joined / saved / skipped (swipe-left). One row per user per activity.
create table public.activity_participants (
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.participation_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create trigger activity_participants_updated_at before update on public.activity_participants
  for each row execute function public.set_updated_at();

create index activity_participants_user_idx on public.activity_participants (user_id, status);

create table public.activity_ratings (
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Social (P3)
-- ---------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  neighbourhood_id smallint references public.neighbourhoods (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  image_url text,
  activity_id uuid references public.activities (id) on delete set null,
  is_removed boolean not null default false,
  removed_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

create index posts_feed_idx on public.posts (neighbourhood_id, created_at desc);
create index posts_author_idx on public.posts (author_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  is_removed boolean not null default false,
  removed_reason text,
  created_at timestamptz not null default now()
);

create index comments_post_idx on public.comments (post_id, created_at);

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.connections (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.connection_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- A pair can only be connected once, whichever direction the request went.
create unique index connections_pair_idx on public.connections
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index connections_addressee_idx on public.connections (addressee_id, status);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text check (char_length(body) <= 2000),
  shared_post_id uuid references public.posts (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id),
  check (body is not null or shared_post_id is not null)
);

create index messages_thread_idx on public.messages
  (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at);
create index messages_recipient_unread_idx on public.messages (recipient_id) where read_at is null;

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

-- ---------------------------------------------------------------------------
-- Moderation (P3) and audit (P1 helpers write here)
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 100),
  details text check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);

create index reports_queue_idx on public.reports (status, created_at);
create index reports_target_idx on public.reports (target_type, target_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Notifications (P4)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
