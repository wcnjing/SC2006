import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Button,
  Card,
  ListRow,
  Screen,
  Tag,
  type IconName,
} from '@/components/ui';
import { ACCESSIBILITY_TAGS, CATEGORIES, NEIGHBOURHOODS, findLabelKey } from '@/config/catalog';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import type { TranslationKey } from '@/i18n/en';
import { colors, spacing } from '@/theme/tokens';

type MenuItem = { key: TranslationKey; icon: IconName; href: Href; subtitle?: string };

/**
 * Own profile (Profile tab). Mockup 4.E "View Profile", adapted for your own
 * account: the hub for every Profile branch in the Dialog Map (Edit Profile,
 * My Activities, Friend Requests, Direct Messages, role dashboards, Log out).
 *
 * The mockup's Bio / Favourite food tiles are not in the data dictionary or
 * class diagram, so they were left out. Neighbourhood, interests and
 * accessibility preferences are shown instead.
 */
export default function ProfileTab() {
  const { t } = useSettings();
  const { session, logout, hasRole } = useAuth();
  const profile = session?.profile;
  if (!profile) return null;

  const hoodKey = findLabelKey(NEIGHBOURHOODS, profile.neighbourhoodId) as
    | TranslationKey
    | undefined;
  const label = (items: typeof CATEGORIES, id: string) => {
    const k = findLabelKey(items, id);
    return k ? t(k as TranslationKey) : id;
  };

  const activity: MenuItem[] = [
    { key: 'profile.myActivities', icon: 'calendar-outline', href: '/my-activities' },
  ];
  const connect: MenuItem[] = [
    { key: 'profile.friendRequests', icon: 'person-add-outline', href: '/friend-requests' },
    { key: 'profile.messages', icon: 'chatbubble-ellipses-outline', href: '/messages' },
  ];
  const manage: MenuItem[] = [
    ...(hasRole('organiser')
      ? [
          {
            key: 'profile.organiserDashboard',
            icon: 'clipboard-outline',
            href: '/organiser',
          } as MenuItem,
        ]
      : []),
    ...(hasRole('admin')
      ? [
          {
            key: 'profile.adminDashboard',
            icon: 'shield-checkmark-outline',
            href: '/admin',
          } as MenuItem,
        ]
      : []),
  ];

  const renderGroup = (titleKey: TranslationKey, items: MenuItem[]) =>
    items.length > 0 && (
      <View style={styles.group}>
        <AppText variant="label" color={colors.textMuted} heading>
          {t(titleKey)}
        </AppText>
        <Card variant="outline" padded={false}>
          {items.map((m, i) => (
            <View key={m.key} style={i > 0 && styles.sep}>
              <ListRow title={t(m.key)} icon={m.icon} onPress={() => router.push(m.href)} />
            </View>
          ))}
        </Card>
      </View>
    );

  return (
    <Screen inTabs contentStyle={styles.content}>
      <View style={styles.head}>
        <Avatar name={profile.displayName} uri={profile.pictureUrl} size={96} />
        <View style={styles.headText}>
          <AppText variant="h1" heading numberOfLines={2}>
            {profile.displayName}
          </AppText>
          {hoodKey && (
            <AppText color={colors.textMuted}>
              {t('profile.neighbourhoodLabel')}: {t(hoodKey)}
            </AppText>
          )}
        </View>
      </View>

      <Button
        label={t('profile.edit')}
        variant="outline"
        icon="create-outline"
        onPress={() => router.push('/edit-profile')}
      />

      <Card variant="muted">
        <View style={styles.group}>
          <AppText variant="label">{t('profile.interestsLabel')}</AppText>
          {profile.interestIds.length ? (
            <View style={styles.tags}>
              {profile.interestIds.map((id) => (
                <Tag key={id} label={label(CATEGORIES, id)} tone="primary" />
              ))}
            </View>
          ) : (
            <AppText variant="caption" color={colors.textMuted}>
              {t('profile.noInterests')}
            </AppText>
          )}
          {profile.accessibilityTagIds.length > 0 && (
            <>
              <AppText variant="label" style={{ marginTop: spacing.sm }}>
                {t('profile.accessLabel')}
              </AppText>
              <View style={styles.tags}>
                {profile.accessibilityTagIds.map((id) => (
                  <Tag
                    key={id}
                    label={label(ACCESSIBILITY_TAGS, id)}
                    tone="access"
                    icon="accessibility-outline"
                  />
                ))}
              </View>
            </>
          )}
        </View>
      </Card>

      {renderGroup('profile.sectionActivity', activity)}
      {renderGroup('profile.sectionConnect', connect)}
      {renderGroup('profile.sectionManage', manage)}

      <View style={styles.group}>
        <AppText variant="label" color={colors.textMuted} heading>
          {t('profile.sectionAccount')}
        </AppText>
        <Card variant="outline" padded={false}>
          <ListRow
            title={t('profile.settings')}
            icon="settings-outline"
            onPress={() => router.push('/settings')}
          />
          <View style={styles.sep}>
            <ListRow
              title={t('profile.logout')}
              icon="log-out-outline"
              destructive
              onPress={logout}
            />
          </View>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  headText: { flex: 1, gap: spacing.xs },
  group: { gap: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  sep: { borderTopWidth: 1, borderTopColor: colors.divider },
});
