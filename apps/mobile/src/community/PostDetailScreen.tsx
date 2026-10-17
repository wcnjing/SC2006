import { ApiError } from '@communitylink/shared';
import { deletePost, getPost } from '../services/community';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import {
  CommunityButton,
  CommunityError,
  communityStyles as styles,
  communityText as text,
  PostImage,
} from './communityUi';
import { useCommunityQuery } from './useCommunityQuery';
import { PostInteractions } from './PostInteractions';

export function PostDetailScreen({ id }: { id: string }) {
  const { profile } = useAuth();
  const load = useCallback((signal: AbortSignal) => getPost(supabase, id, { signal }), [id]);
  const { data: post, loading, error, retry } = useCommunityQuery(load);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const busy = useRef(false);

  async function remove() {
    if (busy.current) return;
    busy.current = true;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePost(supabase, id);
      router.dismissTo('/community');
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : text.deleteError);
    } finally {
      busy.current = false;
      setDeleting(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {loading ? (
        <ActivityIndicator accessibilityLabel="Loading post" />
      ) : error ? (
        <>
          <CommunityError>{error}</CommunityError>
          <CommunityButton label={text.retry} onPress={retry} />
        </>
      ) : !post ? (
        <Text style={styles.body}>{text.unavailable}</Text>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.label}>{post.author?.display_name || text.authorFallback}</Text>
            <Text style={styles.muted}>{new Date(post.created_at).toLocaleString()}</Text>
            <Text testID="post-detail-body" selectable style={styles.body}>
              {post.body}
            </Text>
            {post.image_url && <PostImage key={post.image_url} url={post.image_url} />}
          </View>
          {post.author_id === profile?.id && profile.status === 'active' && (
            <View style={styles.section}>
              <CommunityButton
                label={text.edit}
                disabled={deleting}
                onPress={() => router.push({ pathname: '/post/[id]/edit', params: { id } })}
              />
              {confirmDelete ? (
                <>
                  <Text style={styles.body}>{text.deleteConfirm}</Text>
                  <CommunityButton
                    label={deleting ? text.deleting : text.deleteAction}
                    disabled={deleting}
                    onPress={() => void remove()}
                  />
                  <CommunityButton
                    label={text.deleteCancel}
                    disabled={deleting}
                    onPress={() => setConfirmDelete(false)}
                    secondary
                  />
                </>
              ) : (
                <CommunityButton
                  label={text.delete}
                  onPress={() => setConfirmDelete(true)}
                  secondary
                />
              )}
              {deleteError && <CommunityError>{deleteError}</CommunityError>}
            </View>
          )}
          <PostInteractions key={post.id} postId={post.id} disabled={deleting} />
        </>
      )}
    </ScrollView>
  );
}
