import { en, type Translations } from './en';

/**
 * Supported languages (NFR Usability: Multilingual Support).
 *
 * Only English is complete. The other locales start with the tab bar and
 * common actions so the language switch is visible end to end; any missing
 * key falls back to English. The plan schedules full translation for
 * Week 10. Have a native speaker review these before the demo.
 */
export type LanguageCode = 'en' | 'zh' | 'ms' | 'ta';

const zh: Translations = {
  'tab.home': '首页',
  'tab.discover': '发现',
  'tab.map': '地图',
  'tab.community': '社区',
  'tab.profile': '我的',
  'common.next': '下一步',
  'common.save': '保存',
  'common.cancel': '取消',
  'login.submit': '登录',
  'login.signUp': '注册',
  'profile.logout': '登出',
  'settings.title': '设置',
  'settings.language': '语言',
};

const ms: Translations = {
  'tab.home': 'Utama',
  'tab.discover': 'Teroka',
  'tab.map': 'Peta',
  'tab.community': 'Komuniti',
  'tab.profile': 'Profil',
  'common.next': 'Seterusnya',
  'common.save': 'Simpan',
  'common.cancel': 'Batal',
  'login.submit': 'Log masuk',
  'login.signUp': 'Daftar',
  'profile.logout': 'Log keluar',
  'settings.title': 'Tetapan',
  'settings.language': 'Bahasa',
};

const ta: Translations = {
  'tab.home': 'முகப்பு',
  'tab.discover': 'கண்டறி',
  'tab.map': 'வரைபடம்',
  'tab.community': 'சமூகம்',
  'tab.profile': 'சுயவிவரம்',
  'common.next': 'அடுத்து',
  'common.save': 'சேமி',
  'common.cancel': 'ரத்து',
  'login.submit': 'உள்நுழை',
  'login.signUp': 'பதிவு செய்',
  'profile.logout': 'வெளியேறு',
  'settings.title': 'அமைப்புகள்',
  'settings.language': 'மொழி',
};

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
