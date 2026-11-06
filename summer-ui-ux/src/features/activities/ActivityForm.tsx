import type { ActivityInput } from '@communitylink/shared';
import { StyleSheet, View } from 'react-native';

import { AppText, Banner, Checkbox, ChipGroup, Select, TextField } from '@/components/ui';
import {
  ACCESSIBILITY_TAGS,
  CATEGORIES,
  NEIGHBOURHOODS,
  findNeighbourhood,
} from '@/config/catalog';
import { useT } from '@/context/SettingsContext';
import type { TranslationKey } from '@/i18n/en';
import { spacing } from '@/theme/tokens';
import type { Activity } from '@/types/models';

export type ActivityFormValues = {
  title: string;
  description: string;
  category: string;
  locationName: string;
  address: string;
  /** Neighbourhood slug; picking one places the activity at its town centre (for distance and "nearby"). */
  hood: string;
  date: string; // YYYY-MM-DD, Singapore
  start: string; // HH:MM
  end: string;
  capacity: string; // blank = no limit
  cost: string; // dollars, blank = free
  outdoor: boolean;
  access: string[];
};

const sgParts = (iso: string) => {
  const s = new Date(Date.parse(iso) + 8 * 3600_000).toISOString();
  return { date: s.slice(0, 10), time: s.slice(11, 16) };
};

export function toFormValues(a?: Activity): ActivityFormValues {
  return {
    title: a?.title ?? '',
    description: a?.description ?? '',
    category: a?.category ?? '',
    locationName: a?.location_name ?? '',
    address: a?.address ?? '',
    hood: '',
    date: a ? sgParts(a.starts_at).date : '',
    start: a ? sgParts(a.starts_at).time : '',
    end: a ? sgParts(a.ends_at).time : '',
    capacity: a?.capacity?.toString() ?? '',
    cost: a?.cost_cents ? (a.cost_cents / 100).toFixed(2) : '',
    outdoor: a?.is_outdoor ?? false,
    access: a?.accessibility_features ?? [],
  };
}

/**
 * Form → P2's ActivityInput. Times are entered in Singapore time (+08:00);
 * P2's validateActivityInput checks everything else (future start, end after
 * start, whole-number capacity) and the screens show its message.
 */
export function toActivityInput(v: ActivityFormValues, existing?: Activity): ActivityInput {
  const hood = findNeighbourhood(v.hood);
  return {
    title: v.title,
    description: v.description,
    category: v.category,
    location_name: v.locationName,
    address: v.address,
    starts_at: `${v.date.trim()}T${v.start.trim()}:00+08:00`,
    ends_at: `${v.date.trim()}T${v.end.trim()}:00+08:00`,
    capacity: v.capacity.trim() ? Number(v.capacity) : null,
    cost_cents: v.cost.trim() ? Math.round(Number(v.cost) * 100) : 0,
    is_outdoor: v.outdoor,
    accessibility_features: v.access,
    tags: existing?.tags ?? [],
    lat: hood?.lat ?? existing?.lat ?? null,
    lng: hood?.lng ?? existing?.lng ?? null,
  };
}

type Props = {
  values: ActivityFormValues;
  onChange: (v: ActivityFormValues) => void;
  error: string | null;
};

/** Create / edit activity fields (FR 11.1–11.2). Controlled; the screen owns submit. */
export function ActivityForm({ values, onChange, error }: Props) {
  const t = useT();
  const set =
    <K extends keyof ActivityFormValues>(key: K) =>
    (value: ActivityFormValues[K]) =>
      onChange({ ...values, [key]: value });
  const options = (items: { id: string; labelKey: string }[]) =>
    items.map((i) => ({ value: i.id, label: t(i.labelKey as TranslationKey) }));

  return (
    <View style={styles.form}>
      {error && <Banner tone="error">{error}</Banner>}
      <TextField
        label={t('organiser.fieldTitle')}
        value={values.title}
        onChangeText={set('title')}
      />
      <TextField
        label={t('organiser.fieldDescription')}
        value={values.description}
        onChangeText={set('description')}
        multiline
      />
      <Select
        label={t('organiser.fieldCategory')}
        value={values.category || null}
        options={options(CATEGORIES)}
        onChange={set('category')}
      />
      <TextField
        label={t('organiser.fieldLocation')}
        hint={t('organiser.fieldLocationHint')}
        value={values.locationName}
        onChangeText={set('locationName')}
      />
      <TextField
        label={t('organiser.fieldAddress')}
        optional
        value={values.address}
        onChangeText={set('address')}
      />
      <Select
        label={t('organiser.fieldNeighbourhood')}
        value={values.hood || null}
        options={options(NEIGHBOURHOODS)}
        onChange={set('hood')}
        placeholder={t('organiser.fieldNeighbourhoodKeep')}
      />
      <TextField
        label={t('organiser.fieldDate')}
        hint={t('organiser.fieldDateHint')}
        value={values.date}
        onChangeText={set('date')}
        keyboardType="numbers-and-punctuation"
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            label={t('organiser.fieldStart')}
            hint={t('organiser.fieldTimeHint')}
            value={values.start}
            onChangeText={set('start')}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label={t('organiser.fieldEnd')}
            hint={t('organiser.fieldTimeHint')}
            value={values.end}
            onChangeText={set('end')}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            label={t('organiser.fieldCapacity')}
            hint={t('organiser.fieldCapacityHint')}
            optional
            value={values.capacity}
            onChangeText={set('capacity')}
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label={t('organiser.fieldCost')}
            hint={t('organiser.fieldCostHint')}
            optional
            value={values.cost}
            onChangeText={set('cost')}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
      <Checkbox
        label={t('organiser.fieldOutdoor')}
        checked={values.outdoor}
        onChange={set('outdoor')}
      />
      <AppText variant="label">{t('organiser.fieldAccess')}</AppText>
      <ChipGroup
        accessibilityLabel={t('organiser.fieldAccess')}
        options={options(ACCESSIBILITY_TAGS)}
        value={values.access}
        onChange={(v) => set('access')(v as string[])}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
