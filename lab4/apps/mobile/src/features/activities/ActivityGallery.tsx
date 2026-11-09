import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, IconButton, ImageViewer } from '@/components/ui';
import { useT } from '@/context/SettingsContext';
import { colors, spacing } from '@/theme/tokens';
import type { Activity } from '@/types/models';

import { ActivityImage } from './ActivityImage';

export function ActivityGallery({ activity }: { activity: Activity }) {
  const t = useT();
  const { width } = useWindowDimensions();
  const imageWidth = Math.max(280, Math.min(width - spacing.xl * 2, 520));
  const images = activity.image_urls?.length ? activity.image_urls : [null];
  const [current, setCurrent] = useState(0);
  const scroll = useRef<ScrollView>(null);

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(images.length - 1, index));
    setCurrent(next);
    scroll.current?.scrollTo({ x: next * imageWidth, animated: true });
  };

  return (
    <View style={styles.container} accessibilityLabel={t('detail.activityImages')}>
      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        onMomentumScrollEnd={(event) => {
          setCurrent(Math.round(event.nativeEvent.contentOffset.x / imageWidth));
        }}
      >
        {images.map((uri, index) => (
          <View key={uri ?? `fallback-${index}`} style={{ width: imageWidth }}>
            {uri ? (
              <ImageViewer
                uri={uri}
                style={styles.image}
                label={t('detail.openImage')}
              />
            ) : (
              <ActivityImage category={activity.category} height={220} rounded={false} />
            )}
          </View>
        ))}
      </ScrollView>
      {images.length > 1 && (
        <>
          <View pointerEvents="box-none" style={styles.controls}>
            <IconButton
              icon="chevron-back"
              label={t('detail.previousImage')}
              color={colors.onPrimary}
              filled={colors.overlay}
              disabled={current === 0}
              onPress={() => goTo(current - 1)}
            />
            <IconButton
              icon="chevron-forward"
              label={t('detail.nextImage')}
              color={colors.onPrimary}
              filled={colors.overlay}
              disabled={current === images.length - 1}
              onPress={() => goTo(current + 1)}
            />
          </View>
          <View style={styles.dots} accessibilityLabel={t('detail.imagePosition', {
            current: current + 1,
            total: images.length,
          })}>
            {images.map((uri, index) => (
              <View
                key={uri ?? `dot-${index}`}
                style={[styles.dot, index === current && styles.activeDot]}
              />
            ))}
          </View>
        </>
      )}
      {images.length > 1 && (
        <AppText variant="caption" color={colors.textMuted} style={styles.hint}>
          {t('detail.imagePosition', { current: current + 1, total: images.length })}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  scroll: { gap: spacing.sm },
  image: { width: '100%', height: 220 },
  controls: {
    position: 'absolute',
    top: 86,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: -spacing.md,
  },
  dot: {
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: spacing.xs,
    backgroundColor: colors.borderStrong,
  },
  activeDot: { width: spacing.md, backgroundColor: colors.primary },
  hint: { textAlign: 'center' },
});
