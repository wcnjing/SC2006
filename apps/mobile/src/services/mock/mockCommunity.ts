import {
  ApiError,
  can,
  validateCommentBody,
  validateDirectMessageBody,
  validateModerationReason,
  validatePostBody,
  validatePostImageUrl,
  validateReportContent,
  type AuditLogEntry,
  type Block,
  type Comment,
  type CommunityPost,
  type Connection,
  type ConnectionProfile,
  type Message,
  type Post,
  type PostLike,
  type Report,
} from '@communitylink/shared';

import { findNeighbourhood } from '@/config/catalog';
import { readJSON, writeJSON } from '@/lib/storage';

import { ServiceError, type CommunityService } from '../types';
import { cancelMockActivity, findMockActivity, mockOrganiserName } from './mockActivities';
import { currentMockUser, MOCK_IDS, mockPeople, mockUuid } from './mockBackend';

/**
 * In-device stand-in for P3's community API (@communitylink/shared posts,
 * postInteractions, reports, moderation, connections, messaging). Rules follow
 * Yining's functions and SQL: authors edit/delete only their own posts and
 * comments; removed content and blocked users' content is hidden (not from
 * admins); DMs only between connected, unblocked users; moderation is admin-only
 * and every decision writes an audit entry.
 *
 * shortcut: lists return everything (nextCursor always null); the screens ask for
 * 50 per page and have no "load more" yet. Add paging if a real feed gets longer.
 */

const KEY = 'mock-community-v1';
const delay = () => new Promise((r) => setTimeout(r, 300));

type State = {
  posts: Post[];
  comments: Comment[];
  likes: PostLike[];
  reports: Report[];
  audit: AuditLogEntry[];
  connections: Connection[];
  blocks: Block[];
  messages: Message[];
};

/** Neighbours with no login, so the feed, requests and messages have other people in them. */
const NEIGHBOURS = [
  { id: 'nb-siti', display_name: 'Siti Rahman', hood: 'tampines' },
  { id: 'nb-kumar', display_name: 'Kumar', hood: 'tampines' },
  { id: 'nb-mei', display_name: 'Auntie Mei', hood: 'tampines' },
  { id: 'nb-promo', display_name: 'BestDeals88', hood: 'tampines' },
];

const hoodId = (slug: string | null | undefined) => findNeighbourhood(slug)?.dbId ?? null;
const ago = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();

