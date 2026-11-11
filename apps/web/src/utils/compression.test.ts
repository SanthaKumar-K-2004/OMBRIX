import { describe, expect, it } from 'vitest';
import {
  compressBytes,
  decompressBytes,
  isCompressedPayload,
  smartCompress,
  smartDecompress,
} from './compression.js';

describe('Lossless Compression Engine', () => {
  it('correctly compresses and decompresses large repeating text streams', async () => {
    const originalText = 'Top secret OMBRIX intelligence payload. '.repeat(500); // ~20,000 bytes
    const originalBytes = new TextEncoder().encode(originalText);

    const compressed = await compressBytes(originalBytes);
    expect(compressed.length).toBeLessThan(originalBytes.length / 5); // > 80% compression

    const decompressed = await decompressBytes(compressed);
    expect(new TextDecoder().decode(decompressed)).toBe(originalText);
  }, 15000);

  it('smartCompress applies compression and magic header when payload shrinks', async () => {
    const text = 'Confidential message with high redundancy '.repeat(100);
    const raw = new TextEncoder().encode(text);

    const { data, compressed, savedBytes } = await smartCompress(raw);
    expect(compressed).toBe(true);
    expect(savedBytes).toBeGreaterThan(0);
    expect(isCompressedPayload(data)).toBe(true);

    const restored = await smartDecompress(data);
    expect(new TextDecoder().decode(restored)).toBe(text);
  }, 15000);

  it('smartCompress skips compression if data does not shrink', async () => {
    // High-entropy random data cannot be compressed by Deflate
    const randomBytes = new Uint8Array(64);
    for (let i = 0; i < 64; i++) randomBytes[i] = Math.floor(Math.random() * 256);

    const { data, compressed, savedBytes } = await smartCompress(randomBytes);
    expect(compressed).toBe(false);
    expect(savedBytes).toBe(0);
    expect(isCompressedPayload(data)).toBe(false);

    const restored = await smartDecompress(data);
    expect(restored).toEqual(randomBytes);
  }, 15000);

  it('smartDecompress leaves uncompressed data untouched', async () => {
    const plain = new TextEncoder().encode('Ordinary plain text without magic');
    const out = await smartDecompress(plain);
    expect(new TextDecoder().decode(out)).toBe('Ordinary plain text without magic');
  });
});
