import { Link, router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type TextInput } from 'react-native';

import { SingpassButton } from '@/components/SingpassButton';
import { AppText, Banner, Button, LogoMark, Screen, TextField } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import type { TranslationKey } from '@/i18n/en';
import { validatePhone } from '@/lib/validation';
import { errorMessageKey } from '@/services';
import { colors, radii, spacing } from '@/theme/tokens';

/**
 * Login (mockup 4.A, left). UC #3-03 Login via Credentials, FR 1.2, FR 1.3.1.
 * Exceptions: incomplete input → field errors and no submit; wrong credentials → error banner.
 */
export default function LoginScreen() {
  const { t } = useSettings();
  const { login, sessionExpired } = useAuth();
  const params = useLocalSearchParams<{ error?: string }>();
  const passwordRef = useRef<TextInput>(null);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    phone?: TranslationKey;
    password?: TranslationKey;
  }>({});
  const [formError, setFormError] = useState<TranslationKey | null>(
    params.error === 'singpass' ? 'error.singpassFailed' : null,
  );
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const errs = {
      phone: validatePhone(phone) ?? undefined,
      password: password ? undefined : ('error.passwordRequired' as const),
    };
    setFieldErrors(errs);
    setFormError(null);
    if (errs.phone || errs.password) return;
    setSubmitting(true);
    try {
      await login(phone, password);
      // The root layout's guard switches to the app automatically.
    } catch (e) {
      setFormError(errorMessageKey(e));
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <LogoMark size={88} />
        <AppText variant="display" heading align="center">
          {t('app.name')}
        </AppText>
        <AppText variant="h3" color={colors.textMuted} align="center">
          {t('app.tagline')}
        </AppText>
      </View>

      {sessionExpired && (
        <Banner tone="info" icon="time-outline">
          {t('login.sessionExpired')}
        </Banner>
      )}
      {formError && <Banner tone="error">{t(formError)}</Banner>}

      <TextField
        label={t('login.phone')}
        placeholder={t('login.phonePlaceholder')}
        value={phone}
        onChangeText={(v) => {
          setPhone(v);
          setFieldErrors((e) => ({ ...e, phone: undefined }));
        }}
        error={fieldErrors.phone && t(fieldErrors.phone)}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={12}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        password
        label={t('login.password')}
        placeholder={t('login.passwordPlaceholder')}
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setFieldErrors((e) => ({ ...e, password: undefined }));
        }}
        error={fieldErrors.password && t(fieldErrors.password)}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <Button label={t('login.submit')} onPress={submit} loading={submitting} />

      <View
        style={styles.divider}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.line} />
        <AppText variant="caption" color={colors.textSubtle}>
          {t('common.or')}
        </AppText>
        <View style={styles.line} />
      </View>

      <SingpassButton onPress={() => router.push('/singpass')} />

      <View style={styles.footer}>
        <AppText color={colors.textMuted}>{t('login.noAccount')}</AppText>
        <Link href="/register" asChild>
          <Pressable accessibilityRole="link" hitSlop={12}>
            <AppText variant="bodyStrong" color={colors.primary}>
              {t('login.signUp')}
            </AppText>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.xl },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    marginBottom: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.xl,
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: 1, backgroundColor: colors.divider },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
});
