/// <reference types="node" />
import { base64Size, base64ToBytes, bytesToBase64 } from './base64';

describe('base64', () => {
  it.each(['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar'])('round-trips %p and matches Node', (text) => {
    const bytes = new TextEncoder().encode(text);
    const encoded = bytesToBase64(bytes);
    expect(encoded).toBe(Buffer.from(text).toString('base64'));
    expect([...base64ToBytes(encoded)]).toEqual([...bytes]);
  });

  it('round-trips random binary data', () => {
    const bytes = Uint8Array.from({ length: 1000 }, (_, i) => (i * 37 + 11) % 256);
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes]);
    expect(base64Size(bytesToBase64(bytes))).toBe(1000);
  });
});
