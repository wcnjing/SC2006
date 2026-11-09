import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useT } from '@/context/SettingsContext';
import { colors, radii, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';

type Props = {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Red confirm button for destructive actions (cancel spot, delete post, remove content). */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirmation prompt (e.g. UC JoinActivity "Cancel Participation":
 * "System sends a confirmation prompt to the user"). Used instead of
 * Alert.alert, which has no buttons on web. Focus is trapped in the dialog
 * (accessibilityViewIsModal) and Back / Esc / tapping outside cancels.
 */
export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  const t = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={t('dialog.dismiss')}
        />
        <View style={styles.sheet} accessibilityViewIsModal accessibilityRole="alert">
          <AppText variant="h2" heading>
            {title}
          </AppText>
          {body && <AppText color={colors.textMuted}>{body}</AppText>}
          <View style={styles.actions}>
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              loading={loading}
              onPress={onConfirm}
            />
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} disabled={loading} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
