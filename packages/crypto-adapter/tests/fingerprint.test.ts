import { beforeAll, describe, expect, it } from 'vitest';
import {
  InvalidKeyError,
  computeFingerprint,
  computeKeyId,
  fromBase64,
  fromHex,
  generateEncryptionKeyPair,
  initCrypto,
  parseAnyKey32,
  toBase64,
  toHex,
} from '../src/index.js';

describe('Fingerprints, Key IDs & Encodings', () => {
  beforeAll(async () => {
    await initCrypto();
  });

  it('computes 32-character formatted fingerprint (8 groups of 4)', () => {
    const pair = generateEncryptionKeyPair();
    const fingerprint = computeFingerprint(pair.publicKey);

    // Matches XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
    expect(fingerprint).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){7}$/);
    expect(fingerprint.length).toBe(39); // 32 hex chars + 7 hyphens
  });

  it('computes deterministic fingerprint for same key', () => {
    const key = new Uint8Array(32).fill(0x42);
    const fp1 = computeFingerprint(key);
    const fp2 = computeFingerprint(key);
    expect(fp1).toBe(fp2);
  });

  it('computes 8-byte recipient key ID', () => {
    const pair = generateEncryptionKeyPair();
    const keyId = computeKeyId(pair.publicKey);
    expect(keyId).toBeInstanceOf(Uint8Array);
    expect(keyId.length).toBe(8);
  });

  it('rejects invalid key lengths for fingerprinting', () => {
    expect(() => computeFingerprint(new Uint8Array(31))).toThrow(InvalidKeyError);
    expect(() => computeKeyId(new Uint8Array(33))).toThrow(InvalidKeyError);
  });

  it('correctly handles base64 and hex round trips', () => {
    const bytes = new Uint8Array([0x00, 0xff, 0x42, 0x13, 0x37]);
    const b64 = toBase64(bytes);
    expect(fromBase64(b64)).toEqual(bytes);

    const hex = toHex(bytes);
    expect(fromHex(hex)).toEqual(bytes);
  });

  it('correctly parses hyphenated hex, raw hex, and base64 via parseAnyKey32', () => {
    const pair = generateEncryptionKeyPair();
    const b64Key = toBase64(pair.publicKey);
    const hexKey = toHex(pair.publicKey);
    // Formatted hex with hyphens: A1B2-C3D4-...
    const formattedHex = hexKey
      .toUpperCase()
      .match(/.{1,4}/g)!
      .join('-');

    // All should parse to the exact same 32 bytes
    expect(parseAnyKey32(b64Key)).toEqual(pair.publicKey);
    expect(parseAnyKey32(hexKey)).toEqual(pair.publicKey);
    expect(parseAnyKey32(formattedHex)).toEqual(pair.publicKey);
  });
});
