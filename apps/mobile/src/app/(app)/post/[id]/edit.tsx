import { router, useLocalSearchParams } from 'expo-router';

import { EmptyState, ErrorState, LoadingState, Screen, ScreenHeader } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/SettingsContext';
import { PostForm } from '@/features/community/PostForm';
import { useAsync } from '@/lib/useAsync';
import { communityService, errorMessageKey } from '@/services';

/** Edit post (FR 7.2.5, UC EditPost). Authors only; P3's updatePost enforces it too. */
export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const { session } = useAuth();
  const post = useAsync(() => communityService.getPost(id));

  if (!post.data) {
    return (
      <Screen header={<ScreenHeader title={t('post.editTitle')} />}>
        {post.loading ? (
          <LoadingState />
        ) : post.error ? (
          <ErrorState message={t(errorMessageKey(post.error))} onRetry={post.reload} />
        ) : (
          <EmptyState icon="document-outline" title={t('post.unavailable')} />
        )}
      </Screen>
    );
  }
  if (post.data.author_id !== session?.account.accountId) {
    return (
      <Screen header={<ScreenHeader title={t('post.editTitle')} />}>
        <EmptyState icon="lock-closed-outline" title={t('post.notYours')} />
      </Screen>
    );
  }
  return (
    <PostForm
      title={t('post.editTitle')}
      submitLabel={t('common.saveChanges')}
      initial={{ body: post.data.body, imageUrl: post.data.image_url }}
      onSubmit={async (body, imageUrl) => {
        await communityService.updatePost(id, { body, imageUrl });
        if (router.canGoBack()) router.back();
        else router.replace({ pathname: '/post/[id]', params: { id } });
      }}
    />
  );
}
