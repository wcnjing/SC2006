/**
 * Configurable catalogues (NFR Maintainability: new categories, neighbourhoods
 * or accessibility tags are added here, not in screen code).
 *
 * Ids match P1's canonical lists, so data from P1/P2's API needs no mapping:
 *  - CATEGORIES        = INTERESTS in packages/shared/src/constants.ts
 *  - ACCESSIBILITY_TAGS = ACCESSIBILITY_NEEDS in packages/shared/src/constants.ts
 *  - NEIGHBOURHOODS    = supabase/migrations/*_reference_data.sql (same order,
 *                         so `dbId` is the serial id a fresh database assigns)
 * Labels are i18n keys, not display strings.
 */

export type CatalogItem = { id: string; labelKey: string; enabled: boolean };

export type NeighbourhoodItem = CatalogItem & {
  /** neighbourhoods.id in Supabase (Profile.neighbourhood_id, Activity.neighbourhood_id). */
  dbId: number;
  /** Approximate town centre, used as the distance origin when device GPS is not available. */
  lat: number;
  lng: number;
};

const hood = (
  dbId: number,
  id: string,
  labelKey: string,
  lat: number,
  lng: number,
): NeighbourhoodItem => ({ id, dbId, labelKey, lat, lng, enabled: true });

export const NEIGHBOURHOODS: NeighbourhoodItem[] = [
  hood(1, 'ang-mo-kio', 'neighbourhood.angMoKio', 1.3691, 103.8454),
  hood(2, 'bedok', 'neighbourhood.bedok', 1.3236, 103.9273),
  hood(3, 'bishan', 'neighbourhood.bishan', 1.3526, 103.8352),
  hood(4, 'bukit-batok', 'neighbourhood.bukitBatok', 1.359, 103.7637),
  hood(5, 'bukit-merah', 'neighbourhood.bukitMerah', 1.2819, 103.8239),
  hood(6, 'bukit-panjang', 'neighbourhood.bukitPanjang', 1.3774, 103.7719),
  hood(7, 'choa-chu-kang', 'neighbourhood.choaChuKang', 1.384, 103.747),
  hood(8, 'clementi', 'neighbourhood.clementi', 1.3162, 103.7649),
  hood(9, 'geylang', 'neighbourhood.geylang', 1.3201, 103.8918),
  hood(10, 'hougang', 'neighbourhood.hougang', 1.3612, 103.8863),
  hood(11, 'jurong-east', 'neighbourhood.jurongEast', 1.3329, 103.7436),
  hood(12, 'jurong-west', 'neighbourhood.jurongWest', 1.3404, 103.709),
  hood(13, 'kallang', 'neighbourhood.kallang', 1.31, 103.8651),
  hood(14, 'pasir-ris', 'neighbourhood.pasirRis', 1.3721, 103.9474),
  hood(15, 'punggol', 'neighbourhood.punggol', 1.3984, 103.9072),
  hood(16, 'queenstown', 'neighbourhood.queenstown', 1.2942, 103.7861),
  hood(17, 'sembawang', 'neighbourhood.sembawang', 1.4491, 103.8185),
  hood(18, 'sengkang', 'neighbourhood.sengkang', 1.3868, 103.8914),
  hood(19, 'serangoon', 'neighbourhood.serangoon', 1.3554, 103.8679),
  hood(20, 'tampines', 'neighbourhood.tampines', 1.3496, 103.9568),
  hood(21, 'toa-payoh', 'neighbourhood.toaPayoh', 1.3343, 103.8563),
  hood(22, 'woodlands', 'neighbourhood.woodlands', 1.4382, 103.789),
  hood(23, 'yishun', 'neighbourhood.yishun', 1.4304, 103.8354),
];

/** Activity categories double as profile "interests" (Data Dictionary: Interest). */
export const CATEGORIES: CatalogItem[] = [
  { id: 'sports', labelKey: 'category.sports', enabled: true },
  { id: 'fitness', labelKey: 'category.fitness', enabled: true },
  { id: 'arts-crafts', labelKey: 'category.artsCrafts', enabled: true },
  { id: 'music', labelKey: 'category.music', enabled: true },
  { id: 'cooking', labelKey: 'category.cooking', enabled: true },
  { id: 'gardening', labelKey: 'category.gardening', enabled: true },
  { id: 'volunteering', labelKey: 'category.volunteering', enabled: true },
  { id: 'learning', labelKey: 'category.learning', enabled: true },
  { id: 'technology', labelKey: 'category.technology', enabled: true },
  { id: 'games', labelKey: 'category.games', enabled: true },
  { id: 'outdoors', labelKey: 'category.outdoors', enabled: true },
  { id: 'wellness', labelKey: 'category.wellness', enabled: true },
  { id: 'social', labelKey: 'category.social', enabled: true },
];

export const ACCESSIBILITY_TAGS: CatalogItem[] = [
  { id: 'wheelchair-access', labelKey: 'access.wheelchair', enabled: true },
  { id: 'elderly-friendly', labelKey: 'access.elderly', enabled: true },
  { id: 'hearing-support', labelKey: 'access.hearing', enabled: true },
  { id: 'visual-support', labelKey: 'access.visual', enabled: true },
  { id: 'low-intensity', labelKey: 'access.lowIntensity', enabled: true },
];

/**
 * Photo shown for an activity. The activities table has no image column yet
 * (the class diagram's Activity.imageUrls), so the photo comes from the
 * category. If the image fails to load, <ActivityImage> falls back to an icon
 * tile. Free-to-use Unsplash photos; replace with Supabase Storage URLs later.
 */
const unsplash = (photoId: string) =>
  `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=900&q=70`;

export const CATEGORY_IMAGES: Record<string, string> = {
  sports: unsplash('photo-1626224583764-f87db24ac4ea'),
  fitness: unsplash('photo-1544367567-0f2fcb009e0b'),
  'arts-crafts': unsplash('photo-1513364776144-60967b0f800f'),
  music: unsplash('photo-1511379938547-c1f69419868d'),
  cooking: unsplash('photo-1556910103-1c02745aae4d'),
  gardening: unsplash('photo-1416879595882-3373a0480b5b'),
  volunteering: unsplash('photo-1559027615-cd4628902d4a'),
  learning: unsplash('photo-1524178232363-1fb2b075b655'),
  technology: unsplash('photo-1517694712202-14dd9538aa97'),
  games: unsplash('photo-1610890716171-6b1bb98ffd09'),
  outdoors: unsplash('photo-1551632811-561732d1e306'),
  wellness: unsplash('photo-1506126613408-eca07ce68773'),
  social: unsplash('photo-1529156069898-49953e39b3ac'),
};

/** Ionicons name per category, for image fallbacks and compact lists. */
export const CATEGORY_ICONS: Record<string, string> = {
  sports: 'tennisball-outline',
  fitness: 'barbell-outline',
  'arts-crafts': 'color-palette-outline',
  music: 'musical-notes-outline',
  cooking: 'restaurant-outline',
  gardening: 'leaf-outline',
  volunteering: 'hand-left-outline',
  learning: 'school-outline',
  technology: 'laptop-outline',
  games: 'game-controller-outline',
  outdoors: 'trail-sign-outline',
  wellness: 'heart-outline',
  social: 'people-outline',
};

export const enabled = <T extends CatalogItem>(items: T[]) => items.filter((i) => i.enabled);

export const findLabelKey = (items: CatalogItem[], id: string | null | undefined) =>
  items.find((i) => i.id === id)?.labelKey;

export const findNeighbourhood = (id: string | null | undefined) =>
  NEIGHBOURHOODS.find((n) => n.id === id);
