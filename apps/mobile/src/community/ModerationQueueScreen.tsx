import type { ModerationStatus, ReportCursor } from '@communitylink/shared';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { listModerationReports } from '../services/community';
import { AdminGuard } from './AdminGuard';
import {
  CommunityButton,
  CommunityError,
  communityStyles as styles,
  communityText as text,
} from './communityUi';
import { useModerationPage } from './useModerationPage';

function Queue() {
  const [status, setStatus] = useState<ModerationStatus>('open');
  const load = useCallback(
    async (signal: AbortSignal, cursor: ReportCursor | null) => {
      const page = await listModerationReports(supabase, { status, cursor, signal });
      return { items: page.reports, nextCursor: page.nextCursor };
    },
    [status],
  );
  const queue = useModerationPage(load);
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={queue.items}
      keyExtractor={(item) => item.id}
      refreshing={queue.loading}
      onRefresh={queue.refresh}
      ListHeaderComponent={
        <View style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            {text.moderation}
          </Text>
          <CommunityButton
            label={text.moderationAudit}
            onPress={() => router.push('/admin/audit')}
            secondary
          />
          <View style={styles.row}>
            {(['open', 'actioned', 'dismissed', 'all'] as const).map((value) => (
              <CommunityButton
                key={value}
                label={value === 'all' ? text.allReports : text.reportStatuses[value]}
                selected={status === value}
                secondary={status !== value}
                onPress={() => setStatus(value)}
              />
            ))}
          </View>
          <CommunityButton
            label={text.refreshReports}
            disabled={queue.loading}
            onPress={queue.refresh}
            secondary
          />
        </View>
      }
      ListEmptyComponent={
        queue.loading ? (
          <ActivityIndicator accessibilityLabel="Loading moderation queue" />
        ) : !queue.error ? (
          <Text style={styles.body}>{text.emptyModeration}</Text>
        ) : null
      }
      ListFooterComponent={
        <View style={styles.section}>
          {queue.error && (
            <>
              <CommunityError>{queue.error}</CommunityError>
              <CommunityButton label={text.retry} onPress={queue.retry} disabled={queue.loading} />
            </>
          )}
          {queue.hasMore && !queue.error && (
            <CommunityButton
              label={text.olderReports}
              onPress={queue.loadMore}
              disabled={queue.loading}
              secondary
            />
          )}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card} testID="moderation-report-row">
          <Text style={styles.label}>
            {item.target_type} report · {text.reportStatuses[item.status]}
          </Text>
          <Text style={styles.muted}>{new Date(item.created_at).toLocaleString()}</Text>
          <Text style={styles.body}>{item.reason}</Text>
          {item.details && <Text style={styles.body}>{item.details}</Text>}
          <CommunityButton
            label={text.reviewReport}
            onPress={() =>
              router.push({ pathname: '/admin/moderation/[id]', params: { id: item.id } })
            }
          />
        </View>
      )}
    />
  );
}
export function ModerationQueueScreen() {
  return (
    <AdminGuard>
      <Queue />
    </AdminGuard>
  );
}
