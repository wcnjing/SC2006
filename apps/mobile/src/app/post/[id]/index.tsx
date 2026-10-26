import { useLocalSearchParams } from 'expo-router';
import { PostDetailScreen } from '../../../community/PostDetailScreen';

export default function PostDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PostDetailScreen key={String(id)} id={typeof id === 'string' ? id : ''} />;
}
