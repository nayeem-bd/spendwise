import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Native: writes the file to the cache folder and opens the share sheet (save to Files, Drive, email…). */
export async function shareTextFile(name: string, content: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name, UTI: 'public.comma-separated-values-text' });
}
