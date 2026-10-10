import { router } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText, Card, ChipGroup, ListRow, Screen, ScreenHeader } from '@/components/ui';
import { useSettings, type TextSize } from '@/context/SettingsContext';
import { LANGUAGES, type LanguageCode } from '@/i18n/locales';
import { colors, spacing } from '@/theme/tokens';

/**
 * Settings (boundary class SettingPage: updateLanguage(), logout()).
 * Language (NFR Multilingual), text size and reduce motion (NFR Accessibility).
 */
export default function SettingsScreen() {
  const { t, language, setLanguage, textSize, setTextSize, reduceMotion, setReduceMotion } =
    useSettings();

  return (
    <Screen header={<ScreenHeader title={t('settings.title')} />} contentStyle={styles.content}>
      <View style={styles.group}>
        <AppText variant="h3" heading>
          {t('settings.language')}
        </AppText>
        <ChipGroup<LanguageCode>
          accessibilityLabel={t('settings.language')}
          options={LANGUAGES.map((l) => ({ value: l.code, label: t(l.labelKey) }))}
          value={language}
          onChange={(v) => setLanguage(v as LanguageCode)}
        />
        <AppText variant="caption" color={colors.textMuted}>
          {t('settings.languageHint')}
        </AppText>
      </View>

      <View style={styles.group}>
        <AppText variant="h3" heading>
          {t('settings.textSize')}
        </AppText>
        <ChipGroup<TextSize>
          accessibilityLabel={t('settings.textSize')}
          options={[
            { value: 'default', label: t('settings.textSize.default') },
            { value: 'large', label: t('settings.textSize.large') },
            { value: 'xlarge', label: t('settings.textSize.xlarge') },
          ]}
          value={textSize}
          onChange={(v) => setTextSize(v as TextSize)}
        />
        <Card variant="muted">
          <AppText>{t('settings.preview')}</AppText>
        </Card>
      </View>

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <AppText variant="h3">{t('settings.reduceMotion')}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {t('settings.reduceMotionHint')}
          </AppText>
        </View>
        <Switch
          accessibilityLabel={t('settings.reduceMotion')}
          value={reduceMotion}
          onValueChange={setReduceMotion}
          trackColor={{ true: colors.primary, false: colors.borderStrong }}
          thumbColor={colors.surface}
        />
      </View>

      {__DEV__ && (
        <Card variant="outline" padded={false}>
          <ListRow
            title={t('settings.uiKit')}
            icon="color-palette-outline"
            onPress={() => router.push('/dev/ui-kit')}
          />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xxl, paddingTop: spacing.md },
  group: { gap: spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, minHeight: 56 },
});
