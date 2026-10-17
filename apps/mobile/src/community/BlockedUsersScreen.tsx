import { ApiError, type BlockedUser, type MessageCursor } from '@communitylink/shared';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { listBlockedUsers, unblockUser } from '../services/community';
import {
  CommunityButton,
  CommunityError,
  communityStyles as styles,
  communityText as text,
} from './communityUi';
import { useCommunityPage } from './useCommunityPage';

async function load(signal: AbortSignal, cursor: MessageCursor | null) {
  const page = await listBlockedUsers(supabase, { cursor, signal });
  return { items: page.users, nextCursor: page.nextCursor };
}
function BlockedRow({ user, onRemove }: { user: BlockedUser; onRemove: (id: string) => void }) {
  const { profile } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  async function remove() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await unblockUser(supabase, user.id);
      onRemove(user.id);
    } catch (error) {
      setError(error instanceof ApiError ? error.message : text.blockError);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <View style={styles.card} testID="blocked-user-row">
      <Text style={styles.label}>{user.profile?.display_name || text.authorFallback}</Text>
      {confirm ? (
        <>
          <Text style={styles.body}>{text.unblockHint}</Text>
          <CommunityButton
            label={text.confirmUnblock}
            onPress={() => void remove()}
            disabled={saving || profile?.status !== 'active'}
          />
          <CommunityButton
            label={text.cancelBlockAction}
            onPress={() => setConfirm(false)}
            disabled={saving}
            secondary
          />
        </>
      ) : (
        <CommunityButton
          label={text.unblockUser}
          onPress={() => setConfirm(true)}
          disabled={saving || profile?.status !== 'active'}
          secondary
        />
      )}
      {error && <CommunityError>{error}</CommunityError>}
    </View>
  );
}
function BlockedList() {
  const list = useCommunityPage(load);
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={list.items}
      keyExtractor={(user) => user.id}
      refreshing={list.loading}
      onRefresh={list.refresh}
      ListHeaderComponent={
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>
            {text.blockedUsers}
          </Text>
          <CommunityButton
            label={text.refreshBlockedUsers}
            disabled={list.loading}
            onPress={list.refresh}
            secondary
          />
        </View>
      }
      ListEmptyComponent={
        list.loading ? (
          <ActivityIndicator accessibilityLabel="Loading blocked users" />
        ) : !list.error ? (
          <Text style={styles.body}>{text.noBlockedUsers}</Text>
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
              label={text.moreBlockedUsers}
              onPress={list.loadMore}
              disabled={list.loading}
              secondary
            />
          )}
        </View>
      }
      renderItem={({ item }) => <BlockedRow key={item.id} user={item} onRemove={list.remove} />}
    />
  );
}
export function BlockedUsersScreen() {
  const { profile } = useAuth();
  return profile ? <BlockedList key={profile.id} /> : null;
}
