import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import {
  CommunityButton,
  CommunityError,
  communityStyles as styles,
  communityText as text,
} from './communityUi';
import { useMyReports } from './useMyReports';

export function MyReportsScreen() {
  const { profile } = useAuth();
  const history = useMyReports(profile?.id ?? null);
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={history.reports}
      keyExtractor={(report) => report.id}
      refreshing={history.loading}
      onRefresh={history.refresh}
      ListHeaderComponent={
        <View style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            {text.myReports}
          </Text>
          <Text style={styles.body}>{text.reportHistoryHint}</Text>
          <CommunityButton
            label={text.refreshReports}
            onPress={history.refresh}
            disabled={history.loading || !profile}
            secondary
          />
        </View>
      }
      ListEmptyComponent={
        history.loading ? (
          <ActivityIndicator accessibilityLabel="Loading reports" />
        ) : !history.error ? (
          <Text style={styles.body}>{text.emptyReports}</Text>
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
              label={text.olderReports}
              onPress={history.loadMore}
              disabled={history.loading}
              secondary
            />
          )}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card} testID="report-row">
          <Text style={styles.label}>
            {item.target_type === 'post'
              ? 'Post report'
              : item.target_type === 'comment'
                ? 'Comment report'
                : `${item.target_type} report`}
          </Text>
          <Text style={styles.muted}>{new Date(item.created_at).toLocaleString()}</Text>
          <Text style={styles.label}>Status: {text.reportStatuses[item.status]}</Text>
          <Text style={styles.body} testID="report-reason">
            {item.reason}
          </Text>
          {item.details && <Text style={styles.body}>{item.details}</Text>}
          {item.resolution_note && (
            <Text style={styles.body}>Review outcome: {item.resolution_note}</Text>
          )}
        </View>
      )}
    />
  );
}
