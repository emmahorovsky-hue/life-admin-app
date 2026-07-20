import { useCallback, useRef, useState } from 'react';
import { Image, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getInitials, radius, spacing } from '@life-admin/shared';
import { useAuth } from '../../contexts/AuthContext';
import { avatarAssetError, deleteAvatar, uploadAvatar, useAvatarSource } from '../../lib/account';
import { getApiErrorMessage } from '../../lib/utils';
import { AppText, useToast } from '../ui';
import { colors, fonts } from '../../lib/theme';

// Pixel twins of the web tile's md/lg variants (client AvatarTile.tsx).
const sizes = {
  md: { tile: 60, text: 24, badge: 22, badgeIcon: 12 },
  lg: { tile: 72, text: 28, badge: 26, badgeIcon: 14 },
} as const;

interface AvatarTileProps {
  /** md for the settings index identity row, lg for the account screen. */
  size?: keyof typeof sizes;
  style?: StyleProp<ViewStyle>;
}

/**
 * Ink initials tile with the orange photo badge — mobile port of the web
 * AvatarTile (LIF-187/LIF-192, ported in LIF-202). With no photo the badge is
 * a camera that opens the image picker directly. Once the user has their own
 * photo the badge becomes a pencil that opens a small bottom-sheet menu
 * (Upload new photo / Remove photo). Uploads and removals go through the
 * account avatar endpoints and refresh the auth user.
 *
 * The picker uses allowsEditing + quality so the square crop re-encodes the
 * selection (JPEG on iOS), which keeps raw HEIC originals out of the upload.
 */
export function AvatarTile({ size = 'lg', style }: AvatarTileProps) {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [busy, setBusy] = useState(false);
  const [imgError, setImgError] = useState(false);
  const s = sizes[size];

  const version = user?.avatarUpdatedAt ?? null;
  const showImage = Boolean(version) && !imgError;
  const source = useAvatarSource(version);

  const pickAndUpload = useCallback(async () => {
    sheetRef.current?.dismiss();
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
    } catch {
      toast.error('Could not open the photo library.');
      return;
    }
    if (result.canceled) return;

    const asset = result.assets[0];
    const validationError = avatarAssetError(asset);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setBusy(true);
    try {
      const res = await uploadAvatar(asset);
      setImgError(false);
      updateUser(res.data.user);
      toast.success('Photo updated.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to upload photo. Please try again.'));
    } finally {
      setBusy(false);
    }
  }, [toast, updateUser]);

  const handleRemove = useCallback(async () => {
    sheetRef.current?.dismiss();
    setBusy(true);
    try {
      const res = await deleteAvatar();
      setImgError(false);
      updateUser(res.data.user);
      toast.success('Photo removed.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to remove photo. Please try again.'));
    } finally {
      setBusy(false);
    }
  }, [toast, updateUser]);

  const handleBadgePress = () => {
    // Pristine tile → straight to the picker; own photo → the edit menu.
    if (showImage) sheetRef.current?.present();
    else void pickAndUpload();
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    [],
  );

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.tile, { width: s.tile, height: s.tile }]}>
        {showImage && source ? (
          <Image
            key={version}
            source={source}
            style={styles.image}
            resizeMode="cover"
            accessibilityLabel="Your profile photo"
            onError={() => setImgError(true)}
          />
        ) : (
          <Text style={[styles.initials, { fontSize: s.text }]}>{getInitials(user)}</Text>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={showImage ? 'Edit photo' : 'Add photo'}
        disabled={busy}
        onPress={handleBadgePress}
        hitSlop={8}
        style={[styles.badge, { width: s.badge, height: s.badge }, busy && styles.badgeBusy]}
      >
        <Ionicons
          name={showImage ? 'pencil' : 'camera'}
          size={s.badgeIcon}
          color={colors.background}
        />
      </Pressable>

      <BottomSheetModal
        ref={sheetRef}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView
          accessibilityLabel="Photo options"
          style={[styles.sheetContent, { paddingBottom: insets.bottom + spacing.lg }]}
        >
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void pickAndUpload()}
            style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
          >
            <Ionicons name="cloud-upload-outline" size={20} color={colors.mutedForeground} />
            <AppText variant="headline" weight={600} style={styles.menuLabel}>Upload new photo</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void handleRemove()}
            style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
          >
            <Ionicons name="trash-outline" size={20} color={colors.destructive} />
            <AppText variant="headline" weight={600} style={[styles.menuLabel, styles.menuLabelDestructive]}>Remove photo</AppText>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', flexShrink: 0 },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.base,
    backgroundColor: colors.foreground,
  },
  image: { width: '100%', height: '100%' },
  initials: { fontFamily: fonts.sans.extrabold, color: colors.background },

  badge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.base,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.brandOrange,
  },
  badgeBusy: { opacity: 0.6 },

  sheetBackground: { backgroundColor: colors.card, borderRadius: radius.base },
  sheetContent: { paddingTop: spacing.sm, paddingHorizontal: spacing.sm },
  menuRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.base,
  },
  menuRowPressed: { backgroundColor: colors.secondary },
  menuLabel: { color: colors.foreground },
  menuLabelDestructive: { color: colors.destructive },
});
