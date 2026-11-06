import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { listModerationAudit } from '../services/community';
import { AdminGuard } from './AdminGuard';
import {
  CommunityButton,
  CommunityError,
  communityStyles as styles,
  communityText as text,
} from './communityUi';
import { useCommunityPage } from './useCommunityPage';

async function load(signal: AbortSignal, cursor: number | null) {
  const page = await listModerationAudit(supabase, { cursor, signal });
  return { items: page.entries, nextCursor: page.nextCursor };
}
function Audit() {
  const history = useCommunityPage(load);
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={history.items}
      keyExtractor={(item) => String(item.id)}
      refreshing={history.loading}
      onRefresh={history.refresh}
      ListHeaderComponent={
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>
            {text.moderationAudit}
          </Text>
          <CommunityButton
            label={text.refreshAudit}
            onPress={history.refresh}
            disabled={history.loading}
            secondary
          />
        </View>
      }
      ListEmptyComponent={
        history.loading ? (
          <ActivityIndicator accessibilityLabel="Loading moderation audit" />
        ) : !history.error ? (
          <Text style={styles.body}>{text.emptyAudit}</Text>
        ) : null
      }
      ListFooterComponent={
        <View style={styles.section}>
          {history.error && (
            <>
              <CommunityError>{history.error}</CommunityError>
              <CommunityButton
                label={text.retry}
                onPress={history.retry}
                disabled={history.loading}
              />
            </>
          )}
          {history.hasMore && !history.error && (
            <CommunityButton
              label={text.olderAudit}
              onPress={history.loadMore}
              disabled={history.loading}
              secondary
            />
          )}
        </View>
      }
      renderItem={({ item }) => {
        const details =
          item.details && typeof item.details === 'object' && !Array.isArray(item.details)
            ? item.details
            : {};
        return (
          <View style={styles.card} testID="moderation-audit-row">
            <Text style={styles.label}>
              {item.action === 'remove_content' ? 'Content removal' : 'Report dismissal'}
            </Text>
            <Text style={styles.muted}>{new Date(item.created_at).toLocaleString()}</Text>
            <Text style={styles.body}>Admin: {item.actor_id ?? 'Deleted account'}</Text>
            <Text style={styles.muted}>
              {item.target_type}: {item.target_id}
            </Text>
            {typeof details.reason === 'string' && (
              <Text style={styles.body}>{details.reason}</Text>
            )}
            {typeof details.report_id === 'string' && (
              <Text style={styles.muted}>Report: {details.report_id}</Text>
            )}
            {item.action === 'remove_content' && details.content_changed === false && (
              <Text style={styles.muted}>{text.alreadyRemoved}</Text>
            )}
          </View>
        );
      }}
    />
  );
}
export function ModerationAuditScreen() {
  return (
    <AdminGuard>
      <Audit />
    </AdminGuard>
  );
}
