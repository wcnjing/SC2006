import { validateDirectMessageBody } from '@communitylink/shared';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
} from 'react-native';

import {
  AppText,
  Banner,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  Screen,
  ScreenHeader,
  TextField,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/SettingsContext';
import { formatAgo } from '@/features/community/format';
import { useAsync } from '@/lib/useAsync';
import { communityService, errorMessageKey, errorText } from '@/services';
import {
  markChatNotificationsRead,
  markConversationRead,
  subscribeToConversation,
} from '@/services/notifications';
import { uploadImage } from '@/services/supabase/uploads';
import { colors, radii, spacing } from '@/theme/tokens';

/**
 * Conversation (FR 8.2.1–8.2.2, UC SendMessage): messages in time order,
 * newest at the bottom. Sending needs an accepted connection and no block
 * either way (P3's send_direct_message); otherwise the reason is shown.
 */
export default function ConversationScreen() {
  const { id, activityId } = useLocalSearchParams<{ id: string; activityId?: string }>();
  const t = useT();
  const me = useAuth().session?.account.accountId;
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [composerHeight, setComposerHeight] = useState(40);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollToLatest = () => scrollViewRef.current?.scrollToEnd({ animated: true });

  const page = useAsync(async () => {
    const [conversation, history] = await Promise.all([
      communityService.getDirectConversation(id, { activityId }),
      communityService.listDirectMessages(id, { limit: 50 }),
    ]);
    return conversation && { conversation, messages: history.messages };
  });

  useEffect(() => {
    const unsubscribe = subscribeToConversation(me, id, page.revalidate);
    return unsubscribe ?? undefined;
  }, [id, me, page.revalidate]);

  useEffect(() => {
    void Promise.all([markConversationRead(id), markChatNotificationsRead(id)]);
  }, [id]);

  useEffect(() => {
    if (page.data?.messages.length) requestAnimationFrame(scrollToLatest);
  }, [page.data?.messages.length]);

  const name = page.data?.conversation.profile.display_name ?? t('messages.title');
  const header = (
    <ScreenHeader
      title={name}
      right={
        page.data && (
          <IconButton
            icon="person-circle-outline"
            label={t('connect.openProfile', { name })}
            onPress={() => router.push({ pathname: '/user/[id]', params: { id } })}
          />
        )
      }
    />
  );

  if (!page.data) {
    return (
      <Screen header={header}>
        {page.loading ? (
          <LoadingState />
        ) : page.error ? (
          <ErrorState message={t(errorMessageKey(page.error))} onRetry={page.reload} />
        ) : (
          <EmptyState icon="person-outline" title={t('user.unavailable')} />
        )}
      </Screen>
    );
  }

  const { conversation, messages } = page.data;
  const send = async () => {
    const invalid = validateDirectMessageBody(body);
    setError(imageUrl ? null : invalid);
    if (invalid && !imageUrl) return;
    setSending(true);
    try {
      await communityService.sendDirectMessage({
        recipientId: id,
        body,
        activityId,
        imageUrl: imageUrl ?? undefined,
      });
      setBody('');
      setImageUrl(null);
      await page.revalidate();
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setSending(false);
    }
  };

  const chooseImage = async () => {
    if (!me) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    setError(null);
    try {
      setImageUrl(await uploadImage('chat-images', me, result.assets[0].uri));
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen
      header={header}
      contentStyle={styles.content}
      refreshing={page.refreshing}
      onRefresh={page.refresh}
      scrollViewRef={scrollViewRef}
      onContentSizeChange={scrollToLatest}
      footer={
        conversation.canSend && (
          <View style={styles.composerWrap}>
            {imageUrl && (
              <View style={styles.preview}>
                <Image source={{ uri: imageUrl }} style={styles.previewImage} />
                <IconButton
                  icon="close-circle"
                  label="Remove attached image"
                  color={colors.error}
                  onPress={() => setImageUrl(null)}
                />
              </View>
            )}
            <View style={styles.composer}>
              <IconButton
                icon="image-outline"
                label="Attach image"
                disabled={uploading}
                onPress={chooseImage}
              />
              <View style={styles.flex}>
                <TextField
                  label={t('messages.write')}
                  value={body}
                  onChangeText={setBody}
                  error={error}
                  compact
                  multiline
                  style={{ height: composerHeight }}
                  onContentSizeChange={(
                    event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
                  ) => {
                    const height = Math.min(
                      120,
                      Math.max(40, event.nativeEvent.contentSize.height),
                    );
                    setComposerHeight(height);
                  }}
                  submitBehavior="submit"
                  onSubmitEditing={() => void send()}
                />
              </View>
              <Button
                label={t('post.send')}
                icon="send"
                fullWidth={false}
                loading={sending}
                disabled={uploading}
                style={styles.sendButton}
                onPress={send}
              />
            </View>
          </View>
        )
      }
    >
      {!conversation.canSend && (
        <Banner tone="info">
          {t(conversation.blockedByMe ? 'messages.blocked' : 'messages.notConnected', { name })}
        </Banner>
      )}
      {messages.length === 0 ? (
        <AppText color={colors.textMuted} align="center">
          {t('messages.noMessages', { name })}
        </AppText>
      ) : (
        <View accessibilityRole="list" style={styles.list}>
          {messages.map((m) => {
            const mine = m.sender_id === me;
            return (
              <Pressable
                key={m.id}
                accessible
                onHoverIn={() => setHoveredMessageId(m.id)}
                onHoverOut={() => setHoveredMessageId(null)}
                accessibilityLabel={t(mine ? 'messages.fromMe' : 'messages.fromThem', {
                  name,
                  body: m.body ?? '',
                  when: formatAgo(t, m.created_at),
                })}
                style={[styles.bubble, mine ? styles.mine : styles.theirs]}
              >
                {m.body && (
                  <AppText color={mine ? colors.onPrimary : colors.text}>{m.body}</AppText>
                )}
                {m.image_url && <Image source={{ uri: m.image_url }} style={styles.messageImage} />}
                <AppText variant="caption" color={mine ? colors.onPrimary : colors.textMuted}>
                  {formatAgo(t, m.created_at)}
                </AppText>
                {hoveredMessageId === m.id && (
                  <View pointerEvents="none" style={styles.timestampTooltip}>
                    <AppText variant="caption" color={colors.onPrimary}>
                      {new Date(m.created_at).toLocaleString()}
                    </AppText>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: spacing.sm },
  flex: { flex: 1 },
  composerWrap: { gap: spacing.sm },
  preview: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  previewImage: { width: 96, height: 72, borderRadius: radii.sm },
  list: { flexGrow: 1, justifyContent: 'flex-end', gap: spacing.sm, paddingBottom: spacing.sm },
  bubble: { maxWidth: '80%', padding: spacing.md, borderRadius: radii.lg, gap: spacing.xxs },
  messageImage: { width: 220, height: 160, borderRadius: radii.md },
  sendButton: { alignSelf: 'flex-end' },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surfaceMuted },
  timestampTooltip: {
    position: 'absolute',
    bottom: -30,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.sm,
    backgroundColor: colors.text,
    zIndex: 1,
  },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
});
