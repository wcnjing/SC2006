import { can } from '@communitylink/shared';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { communityStyles as styles, communityText as text } from './communityUi';

export function AdminGuard({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  return can(profile, 'report:review') ? (
    children
  ) : (
    <View style={[styles.screen, styles.content]}>
      <Text accessibilityRole="alert" style={styles.body}>
        {text.adminOnly}
      </Text>
    </View>
  );
}
