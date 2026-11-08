import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';

import { colors, MIN_TOUCH, spacing } from '@/theme/tokens';

type Props = {
  uri: string;
  style?: StyleProp<ImageStyle>;
  label?: string;
};

export function ImageViewer({ uri, style, label = 'Open image' }: Props) {
  const [visible, setVisible] = useState(false);
  const { width, height } = Dimensions.get('window');

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setVisible(true)}
      >
        <Image source={{ uri }} style={style} accessibilityIgnoresInvertColors />
      </Pressable>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay} accessibilityViewIsModal>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close image"
            onPress={() => setVisible(false)}
            style={styles.close}
          >
            <Ionicons name="close" size={28} color={colors.onPrimary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close image"
            onPress={() => setVisible(false)}
            style={styles.imageArea}
          >
            <Image
              source={{ uri }}
              style={{ width: width - spacing.xl * 2, height: height - spacing.xl * 2 }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.lg,
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
