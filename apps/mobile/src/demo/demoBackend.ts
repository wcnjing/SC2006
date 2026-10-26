import {
  ApiError,
  validatePostBody,
  validatePostImageUrl,
  type CommunityPost,
  type Comment as PostComment,
  type PostLike,
  type CommunityComment,
  type CreateCommentInput,
  type CommentListOptions,
  type CommentPage,
  type PostLikeState,
  validateCommentBody,
  type CreatePostInput,
  type Neighbourhood,
  type Post,
  type PostFeedOptions,
  type PostFeedPage,
  type Profile,
  type UpdatePostInput,
  validateReportContent,
  type SubmitReportInput,
  type SubmittedReport,
  type MyReportListOptions,
  type MyReportPage,
  can,
  validateModerationReason,
  type Report,
  type AuditLogEntry,
  type ModerationAction,
  type ModerationListOptions,
  type ModerationPage,
  type ModerationReview,
  type ModerationContent,
  type ModerationAuditOptions,
  type ModerationAuditPage,
  type Block,
  type Connection,
  type ConnectionRequestRef,
  type ConnectionPerson,
  type ConnectionListOptions,
  type ConnectionPage,
  type ConnectionPeopleOptions,
  type ConnectionPeoplePage,
  connectionRequestRef,
  type Message,
  type SendDirectMessageInput,
  type DirectMessageOptions,
  type DirectMessagePage,
  type DirectConversation,
  type BlockedUserPage,
  validateDirectMessageBody,
} from '@communitylink/shared';

