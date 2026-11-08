import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppText, Button } from '@/components/ui';
import { useT } from '@/context/SettingsContext';
import { colors, radii, spacing } from '@/theme/tokens';
import type { ActivityImageFile } from '@/services/supabase/uploads';

const CELL_WIDTH = 96;

type Props = {
  images: ActivityImageFile[];
  onChange: (images: ActivityImageFile[]) => void;
};

export function ActivityImagePicker({ images, onChange }: Props) {
  const t = useT();
  const chooseImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      onChange([...images, ...result.assets.map((asset) => ({ uri: asset.uri }))]);
    }
  };

  const remove = (index: number) => onChange(images.filter((_, itemIndex) => itemIndex !== index));

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View style={styles.headingText}>
          <AppText variant="label">{t('organiser.imagesLabel')}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {t('organiser.imagesHint')}
          </AppText>
        </View>
        <Button
          label={t('organiser.addImages')}
          icon="images-outline"
          variant="outline"
          size="sm"
          fullWidth={false}
          onPress={chooseImages}
        />
      </View>
      {images.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
          {images.map((image, index) => {
            const translateX = new Animated.Value(0);
            const responder = PanResponder.create({
              onStartShouldSetPanResponder: () => true,
              onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 5,
              onPanResponderMove: (_, gesture) => translateX.setValue(gesture.dx),
              onPanResponderRelease: (_, gesture) => {
                translateX.setValue(0);
                const target = Math.round((index * CELL_WIDTH + gesture.dx) / CELL_WIDTH);
                move(index, Math.max(0, Math.min(images.length - 1, target)));
              },
              onPanResponderTerminate: () => {
                translateX.setValue(0);
              },
            });
            return (
              <Animated.View
                key={`${image.path ?? image.uri}-${index}`}
                style={[styles.item, { transform: [{ translateX }] }]}
                {...responder.panHandlers}
              >
                <Image source={{ uri: image.uri }} style={styles.image} />
                <View style={styles.order}>
                  <AppText variant="caption" color={colors.onPrimary}>
                    {index + 1}
                  </AppText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('organiser.removeImage')}
                  hitSlop={8}
                  style={styles.remove}
                  onPress={() => remove(index)}
                >
                  <Ionicons name="close" size={16} color={colors.onPrimary} />
                </Pressable>
                <View style={styles.reorder}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('organiser.moveImageLeft')}
                    disabled={index === 0}
                    hitSlop={6}
                    onPress={() => move(index, index - 1)}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={16}
                      color={index === 0 ? colors.textSubtle : colors.onPrimary}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('organiser.moveImageRight')}
                    disabled={index === images.length - 1}
                    hitSlop={6}
                    onPress={() => move(index, index + 1)}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={index === images.length - 1 ? colors.textSubtle : colors.onPrimary}
                    />
                  </Pressable>
                </View>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  headingText: { flex: 1, gap: spacing.xs },
  list: { gap: spacing.sm, paddingVertical: spacing.xs },
  item: { width: CELL_WIDTH, height: CELL_WIDTH, borderRadius: radii.md, overflow: 'hidden' },
  image: { width: '100%', height: '100%', backgroundColor: colors.surfaceMuted },
  order: {
    position: 'absolute',
    left: spacing.xs,
    bottom: spacing.xs,
    minWidth: 22,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.overlay,
  },
  remove: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.overlay,
  },
  reorder: {
    position: 'absolute',
    right: spacing.xs,
    bottom: spacing.xs,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.overlay,
  },
});
