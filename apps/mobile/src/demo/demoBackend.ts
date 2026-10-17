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
} from '@communitylink/shared';

export const DEMO_STORAGE_KEY = 'communitylink-p3-demo-v1';
type DemoStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type DemoState = {
  version: 1;
  userId: string | null;
  posts: Post[];
  comments: PostComment[];
  likes: PostLike[];
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
];

function seed(): DemoState {
  const now = Date.now();
  return {
    version: 1,
    userId: null,
    comments: [],
    likes: [],
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
        (state.userId !== null &&
          !DEMO_ACCOUNTS.some((account) => account.profile.id === state.userId))
      )
        throw new Error();
      // Upgrade existing demo data without discarding the user's posts/session.
      const upgraded = { ...state, comments: state.comments ?? [], likes: state.likes ?? [] };
      if (state.comments === undefined || state.likes === undefined) write(upgraded);
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
    const post = state.posts.find((row) => row.id === id && !row.is_removed);
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
        .filter((post) => !post.is_removed && post.neighbourhood_id === neighbourhoodId)
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
      const post = state.posts.find((row) => row.id === id && !row.is_removed);
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
        .filter((comment) => comment.post_id === postId && !comment.is_removed)
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
