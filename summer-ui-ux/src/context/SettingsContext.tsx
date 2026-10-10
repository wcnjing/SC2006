import { getLocales } from 'expo-localization';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo } from 'react-native';

import { en, type TranslationKey } from '@/i18n/en';
import { LOCALES, isLanguageCode, type LanguageCode } from '@/i18n/locales';
import { readJSON, writeJSON } from '@/lib/storage';

export type TextSize = 'default' | 'large' | 'xlarge';

export const TEXT_SCALE: Record<TextSize, number> = {
  default: 1,
  large: 1.15,
  xlarge: 1.3,
};

type Settings = {
  language: LanguageCode;
  textSize: TextSize;
  reduceMotion: boolean;
};

type SettingsValue = Settings & {
  ready: boolean;
  /** Multiplier applied by <AppText> and the UI kit on top of the OS font scale. */
  textScale: number;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  setLanguage: (l: LanguageCode) => void;
  setTextSize: (s: TextSize) => void;
  setReduceMotion: (v: boolean) => void;
};

const STORAGE_KEY = 'settings';

function deviceLanguage(): LanguageCode {
  const code = getLocales()[0]?.languageCode;
  return isLanguageCode(code) ? code : 'en';
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>({
    language: deviceLanguage(),
    textSize: 'default',
    reduceMotion: false,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [saved, osReduceMotion] = await Promise.all([
        readJSON<Partial<Settings>>(STORAGE_KEY),
        AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
      ]);
      setSettings((s) => ({
        ...s,
        reduceMotion: osReduceMotion,
        ...saved,
        language: isLanguageCode(saved?.language) ? saved.language : s.language,
      }));
      setReady(true);
    })();
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      writeJSON(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const t = useCallback<SettingsValue['t']>(
    (key, vars) => {
      let str: string = LOCALES[settings.language][key] ?? en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, String(v));
      }
      return str;
    },
    [settings.language],
  );

  const value = useMemo<SettingsValue>(
    () => ({
      ...settings,
      ready,
      textScale: TEXT_SCALE[settings.textSize],
      t,
      setLanguage: (language) => update({ language }),
      setTextSize: (textSize) => update({ textSize }),
      setReduceMotion: (reduceMotion) => update({ reduceMotion }),
    }),
    [settings, ready, t, update],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}

/** Shorthand for components that only need translations. */
export function useT() {
  return useSettings().t;
}
