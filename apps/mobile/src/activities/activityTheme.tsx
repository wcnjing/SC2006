import { activityIcons as icons } from './activityIcons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text } from 'react-native';

// Lab 2 §4.B–4.C: white cards, dark headings, pastel badges and teal activity controls.
export const activityStyles = StyleSheet.create({
  page: {
    flexGrow: 1,
    padding: 20,
    gap: 16,
    backgroundColor: '#f7f9fa',
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e3e8ed',
    borderRadius: 16,
    padding: 18,
    gap: 10,
    marginBottom: 12,
  },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '700', color: '#18232f', flexShrink: 1 },
  heading: { fontSize: 18, fontWeight: '700', color: '#18232f' },
  body: { fontSize: 15, lineHeight: 23, color: '#344354' },
  link: { fontSize: 16, fontWeight: '600', color: '#345c70' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  badge: {
    backgroundColor: '#e1f2f4',
    color: '#345c70',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    fontSize: 13,
  },
  reason: {
    backgroundColor: '#eeedff',
    padding: 10,
    borderRadius: 8,
    color: '#344354',
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d4dde5',
    backgroundColor: '#fff',
    borderRadius: 9,
    padding: 12,
    fontSize: 15,
    color: '#344354',
  },
});

export function ActivityButton({
  title,
  onPress,
  disabled,
  accessibilityLabel,
  color,
  primary = false,
}: ComponentProps<typeof import('react-native').Button> & { primary?: boolean }) {
  const selected = primary || color === '#075ca8';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: selected ? '#608896' : '#d4dde5',
        backgroundColor: selected ? '#91c2ce' : '#fff',
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Text style={{ color: '#263e4b', fontSize: 15, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export function ActivityIconButton({
  label,
  icon,
  onPress,
  disabled = false,
  busy = false,
  selected,
}: {
  label: string;
  icon: keyof typeof icons;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-busy={busy}
      {...(selected === undefined ? {} : { 'aria-pressed': selected })}
      accessibilityState={{
        disabled: disabled || busy,
        busy,
        ...(selected === undefined ? {} : { selected }),
      }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? '#e1f2f4' : '#fff',
        opacity: disabled ? 0.45 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator size="small" accessibilityLabel={label + ', loading'} />
      ) : (
        <Image
          source={typeof icons[icon] === 'string' ? { uri: icons[icon] } : icons[icon]}
          accessible={false}
          style={{ width: 23, height: 23 }}
        />
      )}
    </Pressable>
  );
}
