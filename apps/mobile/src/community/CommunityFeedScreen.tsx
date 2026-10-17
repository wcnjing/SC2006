import { listNeighbourhoods } from '../services/community';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import {
  CommunityButton,
  CommunityError,
  communityStyles as styles,
  communityText as text,
  NeighbourhoodPicker,
  PostImage,
} from './communityUi';
import { useCommunityQuery } from './useCommunityQuery';
import { usePostFeed } from './usePostFeed';
import { can } from '@communitylink/shared';

const loadNeighbourhoods = () => listNeighbourhoods(supabase);

export function CommunityFeedScreen() {
  const { profile } = useAuth();
  const neighbourhoods = useCommunityQuery(loadNeighbourhoods);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const neighbourhoodId =
    selectedId ?? profile?.neighbourhood_id ?? neighbourhoods.data?.[0]?.id ?? null;
  const feed = usePostFeed(neighbourhoodId);
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={feed.posts}
      keyExtractor={(post) => post.id}
      refreshing={feed.loading}
      onRefresh={feed.refresh}
      ListHeaderComponent={
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>
            {text.latest}
          </Text>
          {neighbourhoods.loading && (
            <ActivityIndicator accessibilityLabel="Loading neighbourhoods" />
          )}
          {neighbourhoods.error && (
            <>
              <CommunityError>{neighbourhoods.error}</CommunityError>
              <CommunityButton label={text.retry} onPress={neighbourhoods.retry} secondary />
            </>
          )}
          <NeighbourhoodPicker
            neighbourhoods={neighbourhoods.data ?? []}
            selectedId={neighbourhoodId}
            onSelect={setSelectedId}
          />
          {!neighbourhoods.loading && !neighbourhoods.error && !neighbourhoods.data?.length && (
            <Text style={styles.body}>{text.noNeighbourhoods}</Text>
          )}
          <CommunityButton
            label={text.create}
            disabled={!neighbourhoodId || profile?.status !== 'active'}
            onPress={() =>
              router.push({
                pathname: '/post/create',
                params: { neighbourhoodId: String(neighbourhoodId) },
              })
            }
          />
          <CommunityButton
            label={text.refresh}
            onPress={feed.refresh}
            disabled={feed.loading || !neighbourhoodId}
            secondary
          />
          <CommunityButton
            label={text.myReports}
            onPress={() => router.push('/reports')}
            secondary
          />
          {can(profile, 'report:review') && (
            <CommunityButton
              label={text.moderation}
              onPress={() => router.push('/admin/moderation')}
              secondary
            />
          )}
        </View>
      }
      ListEmptyComponent={
        feed.loading ? (
          <ActivityIndicator accessibilityLabel="Loading posts" />
        ) : !feed.error && neighbourhoodId ? (
          <Text style={styles.body}>{text.empty}</Text>
        ) : null
      }
      ListFooterComponent={
        <View style={styles.section}>
          {feed.error && (
            <>
              <CommunityError>{feed.error}</CommunityError>
              <CommunityButton label={text.retry} onPress={feed.retry} disabled={feed.loading} />
            </>
          )}
          {feed.hasMore && !feed.error && (
            <CommunityButton
              label={text.more}
              onPress={feed.loadMore}
              disabled={feed.loading}
              secondary
            />
          )}
        </View>
      }
      renderItem={({ item }) => (
        <Link href={{ pathname: '/post/[id]', params: { id: item.id } }} asChild>
          <Pressable style={styles.card} accessibilityRole="link">
            <Text style={styles.label}>{item.author?.display_name || text.authorFallback}</Text>
            <Text style={styles.muted}>{new Date(item.created_at).toLocaleString()}</Text>
            <Text style={styles.body} numberOfLines={6}>
              {item.body}
            </Text>
            {item.image_url && <PostImage key={item.image_url} url={item.image_url} />}
          </Pressable>
        </Link>
      )}
    />
  );
}