function seed(): State {
  const { mrsTan, rachel, omar } = MOCK_IDS;
  const tampines = hoodId('tampines');
  const post = (
    id: string,
    author: string,
    hours: number,
    body: string,
    hood = tampines,
  ): Post => ({
    id,
    author_id: author,
    neighbourhood_id: hood,
    body,
    image_url: null,
    activity_id: null,
    is_removed: false,
    removed_reason: null,
    created_at: ago(hours),
    updated_at: ago(hours),
  });
  const comment = (id: string, postId: string, author: string, hours: number, body: string) => ({
    id,
    post_id: postId,
    author_id: author,
    body,
    image_url: null,
    is_removed: false,
    removed_reason: null,
    created_at: ago(hours),
  });
  const p = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  return {
    posts: [
      post(
        p(1),
        'nb-siti',
        2,
        'The community garden at Block 412 has fresh kangkong ready! Come by on Saturday morning to help harvest. Gloves provided.',
      ),
      post(
        p(2),
        omar,
        5,
        'Morning Yoga at Tampines Community Club this weekend. Beginners are very welcome, just bring a mat and water.',
      ),
      post(
        p(3),
        'nb-kumar',
        26,
        'Lost: a blue umbrella at the Our Tampines Hub food court yesterday. Please message me if you found it. Thank you!',
      ),
      post(
        p(4),
        'nb-promo',
        30,
        'Earn $500 a day from home!!! Message me now for the secret link.',
      ),
      post(
        p(5),
        mrsTan,
        72,
        'Thank you to the volunteers at the mooncake workshop. My grandchildren loved the snowskin ones!',
      ),
      post(
        p(6),
        'nb-mei',
        96,
        'Anyone keen for a slow evening walk around Tampines Eco Green? Thursdays at 6 pm, we go at an easy pace.',
      ),
      post(
        p(7),
        rachel,
        8,
        'Toa Payoh neighbours: the void deck at Block 177 has a free book exchange now.',
        hoodId('toa-payoh'),
      ),
    ],
    comments: [
      comment(p(101), p(1), mrsTan, 1.5, 'I will bring extra gloves for anyone who needs them.'),
      comment(p(102), p(1), 'nb-kumar', 1, 'See you there!'),
      comment(p(103), p(6), 'nb-promo', 90, 'Walk to my shop for 50% discount!!!'),
    ],
    likes: [
      { post_id: p(1), user_id: mrsTan, created_at: ago(1.5) },
      { post_id: p(1), user_id: 'nb-kumar', created_at: ago(1) },
      { post_id: p(2), user_id: 'nb-siti', created_at: ago(4) },
      { post_id: p(5), user_id: 'nb-siti', created_at: ago(70) },
    ],
    reports: [
      {
        id: p(201),
        reporter_id: mrsTan,
        target_type: 'post',
        target_id: p(4),
        reason: 'Spam or scam',
        details: 'Looks like a money scam.',
        status: 'open',
        created_at: ago(20),
        reviewed_at: null,
        reviewed_by: null,
        resolution_note: null,
      },
      {
        id: p(202),
        reporter_id: 'nb-mei',
        target_type: 'comment',
        target_id: p(103),
        reason: 'Spam or scam',
        details: null,
        status: 'open',
        created_at: ago(80),
        reviewed_at: null,
        reviewed_by: null,
        resolution_note: null,
      },
    ],
    audit: [],
    connections: [
      {
        requester_id: 'nb-siti',
        addressee_id: mrsTan,
        status: 'accepted',
        created_at: ago(200),
        responded_at: ago(199),
      },
      {
        requester_id: 'nb-kumar',
        addressee_id: mrsTan,
        status: 'pending',
        created_at: ago(20),
        responded_at: null,
      },
      {
        requester_id: mrsTan,
        addressee_id: 'nb-mei',
        status: 'pending',
        created_at: ago(50),
        responded_at: null,
      },
    ],
    blocks: [],
    messages: [
      {
        id: p(301),
        sender_id: 'nb-siti',
        recipient_id: mrsTan,
        body: 'Hi Mrs Tan! Are you joining the gardening on Saturday?',
        activity_id: null,
        shared_post_id: null,
        image_url: null,
        read_at: null,
        created_at: ago(3),
      },
      {
        id: p(302),
        sender_id: mrsTan,
        recipient_id: 'nb-siti',
        body: 'Yes! I signed up already. See you at 9.',
        activity_id: null,
        shared_post_id: null,
        image_url: null,
        read_at: null,
        created_at: ago(2.8),
      },
      {
        id: p(303),
        sender_id: 'nb-siti',
        recipient_id: mrsTan,
        body: 'Great, I will save you a spot near the chilli plants.',
        activity_id: null,
        shared_post_id: null,
        image_url: null,
        read_at: null,
        created_at: ago(2.5),
      },
    ],
  };
}

/** Read state + the current user, run fn, and save. Like auth.uid() on the server: never trust an id from the UI. */
async function withState<T>(fn: (s: State, me: Me) => T): Promise<T> {
  await delay();
  const { account } = await currentMockUser();
  const s = (await readJSON<State>(KEY)) ?? seed();
  const me: Me = {
    id: account.accountId,
    admin: can({ role: account.roles[0], status: account.status }, 'report:review'),
  };
  const result = fn(s, me);
  await writeJSON(KEY, s);
  return result;
}
type Me = { id: string; admin: boolean };

let peopleCache: Map<string, ConnectionProfile> | null = null;
/** Public profile of anyone (mock account or seeded neighbour). Loaded before each call. */
async function loadPeople() {
  const accounts = (await mockPeople()).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    neighbourhood_id: hoodId(p.neighbourhoodSlug),
  }));
  const neighbours = NEIGHBOURS.map((n) => ({
    id: n.id,
    display_name: n.display_name,
    avatar_url: null,
    neighbourhood_id: hoodId(n.hood),
  }));
  peopleCache = new Map([...neighbours, ...accounts].map((p) => [p.id, p]));
}
const person = (id: string) => peopleCache?.get(id) ?? null;
const author = (id: string) => {
  const p = person(id);
  return p && { id: p.id, display_name: p.display_name, avatar_url: p.avatar_url };
};