export const DEMO_STORAGE_KEY = 'communitylink-p3-demo-v1';
type DemoStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type DemoState = {
  version: 1;
  userId: string | null;
  posts: Post[];
  comments: PostComment[];
  likes: PostLike[];
  reports: Report[];
  audit: AuditLogEntry[];
  connections: Connection[];
  blocks: Block[];
  connectionClock: number;
  messages: Message[];
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const neighbourhoods: Neighbourhood[] = [
  { id: 1, name: 'Bishan', lat: 1.35, lng: 103.85 },
  { id: 2, name: 'Tampines', lat: 1.35, lng: 103.94 },
  { id: 3, name: 'Punggol', lat: 1.4, lng: 103.9 },
  { id: 4, name: 'Bedok', lat: 1.32, lng: 103.93 },
];

function profile(id: string, displayName: string): Profile {
  return {
    id,
    display_name: displayName,
    neighbourhood_id: 1,
    role: 'resident',
    status: 'active',
    avatar_url: null,
    bio: null,
    interests: ['social'],
    accessibility_needs: [],
    preferred_language: 'en',
    onboarded: true,
    singpass_verified: false,
    suspended_reason: null,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
  };
}

export const DEMO_ACCOUNTS = [
  {
    email: 'yining@demo.local',
    profile: profile('11111111-1111-4111-8111-111111111111', 'Yining'),
  },
  {
    email: 'mei@demo.local',
    profile: profile('22222222-2222-4222-8222-222222222222', 'Auntie Mei'),
  },
  {
    email: 'admin@demo.local',
    profile: {
      ...profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Demo Admin'),
      role: 'admin' as const,
    },
  },
];

function seed(): DemoState {
  const now = Date.now();
  return {
    version: 1,
    userId: null,
    comments: [],
    likes: [],
    reports: [],
    audit: [],
    connections: [],
    blocks: [],
    connectionClock: 0,
    messages: [],
    posts: Array.from({ length: 27 }, (_, index) => {
      const createdAt = new Date(now - index * 60000).toISOString();
      return {
        id: `33333333-3333-4333-8333-${String(index + 1).padStart(12, '0')}`,
        author_id: DEMO_ACCOUNTS[index % 2].profile.id,
        neighbourhood_id: index < 24 ? 1 : index < 26 ? 2 : 3,
        body:
          index === 0
            ? 'Welcome to Bishan! Share a thought with your neighbours.'
            : index === 1
              ? 'Anyone keen for a weekend walk around Bishan Park?'
              : `Neighbourhood update ${index + 1}: looking forward to meeting more neighbours!`,
        image_url: null,
        activity_id: null,
        is_removed: false,
        removed_reason: null,
        created_at: createdAt,
        updated_at: createdAt,
      };
    }),
  };
}

/** Local fixture data only. It does not simulate or prove Supabase RLS. */
export function createDemoBackend(storage: DemoStorage) {
  function write(state: DemoState) {
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  }
  function read(): DemoState {
    const raw = storage.getItem(DEMO_STORAGE_KEY);
    if (!raw) {
      const state = seed();
      write(state);
      return state;
    }
    try {
      const state = JSON.parse(raw) as DemoState;
      if (
        state.version !== 1 ||
        !Array.isArray(state.posts) ||
        (state.comments !== undefined && !Array.isArray(state.comments)) ||
        (state.likes !== undefined && !Array.isArray(state.likes)) ||
        (state.reports !== undefined && !Array.isArray(state.reports)) ||
        (state.audit !== undefined && !Array.isArray(state.audit)) ||
        (state.connections !== undefined && !Array.isArray(state.connections)) ||
        (state.blocks !== undefined && !Array.isArray(state.blocks)) ||
        (state.messages !== undefined && !Array.isArray(state.messages)) ||
        (state.userId !== null &&
          !DEMO_ACCOUNTS.some((account) => account.profile.id === state.userId))
      )
        throw new Error();
      // Upgrade existing demo data without discarding the user's posts/session.
      const upgraded = {
        ...state,
        comments: state.comments ?? [],
        likes: state.likes ?? [],
        reports: (state.reports ?? []).map((row) => ({
          ...row,
          reviewed_by: row.reviewed_by ?? null,
        })),
        audit: state.audit ?? [],
        connections: state.connections ?? [],
        blocks: state.blocks ?? [],
        connectionClock: state.connectionClock ?? 0,
        messages: state.messages ?? [],
      };
      if (
        state.comments === undefined ||
        state.likes === undefined ||
        state.reports === undefined ||
        state.audit === undefined ||
        state.connections === undefined ||
        state.blocks === undefined ||
        state.connectionClock === undefined ||
        state.messages === undefined ||
        state.reports.some((row) => row.reviewed_by === undefined)
      )
        write(upgraded);
      return upgraded;
    } catch {
      throw new ApiError(
        'Demo data could not be loaded. Use Reset demo data to start again.',
        'demo_storage',
      );
    }
  }
  function requireProfile(state: DemoState): Profile {
    const current = DEMO_ACCOUNTS.find((account) => account.profile.id === state.userId)?.profile;
    if (!current) throw new ApiError('Choose a demo resident first.', 'unauthenticated');
    return current;
  }
  function requireAdmin(state: DemoState): Profile {
    const current = requireProfile(state);
    if (!can(current, 'report:review'))
      throw new ApiError('Only active admins can moderate reports.', '42501');
    return current;
  }
  function requireActive(state: DemoState): Profile {
    const current = requireProfile(state);
    if (current.status !== 'active')
      throw new ApiError('Only active users can manage connection requests.', '42501');
    return current;
  }
  function blocked(state: DemoState, a: string, b: string) {
    return state.blocks.some(
      (row) =>
        (row.blocker_id === a && row.blocked_id === b) ||
        (row.blocker_id === b && row.blocked_id === a),
    );
  }
  function connected(state: DemoState, a: string, b: string) {
    return (
      !blocked(state, a, b) &&
      state.connections.some(
        (row) =>
          row.status === 'accepted' &&
          ((row.requester_id === a && row.addressee_id === b) ||
            (row.requester_id === b && row.addressee_id === a)),
      )
    );
  }
  function visibleAuthor(state: DemoState, authorId: string) {
    const me = requireProfile(state);
    return me.id === authorId || can(me, 'report:review') || !blocked(state, me.id, authorId);
  }
  function connectionPerson(id: string) {
    const current = DEMO_ACCOUNTS.find((row) => row.profile.id === id)?.profile;
    return current
      ? {
          id: current.id,
          display_name: current.display_name,
          avatar_url: current.avatar_url,
          neighbourhood_id: current.neighbourhood_id,
        }
      : null;
  }
  function timestamp(state: DemoState) {
    state.connectionClock = Math.max(Date.now(), state.connectionClock + 1);
    return new Date(state.connectionClock).toISOString();
  }
  async function manageConnection(
    ref: ConnectionRequestRef,
    action: 'accept' | 'reject' | 'cancel',
  ) {
    const state = read();
    const actor = requireActive(state);
    if (
      !UUID.test(ref.requesterId) ||
      !UUID.test(ref.addresseeId) ||
      ref.requesterId === ref.addresseeId ||
      !Number.isFinite(Date.parse(ref.createdAt))
    )
      throw new ApiError('Invalid connection request.', 'validation');
    if ((action === 'cancel' ? ref.requesterId : ref.addresseeId) !== actor.id)
      throw new ApiError('You cannot perform this request action.', '42501');
    const row = state.connections.find(
      (connection) =>
        connection.requester_id === ref.requesterId && connection.addressee_id === ref.addresseeId,
    );
    if (!row) {
      if (action === 'accept') throw new ApiError('This request is no longer available.', 'P0002');
      return null;
    }
    if (Date.parse(row.created_at) !== Date.parse(ref.createdAt))
      throw new ApiError('This request changed. Refresh before continuing.', '40001');
    if (action === 'accept') {
      const requester = DEMO_ACCOUNTS.find(
        (account) => account.profile.id === ref.requesterId,
      )?.profile;
      if (blocked(state, ref.requesterId, ref.addresseeId) || requester?.status !== 'active')
        throw new ApiError('This connection request is unavailable.', '42501');
      if (row.status === 'pending') {
        row.status = 'accepted';
        row.responded_at = timestamp(state);
        write(state);
      }
      return { ...row };
    }
    if (row.status !== 'pending')
      throw new ApiError('This request was already accepted. Refresh before continuing.', '40001');
    state.connections = state.connections.filter((connection) => connection !== row);
    write(state);
    return { ...row };
  }
  function submitted(report: Report): SubmittedReport {
    const { reviewed_by: _reviewer, ...row } = report;
    return row;
  }
  function moderationContent(state: DemoState, report: Report): ModerationContent | null {
    if (report.target_type === 'post') {
      const post = state.posts.find((row) => row.id === report.target_id);
      return post
        ? {
            id: post.id,
            type: 'post',
            authorId: post.author_id,
            author: hydrate(post).author,
            body: post.body,
            imageUrl: post.image_url,
            createdAt: post.created_at,
            isRemoved: post.is_removed,
            removedReason: post.removed_reason,
            parentPost: null,
          }
        : null;
    }
    if (report.target_type === 'comment') {
      const comment = state.comments.find((row) => row.id === report.target_id);
      const parent = state.posts.find((row) => row.id === comment?.post_id);
      return comment
        ? {
            id: comment.id,
            type: 'comment',
            authorId: comment.author_id,
            author: hydrateComment(comment).author,
            body: comment.body,
            imageUrl: null,
            createdAt: comment.created_at,
            isRemoved: comment.is_removed,
            removedReason: comment.removed_reason,
            parentPost: parent
              ? { id: parent.id, body: parent.body, is_removed: parent.is_removed }
              : null,
          }
        : null;
    }
    return null;
  }
  function hydrate(post: Post): CommunityPost {
    const author = DEMO_ACCOUNTS.find((account) => account.profile.id === post.author_id)?.profile;
    return {
      ...post,
      author: author
        ? { id: author.id, display_name: author.display_name, avatar_url: author.avatar_url }
        : null,
    };
  }
  function validateNeighbourhood(id: number) {
    if (!neighbourhoods.some((neighbourhood) => neighbourhood.id === id))
      throw new ApiError('Choose a neighbourhood.', 'validation');
  }
  function content(input: UpdatePostInput): Partial<Post> {
    const patch: Partial<Post> = {};
    if (input.body !== undefined) {
      const error = validatePostBody(input.body);
      if (error) throw new ApiError(error, 'validation');
      patch.body = input.body.trim();
    }
    if (input.imageUrl !== undefined) {
      const error = validatePostImageUrl(input.imageUrl ?? '');
      if (error) throw new ApiError(error, 'validation');
      patch.image_url = input.imageUrl?.trim() || null;
    }
    if (input.neighbourhoodId !== undefined) {
      validateNeighbourhood(input.neighbourhoodId);
      patch.neighbourhood_id = input.neighbourhoodId;
    }
    return patch;
  }
  function ownPost(state: DemoState, id: string): Post {
    const current = requireProfile(state);
    const post = state.posts.find(
      (row) => row.id === id && row.author_id === current.id && !row.is_removed,
    );
    if (!post) throw new ApiError('This post is unavailable or you cannot change it.', 'not_found');
    return post;
  }

  function visiblePost(state: DemoState, id: string): Post {
    requireProfile(state);
    const post = state.posts.find(
      (row) => row.id === id && !row.is_removed && visibleAuthor(state, row.author_id),
    );
    if (!post) throw new ApiError('This post is unavailable.', 'not_found');
    return post;
  }
  function hydrateComment(comment: PostComment): CommunityComment {
    const author = DEMO_ACCOUNTS.find(
      (account) => account.profile.id === comment.author_id,
    )?.profile;
    return {
      ...comment,
      author: author
        ? { id: author.id, display_name: author.display_name, avatar_url: author.avatar_url }
        : null,
    };
  }
  function commentBody(body: string): string {
    const error = validateCommentBody(body);
    if (error) throw new ApiError(error, 'validation');
    return body.trim();
  }
  function ownComment(state: DemoState, id: string): PostComment {
    const author = requireProfile(state);
    const comment = state.comments.find(
      (row) => row.id === id && row.author_id === author.id && !row.is_removed,
    );
    if (!comment)
      throw new ApiError('This comment is unavailable or you cannot change it.', 'not_found');
    visiblePost(state, comment.post_id);
    return comment;
  }
  function likeState(state: DemoState, postId: string): PostLikeState {
    const author = requireProfile(state);
    visiblePost(state, postId);
    const likes = state.likes.filter((like) => like.post_id === postId);
    return { likeCount: likes.length, likedByMe: likes.some((like) => like.user_id === author.id) };
  }

  return {
    reset() {
      storage.removeItem(DEMO_STORAGE_KEY);
    },
    getProfile(): Profile | null {
      const state = read();
      return DEMO_ACCOUNTS.find((account) => account.profile.id === state.userId)?.profile ?? null;
    },
    signIn(email: string): Profile {
      const account = DEMO_ACCOUNTS.find((candidate) => candidate.email === email);
      if (!account) throw new ApiError('Choose one of the demo residents.', 'validation');
      const state = read();
      write({ ...state, userId: account.profile.id });
      return account.profile;
    },
    signOut() {
      write({ ...read(), userId: null });
    },
    async listNeighbourhoods(): Promise<Neighbourhood[]> {
      return neighbourhoods.map((row) => ({ ...row }));
    },
    async listPosts({
      neighbourhoodId,
      limit = 20,
      cursor,
      signal,
    }: PostFeedOptions): Promise<PostFeedPage> {
      signal?.throwIfAborted();
      const state = read();
      requireProfile(state);
      validateNeighbourhood(neighbourhoodId);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50)
        throw new ApiError('Invalid page size.', 'validation');
      const rows = state.posts
        .filter(
          (post) =>
            !post.is_removed &&
            post.neighbourhood_id === neighbourhoodId &&
            visibleAuthor(state, post.author_id),
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
        .filter(
          (post) =>
            !cursor ||
            post.created_at < cursor.createdAt ||
            (post.created_at === cursor.createdAt && post.id < cursor.id),
        );
      const posts = rows.slice(0, limit).map(hydrate);
      const last = posts.at(-1);
      return {
        posts,
        nextCursor:
          rows.length > limit && last ? { createdAt: last.created_at, id: last.id } : null,
      };
    },
    async getPost(
      id: string,
      { signal }: { signal?: AbortSignal } = {},
    ): Promise<CommunityPost | null> {
      signal?.throwIfAborted();
      const state = read();
      requireProfile(state);
      const post = state.posts.find(
        (row) => row.id === id && !row.is_removed && visibleAuthor(state, row.author_id),
      );
      return post ? hydrate(post) : null;
    },
    async createPost(input: CreatePostInput): Promise<CommunityPost> {
      const state = read();
      const author = requireProfile(state);
      const patch = content({ ...input, imageUrl: input.imageUrl ?? null });
      // The actual editor supplies a stable UUID. Other callers can omit it.
      const id = input.requestId ?? (await import('expo-crypto')).randomUUID();
      if (!UUID.test(id)) throw new ApiError('Invalid draft ID.', 'validation');
      const existing = state.posts.find((post) => post.id === id);
      if (existing) {
        ownPost(state, id);
        Object.assign(existing, patch, { updated_at: new Date().toISOString() });
        write(state);
        return hydrate(existing);
      }
      const now = new Date().toISOString();
      const post: Post = {
        id,
        author_id: author.id,
        neighbourhood_id: input.neighbourhoodId,
        body: patch.body!,
        image_url: patch.image_url ?? null,
        activity_id: null,
        is_removed: false,
        removed_reason: null,
        created_at: now,
        updated_at: now,
      };
      write({ ...state, posts: [post, ...state.posts] });
      return hydrate(post);
    },
    async updatePost(id: string, input: UpdatePostInput): Promise<CommunityPost> {
      const state = read();
      const post = ownPost(state, id);
      const patch = content(input);
      if (!Object.keys(patch).length) throw new ApiError('No changes to save.', 'validation');
      Object.assign(post, patch, { updated_at: new Date().toISOString() });
      write(state);
      return hydrate(post);
    },
    async deletePost(id: string): Promise<void> {
      const state = read();
      ownPost(state, id);
      write({
        ...state,
        posts: state.posts.filter((post) => post.id !== id),
        comments: state.comments.filter((comment) => comment.post_id !== id),
        likes: state.likes.filter((like) => like.post_id !== id),
      });
    },
    async listComments(
      postId: string,
      { limit = 20, cursor, signal }: CommentListOptions = {},
    ): Promise<CommentPage> {
      signal?.throwIfAborted();
      const state = read();
      visiblePost(state, postId);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50)
        throw new ApiError('Invalid comment page size.', 'validation');
      const rows = state.comments
        .filter(
          (comment) =>
            comment.post_id === postId &&
            !comment.is_removed &&
            visibleAuthor(state, comment.author_id),
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
        .filter(
          (comment) =>
            !cursor ||
            comment.created_at < cursor.createdAt ||
            (comment.created_at === cursor.createdAt && comment.id < cursor.id),
        );
      const comments = rows.slice(0, limit).reverse().map(hydrateComment);
      const oldest = comments[0];
      return {
        comments,
        nextCursor:
          rows.length > limit && oldest ? { createdAt: oldest.created_at, id: oldest.id } : null,
      };
    },
    async createComment(input: CreateCommentInput): Promise<CommunityComment> {
      const state = read();
      const author = requireProfile(state);
      visiblePost(state, input.postId);
      const body = commentBody(input.body);
      const id = input.requestId ?? (await import('expo-crypto')).randomUUID();
      if (!UUID.test(id)) throw new ApiError('Invalid draft ID.', 'validation');
      const existing = state.comments.find((comment) => comment.id === id);
      if (existing) {
        ownComment(state, id);
        if (existing.post_id !== input.postId)
          throw new ApiError('This comment belongs to another post.', 'conflict');
        existing.body = body;
        write(state);
        return hydrateComment(existing);
      }
      const comment: PostComment = {
        id,
        post_id: input.postId,
        author_id: author.id,
        body,
        is_removed: false,
        removed_reason: null,
        created_at: new Date().toISOString(),
      };
      write({ ...state, comments: [...state.comments, comment] });
      return hydrateComment(comment);
    },
    async updateComment(id: string, body: string): Promise<CommunityComment> {
      const state = read();
      const comment = ownComment(state, id);
      comment.body = commentBody(body);
      write(state);
      return hydrateComment(comment);
    },
    async deleteComment(id: string): Promise<void> {
      const state = read();
      ownComment(state, id);
      write({ ...state, comments: state.comments.filter((comment) => comment.id !== id) });
    },
    async getPostLikeState(
      postId: string,
      { signal }: { signal?: AbortSignal } = {},
    ): Promise<PostLikeState> {
      signal?.throwIfAborted();
      return likeState(read(), postId);
    },
    async submitReport(input: SubmitReportInput): Promise<SubmittedReport> {
      const state = read();
      const reporter = requireProfile(state);
      if (input.targetType !== 'post' && input.targetType !== 'comment')
        throw new ApiError('You can report a post or comment here.', 'validation');
      if (
        !UUID.test(input.targetId) ||
        (input.requestId !== undefined && !UUID.test(input.requestId))
      )
        throw new ApiError('Invalid report or content ID.', 'validation');
      const invalid = validateReportContent(input.reason, input.details);
      if (invalid) throw new ApiError(invalid, 'validation');
      const reason = input.reason.trim();
      const details = input.details?.trim() || null;
      const existing = state.reports.find((report) => report.id === input.requestId);
      if (existing) {
        if (
          existing.reporter_id !== reporter.id ||
          existing.target_type !== input.targetType ||
          existing.target_id !== input.targetId ||
          existing.reason !== reason ||
          existing.details !== details
        )
          throw new ApiError(
            'This report was already submitted with different details. Check My reports before sending another.',
            'conflict',
          );
        return submitted(existing);
      }
      if (input.targetType === 'post') visiblePost(state, input.targetId);
      else {
        const comment = state.comments.find((row) => row.id === input.targetId && !row.is_removed);
        if (!comment || !visibleAuthor(state, comment.author_id))
          throw new ApiError('This comment is unavailable.', 'not_found');
        visiblePost(state, comment.post_id);
      }
      const report: Report = {
        id: input.requestId ?? (await import('expo-crypto')).randomUUID(),
        reporter_id: reporter.id,
        target_type: input.targetType,
        target_id: input.targetId,
        reason,
        details,
        status: 'open',
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
        resolution_note: null,
      };
      write({ ...state, reports: [...state.reports, report] });
      return submitted(report);
    },
    async listMyReports({
      limit = 20,
      cursor,
      signal,
    }: MyReportListOptions = {}): Promise<MyReportPage> {
      signal?.throwIfAborted();
      const state = read();
      const reporter = requireProfile(state);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50)
        throw new ApiError('Report page size must be between 1 and 50.', 'validation');
      if (
        cursor &&
        (!UUID.test(cursor.id) ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
            cursor.createdAt,
          ) ||
          !Number.isFinite(Date.parse(cursor.createdAt)))
      )
        throw new ApiError('Invalid report cursor.', 'validation');
      const rows = state.reports
        .filter((report) => report.reporter_id === reporter.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
        .filter(
          (report) =>
            !cursor ||
            report.created_at < cursor.createdAt ||
            (report.created_at === cursor.createdAt && report.id < cursor.id),
        );
      const reports = rows.slice(0, limit).map(submitted);
      const oldest = reports.at(-1);
      return {
        reports,
        nextCursor:
          rows.length > limit && oldest ? { createdAt: oldest.created_at, id: oldest.id } : null,
      };
    },
    async listModerationReports({
      status = 'open',
      limit = 20,
      cursor,
      signal,
    }: ModerationListOptions = {}): Promise<ModerationPage> {
      signal?.throwIfAborted();
      const state = read();
      requireAdmin(state);
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 50 ||
        !['all', 'open', 'actioned', 'dismissed'].includes(status)
      )
        throw new ApiError('Invalid report filters.', 'validation');
      if (
        cursor &&
        (!UUID.test(cursor.id) ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
            cursor.createdAt,
          ) ||
          !Number.isFinite(Date.parse(cursor.createdAt)))
      )
        throw new ApiError('Invalid report cursor.', 'validation');
      const rows = state.reports
        .filter((row) => status === 'all' || row.status === status)
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
        .filter(
          (row) =>
            !cursor ||
            row.created_at < cursor.createdAt ||
            (row.created_at === cursor.createdAt && row.id < cursor.id),
        );
      const reports = rows.slice(0, limit).map((row) => ({ ...row }));
      const last = reports.at(-1);
      return {
        reports,
        nextCursor:
          rows.length > limit && last ? { createdAt: last.created_at, id: last.id } : null,
      };
    },
    async getModerationReport(
      id: string,
      { signal }: { signal?: AbortSignal } = {},
    ): Promise<ModerationReview | null> {
      signal?.throwIfAborted();
      const state = read();
      requireAdmin(state);
      if (!UUID.test(id)) throw new ApiError('Invalid report ID.', 'validation');
      const report = state.reports.find((row) => row.id === id);
      return report ? { report: { ...report }, content: moderationContent(state, report) } : null;
    },
    async reviewContentReport(
      reportId: string,
      action: ModerationAction,
      reason: string,
    ): Promise<Report> {
      const state = read();
      const admin = requireAdmin(state);
      if (!UUID.test(reportId) || (action !== 'remove' && action !== 'dismiss'))
        throw new ApiError('Invalid moderation decision.', 'validation');
      const invalid = validateModerationReason(reason);
      if (invalid) throw new ApiError(invalid, 'validation');
      const report = state.reports.find((row) => row.id === reportId);
      if (!report) throw new ApiError('Report not found.', 'P0002');
      const status = action === 'remove' ? 'actioned' : 'dismissed';
      const normalized = reason.trim();
      if (report.status !== 'open') {
        if (
          report.status === status &&
          report.reviewed_by === admin.id &&
          report.resolution_note === normalized
        )
          return { ...report };
        throw new ApiError('This report was already reviewed. Refresh before continuing.', '40001');
      }
      let changed = false;
      if (action === 'remove') {
        if (report.target_type !== 'post' && report.target_type !== 'comment')
          throw new ApiError('Removal supports posts and comments only.', 'validation');
        const target = (report.target_type === 'post' ? state.posts : state.comments).find(
          (row) => row.id === report.target_id,
        );
        if (!target)
          throw new ApiError(
            'The reported content was deleted. Dismiss the report with a reason.',
            'P0002',
          );
        changed = !target.is_removed;
        if (changed) {
          target.is_removed = true;
          target.removed_reason = normalized;
        }
        if (report.target_type === 'post' && changed)
          (target as Post).updated_at = new Date().toISOString();
      }
      const now = new Date().toISOString();
      Object.assign(report, {
        status,
        reviewed_by: admin.id,
        reviewed_at: now,
        resolution_note: normalized,
      });
      state.audit.push({
        id: Math.max(0, ...state.audit.map((entry) => entry.id)) + 1,
        actor_id: admin.id,
        action: action === 'remove' ? 'remove_content' : 'dismiss_report',
        target_type: action === 'remove' ? report.target_type : 'report',
        target_id: action === 'remove' ? report.target_id : report.id,
        created_at: now,
        details: {
          report_id: report.id,
          reason: normalized,
          target_type: report.target_type,
          target_id: report.target_id,
          from: 'open',
          to: status,
          content_changed: changed,
        },
      });
      // One storage write commits content, report and audit together in this demo.
      write(state);
      return { ...report };
    },
    async listModerationAudit({
      limit = 20,
      cursor,
      signal,
    }: ModerationAuditOptions = {}): Promise<ModerationAuditPage> {
      signal?.throwIfAborted();
      const state = read();
      requireAdmin(state);
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 50 ||
        (cursor != null && (!Number.isSafeInteger(cursor) || cursor < 1))
      )
        throw new ApiError('Invalid audit page.', 'validation');
      const rows = state.audit
        .filter((row) => cursor == null || row.id < cursor)
        .sort((a, b) => b.id - a.id);
      const entries = rows.slice(0, limit).map((row) => ({ ...row }));
      return { entries, nextCursor: rows.length > limit ? entries.at(-1)!.id : null };
    },
    async sendConnectionRequest(targetUserId: string): Promise<Connection> {
      const state = read();
      const actor = requireActive(state);
      if (!UUID.test(targetUserId) || targetUserId === actor.id)
        throw new ApiError('Choose another resident.', 'validation');
      const target = DEMO_ACCOUNTS.find((account) => account.profile.id === targetUserId)?.profile;
      if (target?.status !== 'active')
        throw new ApiError('This resident is unavailable for requests.', 'P0002');
      if (blocked(state, actor.id, targetUserId))
        throw new ApiError('This connection request is unavailable.', '42501');
      const existing = state.connections.find(
        (row) =>
          (row.requester_id === actor.id && row.addressee_id === targetUserId) ||
          (row.requester_id === targetUserId && row.addressee_id === actor.id),
      );
      if (existing) return { ...existing };
      const row: Connection = {
        requester_id: actor.id,
        addressee_id: targetUserId,
        status: 'pending',
        created_at: timestamp(state),
        responded_at: null,
      };
      state.connections.push(row);
      write(state);
      return { ...row };
    },
    async acceptConnectionRequest(ref: ConnectionRequestRef): Promise<Connection> {
      const row = await manageConnection(ref, 'accept');
      if (!row) throw new ApiError('This request is no longer available.', 'not_found');
      return row;
    },
    async rejectConnectionRequest(ref: ConnectionRequestRef): Promise<void> {
      await manageConnection(ref, 'reject');
    },
    async cancelConnectionRequest(ref: ConnectionRequestRef): Promise<void> {
      await manageConnection(ref, 'cancel');
    },
    async listConnections({
      view = 'all',
      limit = 20,
      cursor,
      signal,
    }: ConnectionListOptions = {}): Promise<ConnectionPage> {
      signal?.throwIfAborted();
      const state = read();
      const actor = requireProfile(state);
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 50 ||
        !['incoming', 'outgoing', 'friends', 'all'].includes(view)
      )
        throw new ApiError('Invalid connection filters.', 'validation');
      if (
        cursor &&
        (!UUID.test(cursor.requesterId) ||
          !UUID.test(cursor.addresseeId) ||
          !Number.isFinite(Date.parse(cursor.createdAt)))
      )
        throw new ApiError('Invalid connection cursor.', 'validation');
      const rows = state.connections
        .filter(
          (row) =>
            (row.requester_id === actor.id || row.addressee_id === actor.id) &&
            !blocked(state, row.requester_id, row.addressee_id),
        )
        .filter((row) =>
          view === 'incoming'
            ? row.addressee_id === actor.id && row.status === 'pending'
            : view === 'outgoing'
              ? row.requester_id === actor.id && row.status === 'pending'
              : view === 'friends'
                ? row.status === 'accepted'
                : true,
        )
        .sort(
          (a, b) =>
            b.created_at.localeCompare(a.created_at) ||
            b.requester_id.localeCompare(a.requester_id) ||
            b.addressee_id.localeCompare(a.addressee_id),
        )
        .filter(
          (row) =>
            !cursor ||
            row.created_at < cursor.createdAt ||
            (row.created_at === cursor.createdAt &&
              (row.requester_id < cursor.requesterId ||
                (row.requester_id === cursor.requesterId &&
                  row.addressee_id < cursor.addresseeId))),
        );
      const connections = rows.slice(0, limit).map((row) => ({
        ...row,
        requester: connectionPerson(row.requester_id),
        addressee: connectionPerson(row.addressee_id),
      }));
      return {
        connections,
        nextCursor: rows.length > limit ? connectionRequestRef(connections.at(-1)!) : null,
      };
    },
    async findConnectionPeople({
      query = '',
      limit = 20,
      cursor,
      signal,
    }: ConnectionPeopleOptions = {}): Promise<ConnectionPeoplePage> {
      signal?.throwIfAborted();
      const state = read();
      const actor = requireActive(state);
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 50 ||
        Array.from(query.trim()).length > 50 ||
        (cursor && !UUID.test(cursor))
      )
        throw new ApiError('Invalid people search.', 'validation');
      const rows = DEMO_ACCOUNTS.map((account) => account.profile)
        .filter(
          (profile) =>
            profile.id !== actor.id &&
            profile.status === 'active' &&
            !blocked(state, actor.id, profile.id) &&
            profile.display_name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
            (!cursor || profile.id > cursor),
        )
        .sort((a, b) => a.id.localeCompare(b.id));
      const people: ConnectionPerson[] = rows.slice(0, limit).map((profile) => ({
        profile: connectionPerson(profile.id)!,
        connection:
          state.connections.find(
            (row) =>
              (row.requester_id === actor.id && row.addressee_id === profile.id) ||
              (row.addressee_id === actor.id && row.requester_id === profile.id),
          ) ?? null,
      }));
      return { people, nextCursor: rows.length > limit ? people.at(-1)!.profile.id : null };
    },
    async getDirectConversation(
      userId: string,
      { signal }: { signal?: AbortSignal } = {},
    ): Promise<DirectConversation | null> {
      signal?.throwIfAborted();
      const state = read();
      const me = requireProfile(state);
      if (!UUID.test(userId) || userId === me.id)
        throw new ApiError('Choose another resident.', 'validation');
      const peer = DEMO_ACCOUNTS.find((account) => account.profile.id === userId)?.profile;
      if (!peer) return null;
      const accepted = connected(state, me.id, userId);
      return {
        profile: connectionPerson(userId)!,
        connected: accepted,
        blockedByMe: state.blocks.some(
          (row) => row.blocker_id === me.id && row.blocked_id === userId,
        ),
        canSend: accepted && me.status === 'active' && peer.status === 'active',
      };
    },
    async sendDirectMessage(input: SendDirectMessageInput): Promise<Message> {
      const invalid = validateDirectMessageBody(input.body);
      if (invalid) throw new ApiError(invalid, 'validation');
      const id = input.requestId ?? (await import('expo-crypto')).randomUUID();
      if (!UUID.test(id) || !UUID.test(input.recipientId))
        throw new ApiError('Invalid resident or message ID.', 'validation');
      // Read after UUID generation so concurrent calls cannot overwrite old state.
      const state = read();
      const sender = requireActive(state);
      if (sender.id === input.recipientId)
        throw new ApiError('Choose another resident.', 'validation');
      const peer = DEMO_ACCOUNTS.find(
        (account) => account.profile.id === input.recipientId,
      )?.profile;
      if (!connected(state, sender.id, input.recipientId) || peer?.status !== 'active')
        throw new ApiError(
          'Messaging is unavailable. You need an accepted, unblocked connection.',
          '42501',
        );
      const existing = state.messages.find((row) => row.id === id);
      if (existing) {
        if (
          existing.sender_id !== sender.id ||
          existing.recipient_id !== input.recipientId ||
          existing.body !== input.body.trim() ||
          existing.shared_post_id !== null
        )
          throw new ApiError(
            'This message ID was already used. Refresh the conversation before starting a new message.',
            '40001',
          );
        return { ...existing };
      }
      const row: Message = {
        id,
        sender_id: sender.id,
        recipient_id: input.recipientId,
        body: input.body.trim(),
        created_at: timestamp(state),
        shared_post_id: null,
        read_at: null,
      };
      state.messages.push(row);
      write(state);
      return { ...row };
    },
    async listDirectMessages(
      userId: string,
      { limit = 20, cursor, signal }: DirectMessageOptions = {},
    ): Promise<DirectMessagePage> {
      signal?.throwIfAborted();
      const state = read();
      const me = requireProfile(state);
      if (
        !UUID.test(userId) ||
        userId === me.id ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 50 ||
        (cursor && (!UUID.test(cursor.id) || !Number.isFinite(Date.parse(cursor.createdAt))))
      )
        throw new ApiError('Invalid conversation or page.', 'validation');
      if (!connected(state, me.id, userId)) return { messages: [], nextCursor: null };
      const rows = state.messages
        .filter(
          (row) =>
            (row.sender_id === me.id && row.recipient_id === userId) ||
            (row.sender_id === userId && row.recipient_id === me.id),
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
        .filter(
          (row) =>
            !cursor ||
            row.created_at < cursor.createdAt ||
            (row.created_at === cursor.createdAt && row.id < cursor.id),
        );
      const messages = rows
        .slice(0, limit)
        .reverse()
        .map((row) => ({ ...row }));
      const oldest = messages[0];
      return {
        messages,
        nextCursor:
          rows.length > limit && oldest ? { createdAt: oldest.created_at, id: oldest.id } : null,
      };
    },
    async blockUser(userId: string): Promise<void> {
      const state = read();
      const me = requireActive(state);
      if (!UUID.test(userId) || userId === me.id)
        throw new ApiError('Choose another resident.', 'validation');
      if (!connectionPerson(userId)) throw new ApiError('Resident not found.', 'P0002');
      if (!state.blocks.some((row) => row.blocker_id === me.id && row.blocked_id === userId))
        state.blocks.push({ blocker_id: me.id, blocked_id: userId, created_at: timestamp(state) });
      state.connections = state.connections.filter(
        (row) =>
          !(
            (row.requester_id === me.id && row.addressee_id === userId) ||
            (row.requester_id === userId && row.addressee_id === me.id)
          ),
      );
      write(state);
    },
    async unblockUser(userId: string): Promise<void> {
      const state = read();
      const me = requireActive(state);
      if (!UUID.test(userId) || userId === me.id)
        throw new ApiError('Choose another resident.', 'validation');
      state.blocks = state.blocks.filter(
        (row) => row.blocker_id !== me.id || row.blocked_id !== userId,
      );
      write(state);
    },
    async listBlockedUsers({
      limit = 20,
      cursor,
      signal,
    }: DirectMessageOptions = {}): Promise<BlockedUserPage> {
      signal?.throwIfAborted();
      const state = read();
      const me = requireProfile(state);
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 50 ||
        (cursor && (!UUID.test(cursor.id) || !Number.isFinite(Date.parse(cursor.createdAt))))
      )
        throw new ApiError('Invalid blocked-users page.', 'validation');
      const rows = state.blocks
        .filter((row) => row.blocker_id === me.id)
        .sort(
          (a, b) =>
            b.created_at.localeCompare(a.created_at) || b.blocked_id.localeCompare(a.blocked_id),
        )
        .filter(
          (row) =>
            !cursor ||
            row.created_at < cursor.createdAt ||
            (row.created_at === cursor.createdAt && row.blocked_id < cursor.id),
        );
      const users = rows.slice(0, limit).map((row) => ({
        id: row.blocked_id,
        createdAt: row.created_at,
        profile: connectionPerson(row.blocked_id),
      }));
      const last = users.at(-1);
      return {
        users,
        nextCursor: rows.length > limit && last ? { createdAt: last.createdAt, id: last.id } : null,
      };
    },
    async setPostLiked(postId: string, liked: boolean): Promise<PostLikeState> {
      const state = read();
      const author = requireProfile(state);
      visiblePost(state, postId);
      if (typeof liked !== 'boolean') throw new ApiError('Invalid like state.', 'validation');
      const mine = state.likes.some(
        (like) => like.post_id === postId && like.user_id === author.id,
      );
      if (liked && !mine)
        state.likes.push({
          post_id: postId,
          user_id: author.id,
          created_at: new Date().toISOString(),
        });
      if (!liked)
        state.likes = state.likes.filter(
          (like) => like.post_id !== postId || like.user_id !== author.id,
        );
      write(state);
      return likeState(state, postId);
    },
  };
}

let backend: ReturnType<typeof createDemoBackend> | undefined;
export function getDemoBackend() {
  // Lazy access: importing a production module does not touch demo storage.
  return (backend ??= createDemoBackend(globalThis.localStorage));
}
