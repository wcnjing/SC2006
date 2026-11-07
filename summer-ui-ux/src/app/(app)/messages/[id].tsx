import { validateDirectMessageBody } from '@communitylink/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { ScrollView } from 'react-native';
import { StyleSheet, View } from 'react-native';

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
import { subscribeToConversation } from '@/services/notifications';
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
    setError(invalid);
    if (invalid) return;
    setSending(true);
    try {
      await communityService.sendDirectMessage({
        recipientId: id,
        body,
        activityId,
      });
      setBody('');
      await page.revalidate();
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setSending(false);
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
          <View style={styles.composer}>
            <View style={styles.flex}>
              <TextField
                label={t('messages.write')}
                value={body}
                onChangeText={setBody}
                error={error}
                multiline
              />
            </View>
            <Button
              label={t('post.send')}
              icon="send"
              fullWidth={false}
              loading={sending}
              onPress={send}
            />
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
              <View
                key={m.id}
                accessible
                accessibilityLabel={t(mine ? 'messages.fromMe' : 'messages.fromThem', {
                  name,
                  body: m.body ?? '',
                  when: formatAgo(t, m.created_at),
                })}
                style={[styles.bubble, mine ? styles.mine : styles.theirs]}
              >
                <AppText color={mine ? colors.onPrimary : colors.text}>{m.body}</AppText>
                <AppText variant="caption" color={mine ? colors.onPrimary : colors.textMuted}>
                  {formatAgo(t, m.created_at)}
                </AppText>
              </View>
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
  list: { flexGrow: 1, justifyContent: 'flex-end', gap: spacing.sm, paddingBottom: spacing.sm },
  bubble: { maxWidth: '80%', padding: spacing.md, borderRadius: radii.lg, gap: spacing.xxs },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surfaceMuted },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
});
