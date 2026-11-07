import { Stack } from 'expo-router';

import { useSettings } from '@/context/SettingsContext';
import { NotificationsProvider } from '@/context/NotificationsContext';
import { colors } from '@/theme/tokens';

/**
 * Authenticated area. (tabs) is the 5-tab spine (Dialog Map 3); every other
 * route in this folder is pushed on top of it and returns via the back arrow.
 */
export default function AppLayout() {
  const { reduceMotion } = useSettings();
  return (
    <NotificationsProvider>
      <Stack
        initialRouteName="(tabs)"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: reduceMotion ? 'none' : 'default',
        }}
      />
    </NotificationsProvider>
  );
}