const openActivity = (id: string) => {
  const a = findMockActivity(id);
  return a && a.status !== 'cancelled' ? a : null;
};
const organiser = (id: string | null) =>
  id ? (author(id) ?? { id, display_name: mockOrganiserName(id) ?? '', avatar_url: null }) : null;

const fail = (message: string, code: string): never => {
  throw new ApiError(message, code);
};
const check = (error: string | null) => error && fail(error, 'validation');
const newest = <T extends { created_at: string }>(a: T, b: T) =>
  b.created_at.localeCompare(a.created_at);
const pair = (a: string, b: string, x: string, y: string) =>
  (a === x && b === y) || (a === y && b === x);

const blocked = (s: State, a: string, b: string) =>
  s.blocks.some((r) => pair(r.blocker_id, r.blocked_id, a, b));
const connection = (s: State, a: string, b: string) =>
  s.connections.find((c) => pair(c.requester_id, c.addressee_id, a, b)) ?? null;
const connected = (s: State, a: string, b: string) =>
  !blocked(s, a, b) && connection(s, a, b)?.status === 'accepted';
const hiddenFrom = (s: State, me: Me, authorId: string) => !me.admin && blocked(s, me.id, authorId);

function visiblePost(s: State, me: Me, id: string) {
  const post = s.posts.find((p) => p.id === id && !p.is_removed);
  return post && !hiddenFrom(s, me, post.author_id) ? post : null;
}
const withAuthor = (p: Post): CommunityPost => ({ ...p, author: author(p.author_id) });
const likeState = (s: State, me: Me, postId: string) => ({
  likeCount: s.likes.filter((l) => l.post_id === postId).length,
  likedByMe: s.likes.some((l) => l.post_id === postId && l.user_id === me.id),
});

function ownPost(s: State, me: Me, id: string, verb: string) {
  const post = s.posts.find((p) => p.id === id && p.author_id === me.id && !p.is_removed);
  return post ?? fail(`This post is unavailable or you cannot ${verb} it.`, 'not_found');
}

function requireAdmin(me: Me) {
  if (!me.admin) throw new ServiceError('FORBIDDEN');
}

function pendingRef(
  s: State,
  ref: { requesterId: string; addresseeId: string; createdAt: string },
) {
  return s.connections.find(
    (c) =>
      c.requester_id === ref.requesterId &&
      c.addressee_id === ref.addresseeId &&
      c.created_at === ref.createdAt,
  );
}

const call = async <T>(fn: (s: State, me: Me) => T) => {
  await loadPeople();
  return withState(fn);
};

