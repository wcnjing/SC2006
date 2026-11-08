import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Avatar } from '@/components/ui';
import { findNeighbourhoodByDbId } from '@/config/catalog';
import { useT } from '@/context/SettingsContext';
import type { TranslationKey } from '@/i18n/en';
import { colors, spacing } from '@/theme/tokens';

type Person = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  neighbourhood_id?: number | null;
};

/** One person in a list: avatar + name + neighbourhood (opens their profile), with actions below. */
export function PersonRow({ person, children }: { person: Person; children?: ReactNode }) {
  const t = useT();
  const hood = findNeighbourhoodByDbId(person.neighbourhood_id);
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('connect.openProfile', { name: person.display_name })}
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: person.id } })}
        style={styles.who}
      >
        <Avatar name={person.display_name} uri={person.avatar_url} size={44} />
        <View style={styles.flex}>
          <AppText variant="label" numberOfLines={1}>
            {person.display_name}
          </AppText>
          {hood && (
            <AppText variant="caption" color={colors.textMuted}>
              {t(hood.labelKey as TranslationKey)}
            </AppText>
          )}
        </View>
      </Pressable>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
