// Base64 <-> bytes without relying on atob/btoa or Buffer (not on every runtime).

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(128);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let out = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)]!;
    const b = LOOKUP[clean.charCodeAt(i + 1)]!;
    const c = LOOKUP[clean.charCodeAt(i + 2)] ?? 0;
    const d = LOOKUP[clean.charCodeAt(i + 3)] ?? 0;
    bytes[out++] = (a << 2) | (b >> 4);
    if (i + 2 < clean.length) bytes[out++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < clean.length) bytes[out++] = ((c & 3) << 6) | d;
  }
  return bytes.subarray(0, out);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    s += ALPHABET[a >> 2];
    s += ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)];
    s += b === undefined ? '=' : ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)];
    s += c === undefined ? '=' : ALPHABET[c & 63];
  }
  return s;
}

/** Decoded size of base64 data in bytes. */
export const base64Size = (base64: string) => base64ToBytes(base64).length;