export const mockCommunity: CommunityService = {
  listPosts: ({ neighbourhoodId }) =>
    call((s, me) => ({
      posts: s.posts
        .filter((p) => p.neighbourhood_id === neighbourhoodId && visiblePost(s, me, p.id))
        .sort(newest)
        .map(withAuthor),
      nextCursor: null,
    })),

  getPost: (id) =>
    call((s, me) => {
      const post = visiblePost(s, me, id);
      return post ? withAuthor(post) : null;
    }),

  createPost: (input) =>
    call((s, me) => {
      check(validatePostBody(input.body));
      check(validatePostImageUrl(input.imageUrl ?? ''));
      const now = new Date().toISOString();
      const post: Post = {
        id: input.requestId ?? mockUuid(),
        author_id: me.id,
        neighbourhood_id: input.neighbourhoodId,
        body: input.body.trim(),
        image_url: input.imageUrl?.trim() || null,
        activity_id: null,
        is_removed: false,
        removed_reason: null,
        created_at: now,
        updated_at: now,
      };
      s.posts.push(post);
      return withAuthor(post);
    }),

  updatePost: (id, input) =>
    call((s, me) => {
      if (input.body !== undefined) check(validatePostBody(input.body));
      if (input.imageUrl) check(validatePostImageUrl(input.imageUrl));
      const post = ownPost(s, me, id, 'edit');
      if (input.body !== undefined) post.body = input.body.trim();
      if (input.imageUrl !== undefined) post.image_url = input.imageUrl?.trim() || null;
      if (input.neighbourhoodId !== undefined) post.neighbourhood_id = input.neighbourhoodId;
      post.updated_at = new Date().toISOString();
      return withAuthor(post);
    }),

  deletePost: (id) =>
    call((s, me) => {
      ownPost(s, me, id, 'delete');
      s.posts = s.posts.filter((p) => p.id !== id);
      s.comments = s.comments.filter((c) => c.post_id !== id);
      s.likes = s.likes.filter((l) => l.post_id !== id);
    }),

  listComments: (postId) =>
    call((s, me) => ({
      comments: visiblePost(s, me, postId)
        ? s.comments
            .filter((c) => c.post_id === postId && !c.is_removed && !hiddenFrom(s, me, c.author_id))
            .sort((a, b) => newest(b, a))
            .map((c) => ({ ...c, author: author(c.author_id) }))
        : [],
      nextCursor: null,
    })),

  createComment: (input) =>
    call((s, me) => {
      check(validateCommentBody(input.body));
      if (!visiblePost(s, me, input.postId)) fail('This post is unavailable.', 'not_found');
      const row: Comment = {
        id: input.requestId ?? mockUuid(),
        post_id: input.postId,
        author_id: me.id,
        body: input.body.trim(),
        image_url: null,
        is_removed: false,
        removed_reason: null,
        created_at: new Date().toISOString(),
      };
      s.comments.push(row);
      return { ...row, author: author(me.id) };
    }),

  deleteComment: (id) =>
    call((s, me) => {
      if (!s.comments.some((c) => c.id === id && c.author_id === me.id && !c.is_removed))
        fail('This comment is unavailable or you cannot delete it.', 'not_found');
      s.comments = s.comments.filter((c) => c.id !== id);
    }),

  getPostLikeState: (postId) =>
    call((s, me) => {
      if (!visiblePost(s, me, postId)) fail('This post is unavailable.', 'not_found');
      return likeState(s, me, postId);
    }),

  setPostLiked: (postId, liked) =>
    call((s, me) => {
      if (!visiblePost(s, me, postId)) fail('This post is unavailable.', 'not_found');
      s.likes = s.likes.filter((l) => l.post_id !== postId || l.user_id !== me.id);
      if (liked)
        s.likes.push({ post_id: postId, user_id: me.id, created_at: new Date().toISOString() });
      return likeState(s, me, postId);
    }),

  submitReport: (input) =>
    call((s, me) => {
      check(validateReportContent(input.reason, input.details));
      const target =
        input.targetType === 'post'
          ? visiblePost(s, me, input.targetId)
          : input.targetType === 'activity'
            ? openActivity(input.targetId)
            : s.comments.find((c) => c.id === input.targetId && !c.is_removed);
      if (!target) fail('This content is no longer available.', 'not_found');
      const report: Report = {
        id: input.requestId ?? mockUuid(),
        reporter_id: me.id,
        target_type: input.targetType,
        target_id: input.targetId,
        reason: input.reason.trim(),
        details: input.details?.trim() || null,
        status: 'open',
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
        resolution_note: null,
      };
      s.reports.push(report);
      const { reviewed_by: _hidden, ...submitted } = report;
      return submitted;
    }),

  listMyReports: () =>
    call((s, me) => ({
      reports: s.reports
        .filter((r) => r.reporter_id === me.id)
        .sort(newest)
        .map(({ reviewed_by: _hidden, ...r }) => r),
      nextCursor: null,
    })),

  listModerationReports: (options) =>
    call((s, me) => {
      requireAdmin(me);
      const status = options?.status ?? 'open';
      return {
        reports: s.reports.filter((r) => status === 'all' || r.status === status).sort(newest),
        nextCursor: null,
      };
    }),

  getModerationReport: (id) =>
    call((s, me) => {
      requireAdmin(me);
      const report = s.reports.find((r) => r.id === id);
      if (!report) return null;
      const post = report.target_type === 'post' && s.posts.find((p) => p.id === report.target_id);
      const comment =
        report.target_type === 'comment' && s.comments.find((c) => c.id === report.target_id);
      const parent = comment && s.posts.find((p) => p.id === comment.post_id);
      const row = post || comment;
      const activity = report.target_type === 'activity' && findMockActivity(report.target_id);
      if (activity)
        return {
          report,
          content: {
            id: activity.id,
            type: 'activity' as const,
            authorId: activity.organiser_id ?? '',
            author: organiser(activity.organiser_id),
            body: `${activity.title}\n\n${activity.description}`,
            imageUrl: null,
            createdAt: activity.created_at,
            isRemoved: activity.status === 'cancelled',
            removedReason: activity.cancelled_reason,
            parentPost: null,
          },
        };
      return {
        report,
        content: row
          ? {
              id: row.id,
              type: report.target_type as 'post' | 'comment',
              authorId: row.author_id,
              author: author(row.author_id),
              body: row.body ?? '',
              imageUrl: row.image_url,
              createdAt: row.created_at,
              isRemoved: row.is_removed,
              removedReason: row.removed_reason,
              parentPost: parent
                ? { id: parent.id, body: parent.body, is_removed: parent.is_removed }
                : null,
            }
          : null,
      };
    }),

  reviewContentReport: (reportId, action, reason) =>
    call((s, me) => {
      check(validateModerationReason(reason));
      requireAdmin(me);
      const report = s.reports.find((r) => r.id === reportId);
      if (!report) return fail('Report not found.', 'not_found');
      if (report.status !== 'open') fail('This report was already reviewed.', 'conflict');
      const now = new Date().toISOString();
      if (action === 'remove') {
        const target =
          s.posts.find((p) => p.id === report.target_id) ??
          s.comments.find((c) => c.id === report.target_id);
        if (target) Object.assign(target, { is_removed: true, removed_reason: reason.trim() });
        const activity = report.target_type === 'activity' && findMockActivity(report.target_id);
        if (activity && activity.status !== 'cancelled')
          void cancelMockActivity(activity, reason.trim());
      }
      Object.assign(report, {
        status: action === 'remove' ? 'actioned' : 'dismissed',
        reviewed_at: now,
        reviewed_by: me.id,
        resolution_note: reason.trim(),
      });
      s.audit.push({
        id: s.audit.length + 1,
        actor_id: me.id,
        action: action === 'remove' ? 'remove_content' : 'dismiss_report',
        target_type: report.target_type,
        target_id: report.target_id,
        details: { report_id: report.id, reason: reason.trim() },
        created_at: now,
      });
      return report;
    }),

  listModerationAudit: () =>
    call((s, me) => {
      requireAdmin(me);
      return { entries: [...s.audit].sort((a, b) => b.id - a.id), nextCursor: null };
    }),

  sendConnectionRequest: (targetUserId) =>
    call((s, me) => {
      if (targetUserId === me.id || !person(targetUserId))
        fail('Choose another resident.', 'validation');
      if (blocked(s, me.id, targetUserId)) fail('You cannot connect with this resident.', '42501');
      // Repeated / crossed sends return the existing relationship; they never auto-accept.
      const existing = connection(s, me.id, targetUserId);
      if (existing) return existing;
      const row: Connection = {
        requester_id: me.id,
        addressee_id: targetUserId,
        status: 'pending',
        created_at: new Date().toISOString(),
        responded_at: null,
      };
      s.connections.push(row);
      return row;
    }),

  acceptConnectionRequest: (ref) =>
    call((s, me) => {
      const row = pendingRef(s, ref);
      if (!row || row.addressee_id !== me.id || blocked(s, ref.requesterId, ref.addresseeId))
        return fail('This request is no longer available.', 'not_found');
      Object.assign(row, { status: 'accepted', responded_at: new Date().toISOString() });
      return row;
    }),

  rejectConnectionRequest: (ref) =>
    call((s, me) => {
      if (ref.addresseeId !== me.id) fail('You cannot perform this request action.', '42501');
      s.connections = s.connections.filter(
        (c) => c !== pendingRef(s, ref) || c.status !== 'pending',
      );
    }),

  cancelConnectionRequest: (ref) =>
    call((s, me) => {
      if (ref.requesterId !== me.id) fail('You cannot perform this request action.', '42501');
      s.connections = s.connections.filter(
        (c) => c !== pendingRef(s, ref) || c.status !== 'pending',
      );
    }),

  listConnections: (options) =>
    call((s, me) => {
      const view = options?.view ?? 'all';
      return {
        connections: s.connections
          .filter(
            (c) =>
              (view === 'incoming'
                ? c.addressee_id === me.id && c.status === 'pending'
                : view === 'outgoing'
                  ? c.requester_id === me.id && c.status === 'pending'
                  : (c.requester_id === me.id || c.addressee_id === me.id) &&
                    (view === 'all' || c.status === 'accepted')) &&
              !blocked(s, c.requester_id, c.addressee_id),
          )
          .sort(newest)
          .map((c) => ({
            ...c,
            requester: person(c.requester_id),
            addressee: person(c.addressee_id),
          })),
        nextCursor: null,
      };
    }),

  findConnectionPeople: (options) =>
    call((s, me) => {
      const q = options?.query?.trim().toLowerCase() ?? '';
      return {
        people: [...(peopleCache?.values() ?? [])]
          .filter(
            (p) =>
              p.id !== me.id &&
              !blocked(s, me.id, p.id) &&
              p.display_name.toLowerCase().includes(q),
          )
          .sort((a, b) => a.display_name.localeCompare(b.display_name))
          .map((profile) => ({ profile, connection: connection(s, me.id, profile.id) })),
        nextCursor: null,
      };
    }),

  getDirectConversation: (userId) =>
    call((s, me) => {
      const profile = person(userId);
      if (!profile || userId === me.id) return null;
      const isConnected = connected(s, me.id, userId);
      return {
        profile,
        role: 'resident',
        connected: isConnected,
        blockedByMe: s.blocks.some((b) => b.blocker_id === me.id && b.blocked_id === userId),
        canSend: isConnected,
      };
    }),

  sendDirectMessage: (input) =>
    call((s, me) => {
      check(validateDirectMessageBody(input.body));
      if (!connected(s, me.id, input.recipientId))
        fail('You can only message connected residents.', '42501');
      const row: Message = {
        id: input.requestId ?? mockUuid(),
        sender_id: me.id,
        recipient_id: input.recipientId,
        body: input.body.trim(),
        activity_id: null,
        shared_post_id: null,
        image_url: null,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      s.messages.push(row);
      return row;
    }),

  // Demo data has no organiser <-> resident activity chats.
  listActivityConversations: () => call(() => []),

  listDirectMessages: (peerId) =>
    call((s, me) => ({
      messages: connected(s, me.id, peerId)
        ? s.messages
            .filter((m) => pair(m.sender_id, m.recipient_id, me.id, peerId))
            .sort((a, b) => newest(b, a))
        : [],
      nextCursor: null,
    })),

  blockUser: (userId) =>
    call((s, me) => {
      if (userId === me.id || !person(userId)) fail('Choose another resident.', 'validation');
      if (!s.blocks.some((b) => b.blocker_id === me.id && b.blocked_id === userId))
        s.blocks.push({
          blocker_id: me.id,
          blocked_id: userId,
          created_at: new Date().toISOString(),
        });
      // Blocking ends any connection or request between the two (P3 migration).
      s.connections = s.connections.filter(
        (c) => !pair(c.requester_id, c.addressee_id, me.id, userId),
      );
    }),

  unblockUser: (userId) =>
    call((s, me) => {
      s.blocks = s.blocks.filter((b) => b.blocker_id !== me.id || b.blocked_id !== userId);
    }),

  listBlockedUsers: () =>
    call((s, me) => ({
      users: s.blocks
        .filter((b) => b.blocker_id === me.id)
        .sort(newest)
        .map((b) => ({ id: b.blocked_id, createdAt: b.created_at, profile: person(b.blocked_id) })),
      nextCursor: null,
    })),
};
