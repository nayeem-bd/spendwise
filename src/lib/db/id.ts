import { randomUUID } from 'expo-crypto';

/** New row id. Generated on the device so offline rows never clash. */
export const newId = (): string => randomUUID();
