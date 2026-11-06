import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Card, Chip, Screen, ScreenHeader } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { MOCK_SINGPASS_IDENTITIES } from '@/services/mock/mockBackend';
import { colors, spacing } from '@/theme/tokens';

/**
 * MOCK Singpass authentication + consent (FR 1.3.2–1.3.6, UC #3-04).
 *
 * Plan.pdf cut-list #1: keep the mock flow and the button; P4/P1 swap in
 * the real Singpass redirect (behind the API abstraction layer) if sandbox
 * access is granted. Allow → authenticate; Cancel → back to Login with an
 * error (FR 1.3.6).
 */
export default function SingpassMockScreen() {
  const { t } = useSettings();
  const { loginWithSingpass } = useAuth();
  const [identity, setIdentity] = useState(MOCK_SINGPASS_IDENTITIES[0]);
  const [submitting, setSubmitting] = useState(false);

  const deny = () => router.replace({ pathname: '/login', params: { error: 'singpass' } });

  const allow = async () => {
    setSubmitting(true);
    try {
      await loginWithSingpass(identity);
    } catch {
      deny();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      header={<ScreenHeader title={t('singpass.title')} onBack={deny} />}
      contentStyle={styles.content}
    >
      <Banner tone="warning" icon="construct-outline">
        {t('singpass.mockBanner')}
      </Banner>

      <AppText variant="h2" heading>
        {t('singpass.consentTitle')}
      </AppText>
      <AppText color={colors.textMuted}>{t('singpass.consentBody')}</AppText>

      <Card variant="muted">
        <View style={styles.fields}>
          {(
            ['singpass.field.name', 'singpass.field.phone', 'singpass.field.residential'] as const
          ).map((k) => (
            <AppText key={k}>• {t(k)}</AppText>
          ))}
        </View>
      </Card>

      <View style={styles.identities}>
        <AppText variant="label">{t('singpass.mockIdentity')}</AppText>
        <View style={styles.chips}>
          {MOCK_SINGPASS_IDENTITIES.map((i) => (
            <Chip
              key={i.uinfin}
              mode="radio"
              label={i.name}
              selected={i.uinfin === identity.uinfin}
              onPress={() => setIdentity(i)}
            />
          ))}
        </View>
      </View>

      <AppText variant="caption" color={colors.textMuted}>
        {t('singpass.pdpa')}
      </AppText>

      <Button label={t('singpass.allow')} onPress={allow} loading={submitting} />
      <Button label={t('singpass.deny')} variant="outline" onPress={deny} disabled={submitting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  fields: { gap: spacing.xs },
  identities: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
