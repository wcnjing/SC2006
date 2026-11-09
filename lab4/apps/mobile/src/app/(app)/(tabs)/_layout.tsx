import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import type { TranslationKey } from '@/i18n/en';
import { colors } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; labelKey: TranslationKey; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', labelKey: 'tab.home', icon: 'home-outline', iconActive: 'home' },
  { name: 'discover', labelKey: 'tab.discover', icon: 'search-outline', iconActive: 'search' },
  { name: 'map', labelKey: 'tab.map', icon: 'map-outline', iconActive: 'map' },
  {
    name: 'community',
    labelKey: 'tab.community',
    icon: 'chatbubbles-outline',
    iconActive: 'chatbubbles',
  },
  {
    name: 'dashboard',
    labelKey: 'tab.dashboard',
    icon: 'clipboard-outline',
    iconActive: 'clipboard',
  },
  { name: 'messages', labelKey: 'tab.chats', icon: 'chatbox-outline', iconActive: 'chatbox' },
  { name: 'profile', labelKey: 'tab.profile', icon: 'person-outline', iconActive: 'person' },
];

/** Organisers get a slimmer bar: Home · Dashboard · Chats · Profile. */
const ORGANISER_TABS = new Set(['index', 'dashboard', 'messages', 'profile']);
const RESIDENT_HIDDEN_TABS = new Set(['dashboard']);

/**
 * Dialog Map 3: Consumer shell navigation spine
 * (Home · Discover · Map · Community · Chats · Profile; organisers:
 * Home · Dashboard · Chats · Profile).
 * The active tab uses a filled icon as well as brand red, so it is not
 * shown by colour alone.
 */
export default function TabsLayout() {
  const { t, textScale } = useSettings();
  const organiser = useAuth().hasRole('organiser');
  const visible = (name: string) =>
    organiser ? ORGANISER_TABS.has(name) : !RESIDENT_HIDDEN_TABS.has(name);
  const insets = useSafeAreaInsets();
  // Labels scale with the text-size setting but are capped so five tabs still fit a 360px-wide phone.
  const labelSize = Math.round(12 * Math.min(textScale, 1.15));
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: labelSize, fontWeight: '600' },
        tabBarStyle: {
          height: 60 + labelSize + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
          borderTopColor: colors.divider,
          backgroundColor: colors.surface,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.labelKey),
            // href: null keeps the route but removes it from the tab bar.
            href: visible(tab.name) ? undefined : null,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? tab.iconActive : tab.icon} color={color} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
