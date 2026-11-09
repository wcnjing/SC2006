import { en, type Translations } from './en';
import { ms } from './ms';
import { ta } from './ta';
import { zh } from './zh';

/**
 * Supported languages (NFR Usability: Multilingual Support). Every screen is
 * translated; any missing key falls back to English. The Chinese, Malay and
 * Tamil drafts need a native speaker's review before release.
 */
export type LanguageCode = 'en' | 'zh' | 'ms' | 'ta';

export const LOCALES: Record<LanguageCode, Translations> = { en, zh, ms, ta };

export const LANGUAGES: {
  code: LanguageCode;
  labelKey: 'lang.en' | 'lang.zh' | 'lang.ms' | 'lang.ta';
}[] = [
  { code: 'en', labelKey: 'lang.en' },
  { code: 'zh', labelKey: 'lang.zh' },
  { code: 'ms', labelKey: 'lang.ms' },
  { code: 'ta', labelKey: 'lang.ta' },
];

export const isLanguageCode = (v: unknown): v is LanguageCode =>
  v === 'en' || v === 'zh' || v === 'ms' || v === 'ta';
