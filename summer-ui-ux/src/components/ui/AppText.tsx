import { Text, type TextProps } from 'react-native';

import { useSettings } from '@/context/SettingsContext';
import { colors, typography, type TypeVariant } from '@/theme/tokens';

export type AppTextProps = TextProps & {
  variant?: TypeVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** Marks the text as a heading for screen readers (WCAG 1.3.1 / 2.4.6). */
  heading?: boolean;
};

/**
 * All text in the app goes through this, so the in-app text size setting
 * applies everywhere. OS font scaling is left on (allowFontScaling default).
 */
export function AppText({
  variant = 'body',
  color = colors.text,
  align,
  heading,
  style,
  ...rest
}: AppTextProps) {
  const { textScale } = useSettings();
  return (
    <Text
      accessibilityRole={heading ? 'header' : undefined}
      maxFontSizeMultiplier={2}
      style={[typography(variant, textScale), { color, textAlign: align }, style]}
      {...rest}
    />
  );
}
