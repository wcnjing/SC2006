import { useLocalSearchParams } from 'expo-router';
import { PostEditorScreen } from '../../../community/PostEditorScreen';

export default function EditPostRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PostEditorScreen key={String(id)} id={typeof id === 'string' && id ? id : 'invalid'} />;
}
