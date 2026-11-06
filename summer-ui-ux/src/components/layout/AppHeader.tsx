import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/SettingsContext';
import { colors, spacing } from '@/theme/tokens';

import { Wordmark } from './Logo';

/**
 * Brand header for tab-root screens (Home, Community): logo + bell + avatar,
 * as in mockups 4.B / 4.D. Bell → Notifications (P4); avatar → Profile tab.
 */
export function AppHeader({ unread = 0 }: { unread?: number }) {
  const t = useT();
  const { session } = useAuth();
  const profile = session?.profile;
  return (
    <View style={styles.bar}>
      <Wordmark size={30} />
      <View style={styles.actions}>
        <IconButton
          icon="notifications-outline"
          label={t('home.notifications')}
          badge={unread || false}
          onPress={() => router.push('/notifications')}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.openProfile')}
          onPress={() => router.navigate('/profile')}
          style={styles.avatarBtn}
        >
          <Avatar name={profile?.displayName} uri={profile?.pictureUrl} size={36} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.xl,
    paddingRight: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  actions: { flexDirection: 'row', alignItems: 'center' },
  avatarBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
