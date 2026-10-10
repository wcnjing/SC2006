import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Banner,
  Button,
  Checkbox,
  ChipGroup,
  Select,
  TextField,
} from '@/components/ui';
import { ACCESSIBILITY_TAGS, CATEGORIES, NEIGHBOURHOODS, enabled } from '@/config/catalog';
import { useSettings } from '@/context/SettingsContext';
import type { TranslationKey } from '@/i18n/en';
import { validateDisplayName, validateImageType } from '@/lib/validation';
import type { ProfileInput } from '@/types/models';
import { colors, spacing } from '@/theme/tokens';

export type ProfileFormValues = Pick<
  ProfileInput,
  'displayName' | 'pictureUrl' | 'neighbourhoodId' | 'interestIds' | 'accessibilityTagIds'
>;

type Props = {
  mode: 'create' | 'edit';
  initial: Partial<ProfileFormValues>;
  submitLabel: string;
  onSubmit: (values: ProfileFormValues) => Promise<void>;
};

type Errors = Partial<
  Record<'displayName' | 'neighbourhoodId' | 'picture' | 'form', TranslationKey>
>;

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/**
 * Shared by Complete Your Profile (UC #1-01 CreateProfile, FR 2.1) and
 * Edit Profile (UC #1-02 EditProfile, FR 2.2).
 */
export function ProfileForm({ mode, initial, submitLabel, onSubmit }: Props) {
  const { t } = useSettings();
  const start: ProfileFormValues = useMemo(
    () => ({
      displayName: initial.displayName ?? '',
      pictureUrl: initial.pictureUrl ?? null,
      neighbourhoodId: initial.neighbourhoodId ?? '',
      interestIds: initial.interestIds ?? [],
      accessibilityTagIds: initial.accessibilityTagIds ?? [],
    }),
    // Only use the initial values from the first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [values, setValues] = useState<ProfileFormValues>(start);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof ProfileFormValues>(k: K, v: ProfileFormValues[K]) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k === 'pictureUrl' ? 'picture' : k]: undefined, form: undefined }));
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const err = validateImageType(asset.mimeType, asset.uri);
    if (err) {
      setErrors((e) => ({ ...e, picture: err }));
      return;
    }
    set('pictureUrl', asset.uri);
  };

  const submit = async () => {
    const next: Errors = {
      displayName: validateDisplayName(values.displayName) ?? undefined,
      neighbourhoodId: values.neighbourhoodId ? undefined : 'error.neighbourhoodRequired',
    };
    if (next.displayName || next.neighbourhoodId) {
      setErrors({ ...next, form: 'error.formSummary' });
      return;
    }
    if (
      mode === 'edit' &&
      values.displayName.trim() === start.displayName &&
      values.pictureUrl === start.pictureUrl &&
      values.neighbourhoodId === start.neighbourhoodId &&
      sameSet(values.interestIds, start.interestIds) &&
      sameSet(values.accessibilityTagIds, start.accessibilityTagIds)
    ) {
      setErrors({ form: 'error.noChanges' });
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch {
      setErrors({ form: 'error.generic' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.form}>
      <View style={styles.photo}>
        <Avatar
          size={112}
          name={values.displayName || null}
          uri={values.pictureUrl}
          onEdit={pickPhoto}
          editLabel={values.pictureUrl ? t('profile.changePhoto') : t('profile.addPhoto')}
        />
        {values.pictureUrl && (
          <Button
            label={t('profile.removePhoto')}
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() => set('pictureUrl', null)}
          />
        )}
        {errors.picture && <Banner tone="error">{t(errors.picture)}</Banner>}
      </View>

      <TextField
        label={t('profile.displayName')}
        hint={t('profile.displayNameHint')}
        placeholder={t('profile.displayNamePlaceholder')}
        value={values.displayName}
        onChangeText={(v) => set('displayName', v)}
        error={errors.displayName && t(errors.displayName)}
        autoComplete="nickname"
        maxLength={30}
        returnKeyType="done"
      />

      <Select
        label={t('profile.neighbourhood')}
        leftIcon="location-outline"
        value={values.neighbourhoodId || null}
        options={enabled(NEIGHBOURHOODS).map((n) => ({
          value: n.id,
          label: t(n.labelKey as TranslationKey),
        }))}
        onChange={(v) => set('neighbourhoodId', v)}
        error={errors.neighbourhoodId && t(errors.neighbourhoodId)}
      />

      <View style={styles.group}>
        <AppText variant="label" heading>
          {t('profile.interests')}
        </AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {t('profile.interestsHint')}
        </AppText>
        <ChipGroup
          accessibilityLabel={t('profile.interests')}
          options={enabled(CATEGORIES).map((c) => ({
            value: c.id,
            label: t(c.labelKey as TranslationKey),
          }))}
          value={values.interestIds}
          onChange={(v) => set('interestIds', v as string[])}
        />
      </View>

      <View style={styles.group}>
        <AppText variant="label" heading>
          {t('profile.accessibility')}
          <AppText variant="caption" color={colors.textSubtle}>
            {'  '}
            {t('common.optional')}
          </AppText>
        </AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {t('profile.accessibilityHint')}
        </AppText>
        {enabled(ACCESSIBILITY_TAGS).map((tag) => (
          <Checkbox
            key={tag.id}
            label={t(tag.labelKey as TranslationKey)}
            checked={values.accessibilityTagIds.includes(tag.id)}
            onChange={(on) =>
              set(
                'accessibilityTagIds',
                on
                  ? [...values.accessibilityTagIds, tag.id]
                  : values.accessibilityTagIds.filter((x) => x !== tag.id),
              )
            }
          />
        ))}
      </View>

      {errors.form && <Banner tone="error">{t(errors.form)}</Banner>}
      <Button label={submitLabel} onPress={submit} loading={submitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xl },
  photo: { alignItems: 'center', gap: spacing.sm },
  group: { gap: spacing.sm },
});
