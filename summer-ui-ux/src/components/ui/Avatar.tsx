import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { colors, radii } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = {
  name?: string | null;
  uri?: string | null;
  size?: number;
  /** Shows the "+" / camera badge and makes the avatar a button (profile photo picker). */
  onEdit?: () => void;
  editLabel?: string;
};

const PALETTE = ['#D1E9FF', '#DCFAE6', '#FDEAD7', '#EBE9FE', '#FEE4E2', '#FEF0C7'];

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ name, uri, size = 48, onEdit, editLabel }: Props) {
  const bg = name ? PALETTE[name.charCodeAt(0) % PALETTE.length] : colors.surfaceMuted;
  const circle = { width: size, height: size, borderRadius: size / 2 };

  const body = (
    <View style={[styles.circle, circle, { backgroundColor: bg }]}>
      {uri ? (
        <Image source={{ uri }} style={circle} accessibilityIgnoresInvertColors />
      ) : name ? (
        <AppText
          style={{ fontSize: size * 0.38, lineHeight: size * 0.46, fontWeight: '700' }}
          color={colors.text}
        >
          {initials(name)}
        </AppText>
      ) : (
        <Ionicons name="person" size={size * 0.55} color={colors.borderStrong} />
      )}
    </View>
  );

  if (!onEdit) {
    return (
      <View accessible={!!name} accessibilityRole="image" accessibilityLabel={name ?? undefined}>
        {body}
      </View>
    );
  }

  const badge = Math.max(28, size * 0.3);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={editLabel}
      onPress={onEdit}
      style={{ alignSelf: 'center' }}
    >
      {body}
      <View style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2 }]}>
        <Ionicons name={uri ? 'camera' : 'add'} size={badge * 0.6} color={colors.onPrimary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
});
