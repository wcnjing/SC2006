import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, CONTENT_MAX_WIDTH, spacing } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  /** Fixed header above the scroll area (ScreenHeader or AppHeader). */
  header?: ReactNode;
  /** Sticky footer, e.g. a primary "Post" / "Save changes" button. */
  footer?: ReactNode;
  /** Set false for screens that manage their own list (FlatList) or fill the screen (map). */
  scroll?: boolean;
  /** True for the 5 tab roots: the tab bar already handles the bottom inset. */
  inTabs?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Standard screen wrapper: safe areas, keyboard avoidance, scrolling, and a
 * centred max-width column on web and tablets.
 */
export function Screen({ children, header, footer, scroll = true, inTabs, contentStyle }: Props) {
  const edges: Edge[] =
    inTabs || footer ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom'];
  const content = <View style={[styles.column, styles.padded, contentStyle]}>{children}</View>;

  return (
    <SafeAreaView style={styles.root} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {header && <View style={styles.column}>{header}</View>}
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {content}
          </ScrollView>
        ) : (
          <View style={styles.flex}>{content}</View>
        )}
        {footer && (
          <SafeAreaView edges={['bottom']} style={styles.footer}>
            <View style={[styles.column, styles.footerInner]}>{footer}</View>
          </SafeAreaView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  padded: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  scrollContent: { flexGrow: 1 },
  footer: { borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
  footerInner: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
});
