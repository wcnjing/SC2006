// FR 1.2: sign the user out after 30 minutes without interaction.
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'ta', label: 'தமிழ்' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

// Used for onboarding chips, activity categories and recommendation matching.
export const INTERESTS = [
  'sports',
  'fitness',
  'arts-crafts',
  'music',
  'cooking',
  'gardening',
  'volunteering',
  'learning',
  'technology',
  'games',
  'outdoors',
  'wellness',
  'social',
] as const;

export type Interest = (typeof INTERESTS)[number];

export const ACCESSIBILITY_NEEDS = [
  'wheelchair-access',
  'elderly-friendly',
  'hearing-support',
  'visual-support',
  'low-intensity',
] as const;

export type AccessibilityNeed = (typeof ACCESSIBILITY_NEEDS)[number];

export const PASSWORD_MIN_LENGTH = 8;
