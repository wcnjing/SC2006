import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppHeader, AppText, Banner, Card, Screen, Section, Tag } from '@/components/ui';
import { NEIGHBOURHOODS, findLabelKey } from '@/config/catalog';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import type { TranslationKey } from '@/i18n/en';
import { colors, MIN_TOUCH, radii, spacing } from '@/theme/tokens';

function greetingKey(): TranslationKey {
  const h = new Date().getHours();
  return h < 12
    ? 'home.greeting.morning'
    : h < 18
      ? 'home.greeting.afternoon'
      : 'home.greeting.evening';
}

/**
 * Home (mockups 4.B / 4.C, left). Week 8: shell, greeting and search entry.
 * Week 9 (P5 + P2): fill "Recommended for you" (FR 5.1.5, reasons FR 5.1.6)
 * and "Happening nearby" from P2's recommendations API.
 */
export default function HomeScreen() {
  const { t } = useSettings();
  const { session } = useAuth();
  const profile = session?.profile;
  const hoodKey = findLabelKey(NEIGHBOURHOODS, profile?.neighbourhoodId) as
    | TranslationKey
    | undefined;

  return (
    <Screen inTabs header={<AppHeader unread={1} />} contentStyle={styles.content}>
      <View style={styles.greeting}>
        <AppText variant="h1" heading>
          {t(greetingKey(), { name: profile?.displayName ?? '' })}
        </AppText>
        {hoodKey && (
          <View style={styles.location}>
            <Ionicons name="location" size={18} color={colors.primary} />
            <AppText variant="label" color={colors.textMuted}>
              {t(hoodKey)}, Singapore
            </AppText>
          </View>
        )}
      </View>

      {/* Search bar is a button: tapping it opens Search & Filter (Dialog Map: tapSearchBar). */}
      <Pressable
        accessibilityRole="search"
        accessibilityLabel={t('home.search')}
        onPress={() => router.push('/search')}
        style={({ pressed }) => [
          styles.search,
          pressed && { backgroundColor: colors.surfaceMuted },
        ]}
      >
        <Ionicons name="search" size={22} color={colors.textMuted} />
        <AppText color={colors.textSubtle} style={{ flex: 1 }}>
          {t('home.search')}
        </AppText>
        <Ionicons name="options-outline" size={22} color={colors.text} />
      </Pressable>

      <Section title={t('home.recommended')}>
        {/* Example of the card layout P2's data will fill. Remove once the API is connected. */}
        <Card
          onPress={() => router.push('/activity/demo')}
          accessibilityLabel="Community Gardening, sample activity"
        >
          <View style={styles.cardBody}>
            <View style={styles.row}>
              <Tag label={t('category.nature')} tone="nature" />
              <AppText variant="caption" color={colors.textMuted}>
                500 m away
              </AppText>
            </View>
            <AppText variant="h3">Community Gardening</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              Sat, 9:00 AM – 11:00 AM · Tampines Community Garden
            </AppText>
            <View style={styles.tags}>
              <Tag label={t('access.wheelchair')} tone="access" icon="accessibility-outline" />
              <Tag label="Outdoor" tone="neutral" icon="sunny-outline" />
            </View>
            <Banner tone="insight">
              Recommended because you like Nature and it&apos;s nearby (sample)
            </Banner>
          </View>
        </Card>
      </Section>

      <Section
        title={t('home.nearby')}
        actionLabel={t('home.seeAll')}
        onAction={() => router.navigate('/discover')}
      >
        <Card variant="muted">
          <AppText color={colors.textMuted}>
            {t('placeholder.body', { owner: 'P2 (Discovery API)' })}
          </AppText>
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.lg },
  greeting: { gap: spacing.xs },
  location: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  cardBody: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
