import type { ConnectionCursor } from '@communitylink/shared';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { listConnections } from '../services/community';
import {
  CommunityButton,
  CommunityError,
  communityStyles as styles,
  communityText as text,
} from './communityUi';
import { useCommunityPage } from './useCommunityPage';

function Inbox({ userId }: { userId: string }) {
  const load = useCallback(
    async (signal: AbortSignal, cursor: ConnectionCursor | null) => {
      const page = await listConnections(supabase, { view: 'friends', cursor, signal });
      return {
        items: page.connections.map((row) => ({
          id: row.requester_id === userId ? row.addressee_id : row.requester_id,
          profile: row.requester_id === userId ? row.addressee : row.requester,
        })),
        nextCursor: page.nextCursor,
      };
    },
    [userId],
  );
  const list = useCommunityPage(load);
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={list.items}
      keyExtractor={(item) => item.id}
      refreshing={list.loading}
      onRefresh={list.refresh}
      ListHeaderComponent={
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>
            {text.messages}
          </Text>
          <Text style={styles.body}>{text.inboxHint}</Text>
          <CommunityButton
            label={text.connections}
            onPress={() => router.push('/connections')}
            secondary
          />
          <CommunityButton
            label={text.blockedUsers}
            onPress={() => router.push('/blocked-users')}
            secondary
          />
          <CommunityButton
            label={text.refreshMessages}
            onPress={list.refresh}
            disabled={list.loading}
            secondary
          />
        </View>
      }
      ListEmptyComponent={
        list.loading ? (
          <ActivityIndicator accessibilityLabel="Loading message contacts" />
        ) : !list.error ? (
          <Text style={styles.body}>{text.noMessageContacts}</Text>
        ) : null
      }
      ListFooterComponent={
        <View style={styles.section}>
          {list.error && (
            <>
              <CommunityError>{list.error}</CommunityError>
              <CommunityButton label={text.retry} onPress={list.retry} disabled={list.loading} />
            </>
          )}
          {list.hasMore && !list.error && (
            <CommunityButton
              label={text.moreConnections}
              onPress={list.loadMore}
              disabled={list.loading}
              secondary
            />
          )}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card} testID="message-contact-row">
          <Text style={styles.label}>{item.profile?.display_name || text.authorFallback}</Text>
          <CommunityButton
            label={text.openConversation}
            onPress={() => router.push({ pathname: '/messages/[id]', params: { id: item.id } })}
          />
        </View>
      )}
    />
  );
}
export function MessageInboxScreen() {
  const { profile } = useAuth();
  return profile ? <Inbox key={profile.id} userId={profile.id} /> : null;
}
