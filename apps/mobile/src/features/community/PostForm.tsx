import {
  POST_BODY_MAX_LENGTH,
  validatePostBody,
  validatePostImageUrl,
} from '@communitylink/shared';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Banner,
  Button,
  IconButton,
  ImageViewer,
  Screen,
  ScreenHeader,
  TextField,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/SettingsContext';
import { errorText } from '@/services';
import { uploadImage } from '@/services/supabase/uploads';
import { colors, radii, spacing } from '@/theme/tokens';

type Props = {
  title: string;
  submitLabel: string;
  initial?: { body: string; imageUrl: string | null };
  onSubmit: (body: string, imageUrl: string | null) => Promise<void>;
};

/** Create post / Edit post form (FR 7.2, UC CreatePost / EditPost). Validation is P3's shared rules. */
export function PostForm({ title, submitLabel, initial, onSubmit }: Props) {
  const t = useT();
  const userId = useAuth().session?.account.accountId;
  const [body, setBody] = useState(initial?.body ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [errors, setErrors] = useState<{ body?: string | null; image?: string | null }>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const chooseImage = async () => {
    if (!userId) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      setImageUrl(await uploadImage('community-images', userId, result.assets[0].uri));
    } catch (e) {
      setFailed(errorText(t, e));
    } finally {
      setUploading(false);
    }
  };

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
      <Button
        label={imageUrl ? 'Replace image' : 'Add image'}
        icon="image-outline"
        variant="outline"
        loading={uploading}
        onPress={chooseImage}
      />
      {!!imageUrl && (
        <View style={styles.preview}>
          <ImageViewer uri={imageUrl} style={styles.previewImage} label="Preview attached image" />
          <View style={styles.removeButton}>
            <IconButton
              icon="close-circle"
              label="Remove attached image"
              color={colors.error}
              onPress={() => {
                setImageUrl('');
                setErrors((prev) => ({ ...prev, image: null }));
              }}
            />
          </View>
        </View>
      )}
      {errors.image && <Banner tone="error">{errors.image}</Banner>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.sm },
  preview: { position: 'relative' },
  previewImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: radii.md },
  removeButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
  },
});
