import * as api from '@communitylink/shared';
import { getDemoBackend } from '../demo/demoBackend';
import { DEMO_MODE } from '../lib/runtime';

// Keep the shared API signatures so the same screens exercise either backend.
export const listPosts: typeof api.listPosts = DEMO_MODE
  ? (_client, options) => getDemoBackend().listPosts(options)
  : api.listPosts;
export const getPost: typeof api.getPost = DEMO_MODE
  ? (_client, id, options) => getDemoBackend().getPost(id, options)
  : api.getPost;
export const createPost: typeof api.createPost = DEMO_MODE
  ? (_client, input) => getDemoBackend().createPost(input)
  : api.createPost;
export const updatePost: typeof api.updatePost = DEMO_MODE
  ? (_client, id, input) => getDemoBackend().updatePost(id, input)
  : api.updatePost;
export const deletePost: typeof api.deletePost = DEMO_MODE
  ? (_client, id) => getDemoBackend().deletePost(id)
  : api.deletePost;
export const listNeighbourhoods: typeof api.listNeighbourhoods = DEMO_MODE
  ? () => getDemoBackend().listNeighbourhoods()
  : api.listNeighbourhoods;

export const listComments: typeof api.listComments = DEMO_MODE
  ? (_client, id, options) => getDemoBackend().listComments(id, options)
  : api.listComments;
export const createComment: typeof api.createComment = DEMO_MODE
  ? (_client, input) => getDemoBackend().createComment(input)
  : api.createComment;
export const updateComment: typeof api.updateComment = DEMO_MODE
  ? (_client, id, body) => getDemoBackend().updateComment(id, body)
  : api.updateComment;
export const deleteComment: typeof api.deleteComment = DEMO_MODE
  ? (_client, id) => getDemoBackend().deleteComment(id)
  : api.deleteComment;
export const getPostLikeState: typeof api.getPostLikeState = DEMO_MODE
  ? (_client, id, options) => getDemoBackend().getPostLikeState(id, options)
  : api.getPostLikeState;
export const setPostLiked: typeof api.setPostLiked = DEMO_MODE
  ? (_client, id, liked) => getDemoBackend().setPostLiked(id, liked)
  : api.setPostLiked;
