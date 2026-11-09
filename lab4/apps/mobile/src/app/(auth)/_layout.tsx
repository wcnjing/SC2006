import { Stack } from 'expo-router';

import { useSettings } from '@/context/SettingsContext';
import { colors } from '@/theme/tokens';

/** Dialog Map 1: guest authentication and onboarding entry. */
export default function AuthLayout() {
  const { reduceMotion } = useSettings();
  return (
    <Stack
      initialRouteName="login"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: reduceMotion ? 'none' : 'default',
      }}
    />
  );
}
