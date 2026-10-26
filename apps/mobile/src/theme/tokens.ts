/**
 * CommunityLink design tokens.
 *
 * Single source of truth for colour, spacing, radius and type. Screens should
 * never hard-code hex values or font sizes; import from here (or use the UI
 * kit in src/components/ui, which already does).
 *
 * Colour pairs below were checked against WCAG 2.1 AA (4.5:1 for body text,
 * 3:1 for large text / UI boundaries). The mockup red (#F04438) only reaches
 * ~3.6:1 with white text, so `primary` is a slightly deeper red that passes.
 */

export const colors = {
  // Brand
  primary: '#D92D20', // white text on this = 4.8:1
  primaryPressed: '#B42318',
  primarySoft: '#FEE4E2', // selected-chip / highlight background
  onPrimary: '#FFFFFF',

  // Neutrals
  text: '#101828', // 17.6:1 on white
  textMuted: '#475467', // 7.6:1 on white
  textSubtle: '#667085', // 4.8:1 on white (placeholders, captions)
  border: '#D0D5DD',
  borderStrong: '#98A2B3',
  divider: '#EAECF0',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F4F7', // grey cards / inputs-on-grey
  background: '#FFFFFF',

  // Feedback
  error: '#B42318',
  errorSoft: '#FEF3F2',
  warning: '#93370D', // text on warningSoft
  warningSoft: '#FEF0C7',
  success: '#067647',
  successSoft: '#DCFAE6',
  info: '#1849A9',
  infoSoft: '#EFF8FF',

  // Recommendation "why" strip (lavender in mockup)
  insight: '#3E1C96',
  insightSoft: '#EBE9FE',

  // Activity tag palette (bg / fg) — used by <Tag tone="...">
  tagNature: { bg: '#DCFAE6', fg: '#085D3A' },
  tagSports: { bg: '#D1E9FF', fg: '#1849A9' },
  tagArts: { bg: '#FDEAD7', fg: '#932F19' },
  tagAccess: { bg: '#E0F2FE', fg: '#065986' },
  tagNeutral: { bg: '#F2F4F7', fg: '#344054' },

  singpass: '#F4333D',
  overlay: 'rgba(16, 24, 40, 0.5)',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/** WCAG 2.5.5 target size: interactive elements are at least this tall/wide. */
export const MIN_TOUCH = 48;

/** Max readable content width when running on web / tablets. */
export const CONTENT_MAX_WIDTH = 560;

type TypeStyle = {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700' | '800';
};

const baseType = {
  display: { fontSize: 30, lineHeight: 38, fontWeight: '800' },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  h2: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  h3: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  button: { fontSize: 16, lineHeight: 20, fontWeight: '700' },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof baseType;

/**
 * Typography scaled by the user's in-app text size setting (on top of the OS
 * font scale, which React Native applies automatically).
 */
export function typography(variant: TypeVariant, scale = 1): TypeStyle {
  const t = baseType[variant];
  return {
    fontSize: Math.round(t.fontSize * scale),
    lineHeight: Math.round(t.lineHeight * scale),
    fontWeight: t.fontWeight,
  };
}

export const shadow = {
  card: {
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
} as const;
