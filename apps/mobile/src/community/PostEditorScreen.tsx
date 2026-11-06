import {
  ApiError,
  POST_BODY_MAX_LENGTH,
  validatePostBody,
  validatePostImageUrl,
} from '@communitylink/shared';
import { createPost, getPost, listNeighbourhoods, updatePost } from '../services/community';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/tokens';
import {
  CommunityButton,
  CommunityError,
  communityStyles as styles,
  communityText as text,
  NeighbourhoodPicker,
} from './communityUi';
import { useCommunityQuery } from './useCommunityQuery';

const loadNeighbourhoods = () => listNeighbourhoods(supabase);

export function PostEditorScreen({
  id,
  initialNeighbourhoodId,
}: {
  id?: string;
  initialNeighbourhoodId?: number;
}) {
  const { profile } = useAuth();
  const load = useCallback(
    (signal: AbortSignal) => (id ? getPost(supabase, id, { signal }) : Promise.resolve(null)),
    [id],
  );
  const post = useCommunityQuery(load);
  const neighbourhoods = useCommunityQuery(loadNeighbourhoods);
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(
    initialNeighbourhoodId ?? profile?.neighbourhood_id ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const [requestId] = useState(() => randomUUID());
  const initialized = useRef(false);
  const neighbourhoodId = selectedId ?? neighbourhoods.data?.[0]?.id ?? null;
  useEffect(() => {
    if (!post.data || initialized.current) return;
    initialized.current = true;
    setBody(post.data.body);
    setImageUrl(post.data.image_url ?? '');
    setSelectedId(post.data.neighbourhood_id);
  }, [post.data]);

  async function submit() {
    if (busy.current) return;
    const validation = validatePostBody(body) || validatePostImageUrl(imageUrl);
    if (validation || neighbourhoodId === null) {
      setError(validation ?? 'Choose a neighbourhood.');
      return;
    }
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const input = { body, imageUrl, neighbourhoodId };
      const saved = id
        ? await updatePost(supabase, id, input)
        : await createPost(supabase, { ...input, requestId });
      const destination = { pathname: '/post/[id]' as const, params: { id: saved.id } };
      if (id) router.dismissTo(destination);
      else router.replace(destination);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : text.saveError);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  if (id && post.loading) return <ActivityIndicator accessibilityLabel="Loading post" />;
  if (id && post.error)
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <CommunityError>{post.error}</CommunityError>
        <CommunityButton label={text.retry} onPress={post.retry} />
      </ScrollView>
    );
  if (id && (!post.data || post.data.author_id !== profile?.id))
    return <Text style={styles.content}>{post.data ? text.noPermission : text.unavailable}</Text>;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {neighbourhoods.loading && <ActivityIndicator accessibilityLabel="Loading neighbourhoods" />}
      {neighbourhoods.error && (
        <>
          <CommunityError>{neighbourhoods.error}</CommunityError>
          <CommunityButton label={text.retry} onPress={neighbourhoods.retry} />
        </>
      )}
      <NeighbourhoodPicker
        neighbourhoods={neighbourhoods.data ?? []}
        selectedId={neighbourhoodId}
        onSelect={setSelectedId}
        disabled={saving}
      />
      {!neighbourhoods.loading && !neighbourhoods.error && !neighbourhoods.data?.length && (
        <Text style={styles.body}>{text.noNeighbourhoods}</Text>
      )}
      <Text style={styles.label}>{text.body}</Text>
      <TextInput
        accessibilityLabel={text.body}
        placeholder={text.bodyPlaceholder}
        placeholderTextColor={colors.textSubtle}
        style={[styles.input, styles.multiline]}
        multiline
        value={body}
        onChangeText={setBody}
        editable={!saving}
      />
      <Text style={styles.muted}>
        {Array.from(body.trim()).length} / {POST_BODY_MAX_LENGTH}
      </Text>
      <Text style={styles.label}>{text.image}</Text>
      <TextInput
        accessibilityLabel={text.image}
        style={styles.input}
        value={imageUrl}
        onChangeText={setImageUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={!saving}
      />
      <Text style={styles.muted}>{text.imageHint}</Text>
      {error && <CommunityError>{error}</CommunityError>}
      <CommunityButton
        label={saving ? text.saving : id ? text.save : text.publish}
        onPress={() => void submit()}
        disabled={
          saving ||
          !neighbourhoodId ||
          profile?.status !== 'active' ||
          neighbourhoods.loading ||
          !!neighbourhoods.error ||
          !neighbourhoods.data?.length
        }
      />
    </ScrollView>
  );
}
