import { describe, expect, it } from 'vitest';
import { packFilePayload, unpackFilePayload } from './filePayload.js';

describe('filePayload utility', () => {
  it('correctly packs and unpacks a secret image payload with metadata', () => {
    // Fake 100 bytes of PNG data
    const fakeImageBytes = new Uint8Array([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      ...new Array(92).fill(0x42),
    ]);
    const meta = {
      name: 'confidential-blueprint.png',
      mime: 'image/png',
      size: fakeImageBytes.length,
      width: 64,
      height: 64,
    };

    const packed = packFilePayload(fakeImageBytes, meta);
    expect(packed.length).toBeGreaterThan(fakeImageBytes.length + 12);

    const unpacked = unpackFilePayload(packed);
    expect(unpacked).not.toBeNull();
    expect(unpacked?.name).toBe('confidential-blueprint.png');
    expect(unpacked?.mime).toBe('image/png');
    expect(unpacked?.size).toBe(fakeImageBytes.length);
    expect(unpacked?.width).toBe(64);
    expect(unpacked?.height).toBe(64);
    expect(unpacked?.isImage).toBe(true);
    expect(unpacked?.data).toEqual(fakeImageBytes);
  });

  it('correctly auto-detects raw PNG bytes without OMBFIL01 envelope', () => {
    const rawPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const unpacked = unpackFilePayload(rawPng);
    expect(unpacked).not.toBeNull();
    expect(unpacked?.mime).toBe('image/png');
    expect(unpacked?.isImage).toBe(true);
  });

  it('correctly auto-detects raw JPEG bytes', () => {
    const rawJpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const unpacked = unpackFilePayload(rawJpg);
    expect(unpacked).not.toBeNull();
    expect(unpacked?.mime).toBe('image/jpeg');
    expect(unpacked?.isImage).toBe(true);
  });

  it('returns null for standard plaintext utf8 string', () => {
    const plainText = new TextEncoder().encode('Hello secret world!');
    const unpacked = unpackFilePayload(plainText);
    expect(unpacked).toBeNull();
  });
});
