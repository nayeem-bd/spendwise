import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { MAX_ATTACHMENT_BYTES } from '@/lib/db/repositories/attachments';
import { base64Size } from '@/utils/base64';

// Picks or takes a photo and shrinks it to a small JPEG (receipts stay
// readable at ~1280 px). Retries smaller if it's still too big.

const ATTEMPTS = [
  { width: 1280, compress: 0.6 },
  { width: 1000, compress: 0.45 },
  { width: 800, compress: 0.35 },
];

export class PermissionError extends Error {}

async function shrink(uri: string, originalWidth: number): Promise<string> {
  for (const { width, compress } of ATTEMPTS) {
    const context = ImageManipulator.manipulate(uri);
    if (originalWidth === 0 || originalWidth > width) context.resize({ width });
    const image = await context.renderAsync();
    const result = await image.saveAsync({ compress, format: SaveFormat.JPEG, base64: true });
    if (result.base64 && base64Size(result.base64) <= MAX_ATTACHMENT_BYTES) return result.base64;
  }
  throw new Error('That photo is too large');
}

/** Returns base64 JPEG, or null if the user cancelled. */
export async function pickReceipt(source: 'camera' | 'library'): Promise<string | null> {
  if (source === 'camera') {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) throw new PermissionError('Allow camera access for SpendWise in your phone settings to take receipt photos.');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: Platform.OS !== 'web' };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return shrink(asset.uri, asset.width);
}
