import { Stack } from 'expo-router';
import { ActivityRecommendations } from '../../activities/ActivityRecommendations';

export default function RecommendationsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Recommended for you' }} />
      <ActivityRecommendations />
    </>
  );
}
