import { router } from 'expo-router';

import { findNeighbourhood } from '@/config/catalog';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/SettingsContext';
import { PostForm } from '@/features/community/PostForm';
import { communityService, ServiceError } from '@/services';

/** Create post (FR 7.2, UC CreatePost). Posts go to the author's own neighbourhood feed. */
export default function CreatePostScreen() {
  const t = useT();
  const { session } = useAuth();
  const hood = findNeighbourhood(session?.profile?.neighbourhoodId);
  return (
    <PostForm
      title={t('post.createTitle')}
      submitLabel={t('post.publish')}
      onSubmit={async (body, imageUrl) => {
        if (!hood) throw new ServiceError('NOT_FOUND');
        const post = await communityService.createPost({
          body,
          imageUrl,
          neighbourhoodId: hood.dbId,
        });
        router.replace({ pathname: '/post/[id]', params: { id: post.id } });
      }}
    />
  );
}
