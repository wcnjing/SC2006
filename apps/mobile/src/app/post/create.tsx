import { useLocalSearchParams } from 'expo-router';
import { PostEditorScreen } from '../../community/PostEditorScreen';

export default function CreatePostRoute() {
  const { neighbourhoodId } = useLocalSearchParams<{ neighbourhoodId?: string }>();
  const initialId = typeof neighbourhoodId === 'string' ? Number(neighbourhoodId) : NaN;
  return (
    <PostEditorScreen
      initialNeighbourhoodId={
        Number.isInteger(initialId) && initialId > 0 && initialId <= 32767 ? initialId : undefined
      }
    />
  );
}
