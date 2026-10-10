import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Banner,
  Button,
  Card,
  Checkbox,
  ChipGroup,
  EmptyState,
  IconButton,
  ListRow,
  Screen,
  ScreenHeader,
  Section,
  SegmentedTabs,
  Select,
  Tag,
  TextField,
} from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';

/**
 * Living style guide for the team. Every UI kit component in one place, so
 * P2–P4 can see what exists before building their screens. Only linked
 * from Settings in development builds.
 */
export default function UiKitScreen() {
  const [chips, setChips] = useState<string[]>(['nature']);
  const [distance, setDistance] = useState<string>('1');
  const [tab, setTab] = useState<'upcoming' | 'saved' | 'past'>('upcoming');
  const [checked, setChecked] = useState(true);
  const [sel, setSel] = useState<string | null>('recent');

  return (
    <Screen header={<ScreenHeader title="UI kit" />} contentStyle={styles.content}>
      <Section title="Colour">
        <View style={styles.swatches}>
          {(
            [
              'primary',
              'primaryPressed',
              'primarySoft',
              'text',
              'textMuted',
              'surfaceMuted',
              'error',
              'success',
            ] as const
          ).map((c) => (
            <View key={c} style={styles.swatch}>
              <View style={[styles.swatchColor, { backgroundColor: colors[c] }]} />
              <AppText variant="caption">{c}</AppText>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Typography">
        <AppText variant="display">Display</AppText>
        <AppText variant="h1">Heading 1</AppText>
        <AppText variant="h2">Heading 2</AppText>
        <AppText variant="h3">Heading 3</AppText>
        <AppText>Body: Get your hands green! Join us for a relaxing morning of planting.</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          Caption: Tampines Community Garden (Block 412)
        </AppText>
      </Section>

      <Section title="Buttons">
        <Button label="Primary (Join activity)" />
        <Button label="Outline (Save)" variant="outline" icon="bookmark-outline" />
        <Button label="Secondary" variant="secondary" />
        <Button label="Danger (Cancel activity)" variant="danger" />
        <Button label="Loading" loading />
        <View style={styles.row}>
          <Button label="Accept" size="sm" fullWidth={false} />
          <Button label="Reject" size="sm" variant="secondary" fullWidth={false} />
          <Button label="See all" size="sm" variant="ghost" fullWidth={false} />
        </View>
      </Section>

      <Section title="Gesture alternative (NFR / FR 3.2.6)">
        <AppText variant="caption" color={colors.textMuted}>
          Every swipe must also have buttons. Discover uses these under the card: ✕ = swipe left, ♥
          = swipe right.
        </AppText>
        <View style={[styles.row, { justifyContent: 'center', gap: spacing.xxxl }]}>
          <IconButton
            icon="close"
            label="Not interested, show next activity"
            filled={colors.primary}
            color={colors.onPrimary}
            size={32}
          />
          <IconButton
            icon="heart"
            label="Interested, save activity"
            filled={colors.success}
            color={colors.onPrimary}
            size={32}
          />
        </View>
      </Section>

      <Section title="Inputs">
        <TextField
          label="Phone number"
          placeholder="Enter your 8-digit phone number"
          keyboardType="phone-pad"
        />
        <TextField
          label="Password"
          password
          placeholder="Enter your password"
          error="Incorrect phone number or password."
        />
        <TextField
          label="Share your experience"
          optional
          multiline
          placeholder="Say something about this event…"
        />
        <Select
          label="Sort by"
          inlineLabel="Sort by:"
          hideLabel
          value={sel}
          onChange={setSel}
          options={[
            { value: 'recent', label: 'Recent' },
            { value: 'unread', label: 'Unread' },
          ]}
        />
        <Checkbox label="Wheelchair-accessible" checked={checked} onChange={setChecked} />
      </Section>

      <Section title="Chips">
        <ChipGroup
          accessibilityLabel="Categories"
          value={chips}
          onChange={(v) => setChips(v as string[])}
          options={[
            { value: 'sports', label: 'Sports' },
            { value: 'nature', label: 'Nature' },
            { value: 'arts', label: 'Arts' },
          ]}
        />
        <ChipGroup
          accessibilityLabel="Distance"
          value={distance}
          onChange={(v) => setDistance(v as string)}
          options={[
            { value: '1', label: '< 1 km' },
            { value: '2', label: '< 2 km' },
            { value: '3', label: '< 3 km' },
          ]}
        />
      </Section>

      <Section title="Tabs">
        <SegmentedTabs
          accessibilityLabel="My activities"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'saved', label: 'Saved' },
            { value: 'past', label: 'Past' },
          ]}
        />
      </Section>

      <Section title="Tags & banners">
        <View style={styles.row}>
          <Tag label="Nature" tone="nature" />
          <Tag label="Sports" tone="sports" />
          <Tag label="Arts & Crafts" tone="arts" />
          <Tag label="Wheelchair Accessible" tone="access" icon="accessibility-outline" />
          <Tag label="Outdoor" icon="sunny-outline" />
          <Tag label="Verified Organiser" tone="primary" icon="checkmark-circle" />
        </View>
        <Banner tone="insight">Recommended because you like Nature and it&apos;s 500 m away</Banner>
        <Banner tone="warning">Thundery showers forecast. Check for updates before leaving.</Banner>
        <Banner tone="error">Something went wrong. Please try again.</Banner>
        <Banner tone="success">Profile saved.</Banner>
      </Section>

      <Section title="Cards, rows, avatars">
        <Card>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="h3">Pickleball Lesson</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              Pickleball Court @ Our Tampines Hub · Sun, 14 Sep · 9:00 AM
            </AppText>
          </View>
        </Card>
        <ListRow
          tile
          title="Reported posts"
          subtitle="5 pending decision"
          subtitleTone="alert"
          onPress={() => {}}
        />
        <ListRow tile title="Reported events" subtitle="No pending decision" onPress={() => {}} />
        <View style={styles.row}>
          <Avatar name="Xin Yi" size={56} />
          <Avatar name="Tony" size={56} />
          <Avatar size={56} />
          <IconButton icon="notifications-outline" label="Notifications" badge={3} />
        </View>
      </Section>

      <Section title="Empty state">
        <Card variant="outline" padded={false}>
          <EmptyState
            icon="search-outline"
            title="No matching activities"
            body="Try a different keyword or clear some filters."
            actionLabel="Reset filters"
            onAction={() => {}}
          />
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xxl, paddingTop: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  swatch: { width: 76, gap: spacing.xs },
  swatchColor: { height: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.divider },
});
