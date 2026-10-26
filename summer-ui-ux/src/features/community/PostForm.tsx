import {
  POST_BODY_MAX_LENGTH,
  validatePostBody,
  validatePostImageUrl,
} from '@communitylink/shared';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Banner, Button, Screen, ScreenHeader, TextField } from '@/components/ui';
import { useT } from '@/context/SettingsContext';
import { errorText } from '@/services';
import { spacing } from '@/theme/tokens';

type Props = {
  title: string;
  submitLabel: string;
  initial?: { body: string; imageUrl: string | null };
  onSubmit: (body: string, imageUrl: string | null) => Promise<void>;
};

/** Create post / Edit post form (FR 7.2, UC CreatePost / EditPost). Validation is P3's shared rules. */
export function PostForm({ title, submitLabel, initial, onSubmit }: Props) {
  const t = useT();
  const [body, setBody] = useState(initial?.body ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [errors, setErrors] = useState<{ body?: string | null; image?: string | null }>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next = { body: validatePostBody(body), image: validatePostImageUrl(imageUrl) };
    setErrors(next);
    setFailed(null);
    if (next.body || next.image) return;
    setBusy(true);
    try {
      await onSubmit(body, imageUrl.trim() || null);
    } catch (e) {
      setFailed(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<ScreenHeader title={title} />}
      contentStyle={styles.content}
      footer={<Button label={submitLabel} icon="send" loading={busy} onPress={submit} />}
    >
      {failed && <Banner tone="error">{failed}</Banner>}
      <TextField
        label={t('post.bodyLabel')}
        hint={t('post.bodyHint', {
          count: Array.from(body.trim()).length,
          max: POST_BODY_MAX_LENGTH,
        })}
        value={body}
        onChangeText={setBody}
        error={errors.body}
        multiline
        autoFocus={!initial}
      />
      <TextField
        label={t('post.imageLabel')}
        hint={t('post.imageHint')}
        optional
        value={imageUrl}
        onChangeText={setImageUrl}
        error={errors.image}
        autoCapitalize="none"
        keyboardType="url"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { gap: spacing.lg, paddingTop: spacing.sm } });
