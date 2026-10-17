import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type TextInput } from 'react-native';

import { SingpassButton } from '@/components/SingpassButton';
import { AppText, Banner, Button, Screen, ScreenHeader, TextField } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import type { TranslationKey } from '@/i18n/en';
import { validateNewPassword, validateEmail } from '@/lib/validation';
import { errorMessageKey } from '@/services';
import { colors, spacing } from '@/theme/tokens';

type Field = 'email' | 'password' | 'confirm';

/**
 * Sign Up (mockup 4.A, middle). UC #3-01 CreateAccount, FR 1.1.
 *
 * Differs from the mockup: FR 1.1.1 only requires login details (email, team decision) and a
 * password, so "Full name" and the photo moved to Complete Your Profile
 * (FR 2.1.2 / 2.1.3), where they become the display name and avatar.
 */
export default function RegisterScreen() {
  const { t } = useSettings();
  const { register } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [values, setValues] = useState({ email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, TranslationKey>>>({});
  const [formError, setFormError] = useState<TranslationKey | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: Field) => (v: string) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async () => {
    const errs: Partial<Record<Field, TranslationKey>> = {
      email: validateEmail(values.email) ?? undefined,
      password: validateNewPassword(values.password) ?? undefined,
      confirm: values.confirm !== values.password ? 'error.passwordMismatch' : undefined,
    };
    setErrors(errs);
    setFormError(null);
    if (Object.values(errs).some(Boolean)) {
      setFormError('error.formSummary');
      return;
    }
    setSubmitting(true);
    try {
      await register(values.email, values.password);
      // Status becomes 'onboarding', so the root guard routes to Complete Your Profile.
    } catch (e) {
      const key = errorMessageKey(e);
      if (key === 'error.emailTaken') setErrors({ email: key });
      else setFormError(key);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen header={<ScreenHeader title={t('register.title')} />} contentStyle={styles.content}>
      <AppText color={colors.textMuted}>{t('register.subtitle')}</AppText>

      {formError && <Banner tone="error">{t(formError)}</Banner>}

      <TextField
        label={t('login.email')}
        placeholder={t('login.emailPlaceholder')}
        value={values.email}
        onChangeText={set('email')}
        error={errors.email && t(errors.email)}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        maxLength={254}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        password
        label={t('login.password')}
        hint={t('register.passwordRules')}
        placeholder={t('login.passwordPlaceholder')}
        value={values.password}
        onChangeText={set('password')}
        error={errors.password && t(errors.password)}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <TextField
        ref={confirmRef}
        password
        label={t('register.confirmPassword')}
        placeholder={t('register.confirmPlaceholder')}
        value={values.confirm}
        onChangeText={set('confirm')}
        error={errors.confirm && t(errors.confirm)}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <Button label={t('common.next')} onPress={submit} loading={submitting} />
      <SingpassButton />

      <View style={styles.footer}>
        <AppText color={colors.textMuted} align="center">
          {t('register.haveAccount')}
        </AppText>
        <Link href="/login" asChild>
          <Pressable accessibilityRole="link" hitSlop={12}>
            <AppText variant="bodyStrong" color={colors.primary}>
              {t('register.logIn')}
            </AppText>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  footer: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
});
