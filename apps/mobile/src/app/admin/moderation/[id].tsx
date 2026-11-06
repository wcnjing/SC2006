import { useLocalSearchParams } from 'expo-router';
import { ModerationReviewScreen } from '../../../community/ModerationReviewScreen';

export default function ModerationReviewRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <ModerationReviewScreen id={typeof id === 'string' ? id : ''} />;
}
