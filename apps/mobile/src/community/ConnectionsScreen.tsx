import {
  ApiError,
  connectionRequestRef,
  type Connection,
  type ConnectionPerson,
  type ConnectionCursor,
  type ConnectionView,
} from '@communitylink/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Text, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import {
  findConnectionPeople,
  listConnections,
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  cancelConnectionRequest,
  blockUser,
} from '../services/community';
import {
  CommunityButton,
  CommunityError,
  communityStyles as styles,
  communityText as text,
} from './communityUi';
import { useCommunityPage } from './useCommunityPage';

type Tab = 'people' | Exclude<ConnectionView, 'all'>;
type PersonRow = ConnectionPerson & { id: string };
type Cursor = string | ConnectionCursor;

function Person({
  person,
  disabled,
  onChange,
  onBlocked,
}: {
  person: PersonRow;
  disabled: boolean;
  onChange: (row: PersonRow, connection: Connection | null) => void;
  onBlocked: (id: string) => void;
}) {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'reject' | 'cancel' | 'block' | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const connection = person.connection;
  const incoming = connection?.status === 'pending' && connection.addressee_id === profile?.id;
  async function act(action: 'send' | 'accept' | 'reject' | 'cancel' | 'block') {
    if (busy.current || disabled) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      if (action === 'block') {
        await blockUser(supabase, person.id);
        if (mounted.current) onBlocked(person.id);
        return;
      }
      let updated: Connection | null = null;
      if (action === 'send') updated = await sendConnectionRequest(supabase, person.id);
      else if (connection) {
        const ref = connectionRequestRef(connection);
        if (action === 'accept') updated = await acceptConnectionRequest(supabase, ref);
        else if (action === 'reject') await rejectConnectionRequest(supabase, ref);
        else await cancelConnectionRequest(supabase, ref);
      } else return;
      if (!mounted.current) return;
      setConfirm(null);
      onChange(person, updated);
    } catch (error) {
      if (mounted.current)
        setError(error instanceof ApiError ? error.message : text.connectionError);
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  return (
    <View style={styles.card} testID="connection-person-row">
      <Text style={styles.label}>{person.profile.display_name || text.authorFallback}</Text>
      {connection?.status === 'accepted' ? (
        <Text style={styles.body}>{text.connected}</Text>
      ) : connection ? (
        <Text style={styles.body}>{incoming ? text.requestReceived : text.requestSent}</Text>
      ) : null}
      {confirm ? (
        <>
          <Text style={styles.body}>
            {confirm === 'block'
              ? text.blockHint
              : confirm === 'reject'
                ? text.confirmRejectRequest
                : text.confirmCancelRequest}
          </Text>
          <CommunityButton
            label={confirm === 'block' ? text.confirmBlock : text.confirmRequestAction}
            disabled={saving || disabled}
            onPress={() => void act(confirm)}
          />
          <CommunityButton
            label={confirm === 'block' ? text.cancelBlockAction : text.keepRequest}
            disabled={saving}
            onPress={() => setConfirm(null)}
            secondary
          />
        </>
      ) : connection?.status === 'accepted' ? null : !connection ? (
        <CommunityButton
          label={text.sendRequest}
          disabled={saving || disabled}
          onPress={() => void act('send')}
        />
      ) : incoming ? (
        <>
          <CommunityButton
            label={text.acceptRequest}
            disabled={saving || disabled}
            onPress={() => void act('accept')}
          />
          <CommunityButton
            label={text.rejectRequest}
            disabled={saving || disabled}
            onPress={() => setConfirm('reject')}
            secondary
          />
        </>
      ) : (
        <CommunityButton
          label={text.cancelRequest}
          disabled={saving || disabled}
          onPress={() => setConfirm('cancel')}
          secondary
        />
      )}
      {!confirm && connection?.status === 'accepted' && (
        <CommunityButton
          label={text.message}
          disabled={saving || disabled}
          onPress={() => router.push({ pathname: '/messages/[id]', params: { id: person.id } })}
        />
      )}
      {!confirm && (
        <CommunityButton
          label={text.blockUser}
          disabled={saving || disabled}
          onPress={() => setConfirm('block')}
          secondary
        />
      )}
      {saving && <ActivityIndicator accessibilityLabel="Updating connection request" />}
      {error && <CommunityError>{error}</CommunityError>}
    </View>
  );
}

function Connections({ userId }: { userId: string }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('people');
  const [draft, setDraft] = useState('');
  const [term, setTerm] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const load = useCallback(
    async (signal: AbortSignal, cursor: Cursor | null) => {
      if (tab === 'people') {
        const page = await findConnectionPeople(supabase, {
          query: term,
          cursor: typeof cursor === 'string' ? cursor : null,
          signal,
        });
        return {
          items: page.people.map((person) => ({ ...person, id: person.profile.id })),
          nextCursor: page.nextCursor as Cursor | null,
        };
      }
      const page = await listConnections(supabase, {
        view: tab,
        cursor: typeof cursor === 'object' ? cursor : null,
        signal,
      });
      return {
        items: page.connections.map((row): PersonRow => {
          const peerId = row.requester_id === userId ? row.addressee_id : row.requester_id;
          const peer = row.requester_id === userId ? row.addressee : row.requester;
          return {
            id: peerId,
            profile: peer ?? {
              id: peerId,
              display_name: text.authorFallback,
              avatar_url: null,
              neighbourhood_id: null,
            },
            connection: row,
          };
        }),
        nextCursor: page.nextCursor as Cursor | null,
      };
    },
    [tab, term, userId],
  );
  const list = useCommunityPage(load);
  function changed(person: PersonRow, connection: Connection | null) {
    if (tab === 'people') list.replace({ ...person, connection });
    else list.remove(person.id);
  }
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={list.items}
      keyExtractor={(row) => row.id}
      refreshing={list.loading}
      onRefresh={list.refresh}
      ListHeaderComponent={
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>
            {text.connections}
          </Text>
          <CommunityButton
            label={text.messages}
            onPress={() => router.push('/messages')}
            secondary
          />
          <CommunityButton
            label={text.blockedUsers}
            onPress={() => router.push('/blocked-users')}
            secondary
          />
          <View style={styles.row}>
            {(['people', 'incoming', 'outgoing', 'friends'] as const).map((value) => (
              <CommunityButton
                key={value}
                label={text[value]}
                selected={tab === value}
                secondary={tab !== value}
                onPress={() => setTab(value)}
              />
            ))}
          </View>
          {tab === 'people' && (
            <>
              <TextInput
                accessibilityLabel={text.searchPeople}
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
              />
              {searchError && <CommunityError>{searchError}</CommunityError>}
              <CommunityButton
                label={text.search}
                onPress={() => {
                  if (Array.from(draft.trim()).length > 50) {
                    setSearchError('Search names using 50 characters or fewer.');
                    return;
                  }
                  setSearchError(null);
                  setTerm(draft.trim());
                }}
                secondary
              />
            </>
          )}
          <CommunityButton
            label={text.refreshConnections}
            onPress={list.refresh}
            disabled={list.loading}
            secondary
          />
        </View>
      }
      ListEmptyComponent={
        list.loading ? (
          <ActivityIndicator accessibilityLabel="Loading connections" />
        ) : !list.error ? (
          <Text style={styles.body}>
            {tab === 'people' ? text.noPeople : text.emptyConnections}
          </Text>
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
        <Person
          key={`${tab}-${term}-${item.id}-${item.connection?.created_at ?? 'none'}-${item.connection?.status ?? 'none'}`}
          person={item}
          disabled={profile?.status !== 'active' || list.loading}
          onChange={changed}
          onBlocked={list.remove}
        />
      )}
    />
  );
}

export function ConnectionsScreen() {
  const { profile } = useAuth();
  return profile ? <Connections key={profile.id} userId={profile.id} /> : null;
}
