/**
 * Configurable catalogues (NFR Maintainability: new categories, neighbourhoods
 * or accessibility tags are added here, not in screen code).
 *
 * Once P1's Supabase tables (ActivityCategory, AccessibilityTag, Community)
 * are seeded, these lists become the offline fallback and the `id`s must
 * match the seeded rows. Labels are i18n keys, not display strings.
 */

export type CatalogItem = { id: string; labelKey: string; enabled: boolean };

export const NEIGHBOURHOODS: CatalogItem[] = [
  { id: 'ang-mo-kio', labelKey: 'neighbourhood.angMoKio', enabled: true },
  { id: 'bedok', labelKey: 'neighbourhood.bedok', enabled: true },
  { id: 'bishan', labelKey: 'neighbourhood.bishan', enabled: true },
  { id: 'bukit-batok', labelKey: 'neighbourhood.bukitBatok', enabled: true },
  { id: 'clementi', labelKey: 'neighbourhood.clementi', enabled: true },
  { id: 'hougang', labelKey: 'neighbourhood.hougang', enabled: true },
  { id: 'jurong-west', labelKey: 'neighbourhood.jurongWest', enabled: true },
  { id: 'pasir-ris', labelKey: 'neighbourhood.pasirRis', enabled: true },
  { id: 'punggol', labelKey: 'neighbourhood.punggol', enabled: true },
  { id: 'sengkang', labelKey: 'neighbourhood.sengkang', enabled: true },
  { id: 'tampines', labelKey: 'neighbourhood.tampines', enabled: true },
  { id: 'tanjong-pagar', labelKey: 'neighbourhood.tanjongPagar', enabled: true },
  { id: 'toa-payoh', labelKey: 'neighbourhood.toaPayoh', enabled: true },
  { id: 'woodlands', labelKey: 'neighbourhood.woodlands', enabled: true },
  { id: 'yishun', labelKey: 'neighbourhood.yishun', enabled: true },
];

/** Activity categories double as profile "interests" (Data Dictionary: Interest). */
export const CATEGORIES: CatalogItem[] = [
  { id: 'sports', labelKey: 'category.sports', enabled: true },
  { id: 'food', labelKey: 'category.food', enabled: true },
  { id: 'arts', labelKey: 'category.arts', enabled: true },
  { id: 'nature', labelKey: 'category.nature', enabled: true },
  { id: 'volunteering', labelKey: 'category.volunteering', enabled: true },
  { id: 'games', labelKey: 'category.games', enabled: true },
  { id: 'learning', labelKey: 'category.learning', enabled: true },
  { id: 'social', labelKey: 'category.social', enabled: true },
  { id: 'wellness', labelKey: 'category.wellness', enabled: true },
];

export const ACCESSIBILITY_TAGS: CatalogItem[] = [
  { id: 'wheelchair', labelKey: 'access.wheelchair', enabled: true },
  { id: 'elderly', labelKey: 'access.elderly', enabled: true },
  { id: 'family', labelKey: 'access.family', enabled: true },
  { id: 'sensory', labelKey: 'access.sensory', enabled: true },
  { id: 'low-intensity', labelKey: 'access.lowIntensity', enabled: true },
];

export const enabled = (items: CatalogItem[]) => items.filter((i) => i.enabled);

export const findLabelKey = (items: CatalogItem[], id: string | null | undefined) =>
  items.find((i) => i.id === id)?.labelKey;
