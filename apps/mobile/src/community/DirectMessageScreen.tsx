import {
  ApiError,
  DIRECT_MESSAGE_MAX_LENGTH,
  validateDirectMessageBody,
} from '@communitylink/shared';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import {
  blockUser,
  unblockUser,
  getDirectConversation,
  sendDirectMessage,
} from '../services/community';
import {
  CommunityButton,
  CommunityError,
  communityStyles as styles,
  communityText as text,
} from './communityUi';
import { useCommunityQuery } from './useCommunityQuery';
import { useDirectMessages } from './useDirectMessages';

function Conversation({ userId }: { userId: string }) {
  const { profile } = useAuth();
  const load = useCallback(
    (signal: AbortSignal) => getDirectConversation(supabase, userId, { signal }),
    [userId],
  );
  const query = useCommunityQuery(load);
  const current = query.data;
  const thread = useDirectMessages(userId, !!current?.connected);
  const [body, setBody] = useState('');
  const [requestId, setRequestId] = useState(() => randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [confirm, setConfirm] = useState<'block' | 'unblock' | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function send() {
    if (busy.current || !current?.canSend || thread.loading) return;
    const invalid = validateDirectMessageBody(body);
    if (invalid) {
      setError(invalid);
      return;
    }
    busy.current = true;
    setSaving(true);
    setError(null);
    setConflict(false);
    try {
      const message = await sendDirectMessage(supabase, { recipientId: userId, body, requestId });
      if (!mounted.current) return;
      thread.upsert(message);
      setBody('');
      setRequestId(randomUUID());
    } catch (error) {
      if (!mounted.current) return;
      setError(error instanceof ApiError ? error.message : text.messageError);
      setConflict(error instanceof ApiError && error.code === '40001');
      if (error instanceof ApiError && error.code === '42501') query.retry();
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  async function changeBlock() {
    if (busy.current || !confirm || !current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      if (confirm === 'block') await blockUser(supabase, userId);
      else await unblockUser(supabase, userId);
      if (!mounted.current) return;
      thread.clear();
      setConfirm(null);
      query.retry();
    } catch (error) {
      if (mounted.current) setError(error instanceof ApiError ? error.message : text.blockError);
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {query.loading ? (
        <ActivityIndicator accessibilityLabel="Loading conversation" />
      ) : query.error ? (
        <>
          <CommunityError>{query.error}</CommunityError>
          <CommunityButton label={text.retry} onPress={query.retry} />
        </>
      ) : !current ? (
        <Text style={styles.body}>{text.personUnavailable}</Text>
      ) : (
        <>
          <Text style={styles.heading} accessibilityRole="header">
            {current.profile.display_name}
          </Text>
          {current.blockedByMe && <Text style={styles.body}>{text.userBlocked}</Text>}
          {!current.connected && <Text style={styles.body}>{text.connectionRequired}</Text>}
          <CommunityButton
            label={text.refreshMessages}
            disabled={saving}
            onPress={query.retry}
            secondary
          />
          {current.connected && (
            <>
              {thread.hasMore && (
                <CommunityButton
                  label={text.olderMessages}
                  onPress={thread.loadMore}
                  disabled={saving || thread.loading}
                  secondary
                />
              )}
              {thread.loading && <ActivityIndicator accessibilityLabel="Loading messages" />}
              {!thread.loading && !thread.error && !thread.messages.length && (
                <Text style={styles.body}>{text.emptyMessages}</Text>
              )}
              {thread.messages.map((message) => (
                <View key={message.id} style={styles.card} testID="direct-message-row">
                  <Text style={styles.label}>
                    {message.sender_id === profile?.id ? 'You' : current.profile.display_name}
                  </Text>
                  <Text style={styles.body} testID="direct-message-body">
                    {message.body ?? text.unavailableMessage}
                  </Text>
                  <Text style={styles.muted}>{new Date(message.created_at).toLocaleString()}</Text>
                </View>
              ))}
              {thread.error && (
                <>
                  <CommunityError>{thread.error}</CommunityError>
                  <CommunityButton
                    label={text.retry}
                    onPress={thread.retry}
                    disabled={thread.loading || saving}
                  />
                </>
              )}
              {!current.canSend && <Text style={styles.body}>{text.messagingUnavailable}</Text>}
              <TextInput
                accessibilityLabel={text.yourMessage}
                style={[styles.input, styles.multiline]}
                multiline
                value={body}
                onChangeText={setBody}
                editable={!saving && current.canSend}
              />
              <Text style={styles.muted}>
                {Array.from(body.trim()).length} / {DIRECT_MESSAGE_MAX_LENGTH}
              </Text>
              <CommunityButton
                label={text.sendMessage}
                onPress={() => void send()}
                disabled={saving || thread.loading || !current.canSend}
              />
            </>
          )}
          {confirm ? (
            <View style={styles.section}>
              <Text style={styles.body}>
                {confirm === 'block' ? text.blockHint : text.unblockHint}
              </Text>
              <CommunityButton
                label={confirm === 'block' ? text.confirmBlock : text.confirmUnblock}
                onPress={() => void changeBlock()}
                disabled={saving}
              />
              <CommunityButton
                label={text.cancelBlockAction}
                onPress={() => setConfirm(null)}
                disabled={saving}
                secondary
              />
            </View>
          ) : (
            <CommunityButton
              label={current.blockedByMe ? text.unblockUser : text.blockUser}
              disabled={saving || profile?.status !== 'active'}
              onPress={() => setConfirm(current.blockedByMe ? 'unblock' : 'block')}
              secondary
            />
          )}
        </>
      )}
      {error && <CommunityError>{error}</CommunityError>}
      {conflict && (
        <CommunityButton
          label={text.newMessageDraft}
          disabled={saving}
          onPress={() => {
            setBody('');
            setRequestId(randomUUID());
            setConflict(false);
            setError(null);
          }}
          secondary
        />
      )}
    </ScrollView>
  );
}
export function DirectMessageScreen({ userId }: { userId: string }) {
  const { profile } = useAuth();
  return profile ? <Conversation key={`${profile.id}-${userId}`} userId={userId} /> : null;
}
