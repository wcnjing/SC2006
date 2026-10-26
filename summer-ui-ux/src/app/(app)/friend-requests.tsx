import type { CommunityConnection } from '@communitylink/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  ScreenHeader,
  SegmentedTabs,
  TextField,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/SettingsContext';
import { ConnectionActions } from '@/features/community/ConnectionActions';
import { PersonRow } from '@/features/community/PersonRow';
import { useAsync } from '@/lib/useAsync';
import { communityService, errorMessageKey, errorText } from '@/services';
import { colors, spacing } from '@/theme/tokens';

type Tab = 'requests' | 'friends' | 'find';
const isTab = (v: unknown): v is Tab => v === 'requests' || v === 'friends' || v === 'find';

/**
 * Friends (FR 8.1, UC ManageConnectionRequest; Dialog Map: Profile → Friend requests).
 *   Requests: incoming (Accept / Decline) and sent (Cancel)
 *   Friends: accepted connections, with Message
 *   Find people: search residents by name and Connect
 * Open on a tab with /friend-requests?tab=find.
 */
export default function FriendsScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const t = useT();
  const me = useAuth().session?.account.accountId;
  const [tab, setTab] = useState<Tab>(isTab(params.tab) ? params.tab : 'requests');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const all = useAsync(
    async () => (await communityService.listConnections({ limit: 50 })).connections,
  );
  const people = useAsync(async () =>
    tab === 'find'
      ? (await communityService.findConnectionPeople({ query, limit: 50 })).people
      : [],
  );
  const { revalidate } = people;
  // Search as the user types, a moment after they stop.
  useEffect(() => {
    const timer = setTimeout(revalidate, 300);
    return () => clearTimeout(timer);
  }, [query, tab, revalidate]);

  const done = (error?: unknown) => {
    const text = error ? errorText(t, error) : t('connect.updated');
    setStatus({ tone: error ? 'error' : 'success', text });
    AccessibilityInfo.announceForAccessibility(text);
    all.revalidate();
    people.revalidate();
  };

  const rows = all.data ?? [];
  const other = (c: CommunityConnection) => (c.requester_id === me ? c.addressee : c.requester);
  const incoming = rows.filter((c) => c.status === 'pending' && c.addressee_id === me);
  const outgoing = rows.filter((c) => c.status === 'pending' && c.requester_id === me);
  const friends = rows.filter((c) => c.status === 'accepted');

  const list = (items: CommunityConnection[]) =>
    items.map((c) => {
      const p = other(c);
      return (
        p && (
          <PersonRow key={p.id} person={p}>
            <ConnectionActions
              userId={p.id}
              name={p.display_name}
              connection={c}
              me={me}
              onDone={done}
            />
          </PersonRow>
        )
      );
    });

  let body;
  if (tab === 'find') {
    body = (
      <>
        <TextField
          label={t('connect.searchLabel')}
          leftIcon="search"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="words"
        />
        {people.error ? (
          <ErrorState message={t(errorMessageKey(people.error))} onRetry={people.reload} />
        ) : people.loading && !people.data ? (
          <LoadingState />
        ) : people.data?.length ? (
          <View accessibilityRole="list">
            {people.data.map(({ profile, connection }) => (
              <PersonRow key={profile.id} person={profile}>
                <ConnectionActions
                  userId={profile.id}
                  name={profile.display_name}
                  connection={connection}
                  me={me}
                  onDone={done}
                />
              </PersonRow>
            ))}
          </View>
        ) : (
          <AppText color={colors.textMuted}>{t('connect.noMatches')}</AppText>
        )}
      </>
    );
  } else if (all.loading && !all.data) {
    body = <LoadingState />;
  } else if (all.error && !all.data) {
    body = <ErrorState message={t(errorMessageKey(all.error))} onRetry={all.reload} />;
  } else if (tab === 'friends') {
    body = friends.length ? (
      <View accessibilityRole="list">{list(friends)}</View>
    ) : (
      <EmptyState
        icon="people-outline"
        title={t('connect.noFriends')}
        body={t('connect.noFriendsBody')}
        actionLabel={t('connect.findPeople')}
        onAction={() => setTab('find')}
      />
    );
  } else {
    body =
      incoming.length || outgoing.length ? (
        <>
          {incoming.length > 0 && (
            <View accessibilityRole="list">
              <AppText variant="label" heading>
                {t('connect.incoming', { count: incoming.length })}
              </AppText>
              {list(incoming)}
            </View>
          )}
          {outgoing.length > 0 && (
            <View accessibilityRole="list">
              <AppText variant="label" heading>
                {t('connect.outgoing', { count: outgoing.length })}
              </AppText>
              {list(outgoing)}
            </View>
          )}
        </>
      ) : (
        <EmptyState
          icon="person-add-outline"
          title={t('connect.noRequests')}
          actionLabel={t('connect.findPeople')}
          onAction={() => setTab('find')}
        />
      );
  }

  return (
    <Screen
      header={<ScreenHeader title={t('connect.title')} />}
      contentStyle={styles.content}
      refreshing={all.refreshing}
      onRefresh={all.refresh}
    >
      <SegmentedTabs
        accessibilityLabel={t('connect.title')}
        value={tab}
        onChange={(v) => {
          setTab(v);
          setStatus(null);
        }}
        tabs={[
          { value: 'requests', label: t('connect.tabRequests') },
          { value: 'friends', label: t('connect.tabFriends') },
          { value: 'find', label: t('connect.tabFind') },
        ]}
      />
      {status && <Banner tone={status.tone}>{status.text}</Banner>}
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { gap: spacing.lg, paddingTop: spacing.sm } });
