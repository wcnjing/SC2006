import { useLocalSearchParams } from 'expo-router';
import { DirectMessageScreen } from '../../community/DirectMessageScreen';

export default function MessageRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <DirectMessageScreen userId={typeof id === 'string' ? id : ''} />;
}
