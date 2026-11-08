import { connectionRequestRef, type Connection } from '@communitylink/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui';
import { useT } from '@/context/SettingsContext';
import { communityService } from '@/services';
import { spacing } from '@/theme/tokens';

export type Relation = 'none' | 'outgoing' | 'incoming' | 'friends';

/** How `me` stands with the other person in a connection row (null = no row). */
export const relationOf = (c: Connection | null | undefined, me: string | undefined): Relation =>
  !c
    ? 'none'
    : c.status === 'accepted'
      ? 'friends'
      : c.requester_id === me
        ? 'outgoing'
        : 'incoming';

type Props = {
  userId: string;
  name: string;
  connection: Connection | null | undefined;
  me: string | undefined;
  /** Called after any change, with the error if it failed. */
  onDone: (error?: unknown) => void;
};

/**
 * The connection buttons for one person (FR 8.1, UC ManageConnectionRequest):
 * Connect · Cancel request · Accept / Decline · Message. Every button names
 * the person for screen readers, since several rows can show the same label.
 */
export function ConnectionActions({ userId, name, connection, me, onDone }: Props) {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const relation = relationOf(connection, me);

  const run = (key: string, action: () => Promise<unknown>) => async () => {
    setBusy(key);
    try {
      await action();
      onDone();
    } catch (e) {
      onDone(e);
    } finally {
      setBusy(null);
    }
  };
  const button = (
    key: string,
    label: string,
    a11y: string,
    action: () => Promise<unknown>,
    variant: 'primary' | 'outline' = 'primary',
  ) => (
    <Button
      key={key}
      label={label}
      accessibilityLabel={a11y}
      size="sm"
      fullWidth={false}
      variant={variant}
      loading={busy === key}
      disabled={!!busy}
      onPress={run(key, action)}
    />
  );
  const ref = connection && connectionRequestRef(connection);

  return (
    <View style={styles.row}>
      {relation === 'none' &&
        button('connect', t('connect.connect'), t('connect.connectA11y', { name }), () =>
          communityService.sendConnectionRequest(userId),
        )}
      {relation === 'outgoing' &&
        ref &&
        button(
          'cancel',
          t('connect.cancel'),
          t('connect.cancelA11y', { name }),
          () => communityService.cancelConnectionRequest(ref),
          'outline',
        )}
      {relation === 'incoming' &&
        ref && [
          button('accept', t('connect.accept'), t('connect.acceptA11y', { name }), () =>
            communityService.acceptConnectionRequest(ref),
          ),
          button(
            'decline',
            t('connect.decline'),
            t('connect.declineA11y', { name }),
            () => communityService.rejectConnectionRequest(ref),
            'outline',
          ),
        ]}
      {relation === 'friends' && (
        <Button
          label={t('connect.message')}
          accessibilityLabel={t('connect.messageA11y', { name })}
          icon="chatbubble-outline"
          size="sm"
          fullWidth={false}
          variant="outline"
          onPress={() => router.push({ pathname: '/messages/[id]', params: { id: userId } })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
