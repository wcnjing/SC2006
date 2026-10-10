import { StyleSheet, View } from 'react-native';

import {
  AppHeader,
  AppText,
  Card,
  EmptyState,
  Screen,
  ScreenHeader,
  type IconName,
} from '@/components/ui';
import { useT } from '@/context/SettingsContext';
import { colors, spacing } from '@/theme/tokens';

type Props = {
  title: string;
  /** Teammate who owns this screen, per Plan.pdf, e.g. "P2 (Shyanne): Discovery". */
  owner: string;
  /** FR / use case references this screen implements. */
  covers: string[];
  icon?: IconName;
  /** Tab roots show the brand header and no back arrow. */
  tabRoot?: boolean;
};

/**
 * Stand-in for a screen another team member builds. It sits on the real
 * route, so navigation can be tested end to end now. Replace the whole file
 * body when you build the screen; keep the route file name.
 */
export function PlaceholderScreen({
  title,
  owner,
  covers,
  icon = 'construct-outline',
  tabRoot,
}: Props) {
  const t = useT();
  return (
    <Screen inTabs={tabRoot} header={tabRoot ? <AppHeader /> : <ScreenHeader title={title} />}>
      {tabRoot && (
        <AppText variant="h1" heading style={styles.tabTitle}>
          {title}
        </AppText>
      )}
      <EmptyState
        icon={icon}
        title={t('common.comingSoon')}
        body={t('placeholder.body', { owner })}
      />
      <Card variant="muted">
        <View style={styles.covers}>
          <AppText variant="label">{t('placeholder.covers')}</AppText>
          {covers.map((c) => (
            <AppText key={c} variant="caption" color={colors.textMuted}>
              • {c}
            </AppText>
          ))}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabTitle: { marginTop: spacing.lg },
  covers: { gap: spacing.xs },
});
