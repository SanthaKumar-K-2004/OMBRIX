import { beforeAll, describe, expect, it } from 'vitest';
import {
  deriveBiometricKey,
  deriveKeyFromImage,
  deriveKeyFromPassphrase,
  estimatePasskeyStrength,
  generateDicewarePassphrase,
  generateRandomPasskey32,
  initCrypto,
  normalizeFormattedKey,
} from '../src/index.js';

describe('Smart Passkey Generator & Derivation Engine', () => {
  beforeAll(async () => {
    await initCrypto();
  });

  describe('Diceware Passphrase Generation', () => {
    it('generates 4-word hyphenated Diceware passphrase by default', () => {
      const pass = generateDicewarePassphrase();
      const parts = pass.split('-');
      expect(parts.length).toBe(4);
      for (const p of parts) {
        expect(p.length).toBeGreaterThanOrEqual(3);
        expect(/^[a-z]+$/.test(p)).toBe(true);
      }
    });

    it('generates custom word count and separator', () => {
      const pass = generateDicewarePassphrase(5, ' ');
      const parts = pass.split(' ');
      expect(parts.length).toBe(5);
    });

    it('generates unique passphrases across successive calls', () => {
      const p1 = generateDicewarePassphrase();
      const p2 = generateDicewarePassphrase();
      expect(p1).not.toBe(p2);
    });
  });

  describe('Random 32-Byte (256-Bit) Passkeys', () => {
    it('generates formatted 32-byte key (16 blocks of 4 hex chars)', () => {
      const key = generateRandomPasskey32('formatted');
      expect(key).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){15}$/);
      expect(key.length).toBe(79); // 64 hex chars + 15 hyphens
    });

    it('generates 64-char hex passkey', () => {
      const hex = generateRandomPasskey32('hex');
      expect(hex).toMatch(/^[0-9a-f]{64}$/);
      expect(hex.length).toBe(64);
    });

    it('generates standard Base64 passkey', () => {
      const b64 = generateRandomPasskey32('base64');
      expect(b64.length).toBe(44);
    });

    it('normalizes formatted keys cleanly', () => {
      const formatted = 'A1B2-C3D4-E5F6-7890-1234-5678-9ABC-DEF0';
      const clean = normalizeFormattedKey(formatted);
      expect(clean).toBe('A1B2C3D4E5F67890123456789ABCDEF0');
    });
  });

  describe('Image / Photo Key Derivation', () => {
    it('derives consistent 32-byte key from image bytes', () => {
      const dummyPhoto = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x12, 0x34,
      ]);
      const key1 = deriveKeyFromImage(dummyPhoto);
      const key2 = deriveKeyFromImage(dummyPhoto);

      expect(key1).toBeInstanceOf(Uint8Array);
      expect(key1.length).toBe(32);
      expect(key1).toEqual(key2);
    });

    it('different images derive completely different 32-byte keys', () => {
      const photoA = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const photoB = new Uint8Array([0x01, 0x02, 0x03, 0x05]);
      const keyA = deriveKeyFromImage(photoA);
      const keyB = deriveKeyFromImage(photoB);

      expect(keyA).not.toEqual(keyB);
    });
  });

  describe('Passphrase & Biometric Derivation', () => {
    it('derives 32-byte master key from human passphrase', () => {
      const key = deriveKeyFromPassphrase('velvet-matrix-falcon-orbit');
      expect(key.length).toBe(32);
    });

    it('derives 32-byte key from WebAuthn credential ID', () => {
      const credId = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]);
      const key = deriveBiometricKey(credId);
      expect(key.length).toBe(32);
    });
  });

  describe('Passkey Entropy & Strength Rating', () => {
    it('evaluates Diceware passphrases as strong/unbreakable', () => {
      const strength = estimatePasskeyStrength('velvet-matrix-falcon-orbit');
      expect(strength.entropyBits).toBeGreaterThanOrEqual(36);
      expect(['Strong', 'Unbreakable']).toContain(strength.rating);
    });

    it('evaluates 32-byte formatted keys as 256-bit unbreakable', () => {
      const key32 = generateRandomPasskey32('formatted');
      const strength = estimatePasskeyStrength(key32);
      expect(strength.entropyBits).toBe(256);
      expect(strength.rating).toBe('Unbreakable');
    });

    it('evaluates 16-byte formatted keys as 128-bit unbreakable', () => {
      const strength = estimatePasskeyStrength('A1B2-C3D4-E5F6-7890-1234-5678-9ABC-DEF0');
      expect(strength.entropyBits).toBe(128);
      expect(strength.rating).toBe('Unbreakable');
    });

    it('evaluates short weak passwords properly', () => {
      const strength = estimatePasskeyStrength('12345');
      expect(strength.rating).toBe('Weak');
    });
  });
});
