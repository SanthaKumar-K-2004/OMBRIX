import { beforeAll, describe, expect, it } from 'vitest';
import {
  constantTimeEqual,
  decryptWithPasskey,
  deriveBiometricKey,
  deriveKeyFromImage,
  deriveKeyFromPassphrase,
  encryptWithPasskey,
  estimatePasskeyStrength,
  generateDicewarePassphrase,
  generateRandomPasskey32,
  initCrypto,
  isPasskeyEncrypted,
  normalizeFormattedKey,
  wipeBuffers,
  zeroMemory,
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

  describe('Passkey Authenticated Encryption & Decryption', () => {
    const secretMessage = new TextEncoder().encode(
      'Confidential payload protected by 32-Byte Token',
    );

    it('encrypts and decrypts with formatted 32-Byte Token', () => {
      const token = generateRandomPasskey32('formatted');
      const encrypted = encryptWithPasskey(secretMessage, token);

      expect(isPasskeyEncrypted(encrypted)).toBe(true);
      expect(encrypted.length).toBeGreaterThan(secretMessage.length);

      const decrypted = decryptWithPasskey(encrypted, token);
      expect(new TextDecoder().decode(decrypted)).toBe(
        'Confidential payload protected by 32-Byte Token',
      );
    });

    it('encrypts and decrypts with Diceware memorable passphrase', () => {
      const phrase = 'velvet-matrix-falcon-orbit';
      const encrypted = encryptWithPasskey(secretMessage, phrase);

      const decrypted = decryptWithPasskey(encrypted, phrase);
      expect(new TextDecoder().decode(decrypted)).toBe(
        'Confidential payload protected by 32-Byte Token',
      );
    });

    it('encrypts and decrypts with arbitrary custom passphrase', () => {
      const customKey = 'alphaxheros';
      const encrypted = encryptWithPasskey(secretMessage, customKey);

      const decrypted = decryptWithPasskey(encrypted, customKey);
      expect(new TextDecoder().decode(decrypted)).toBe(
        'Confidential payload protected by 32-Byte Token',
      );
    });

    it('fails decryption with mismatched passkey or token', () => {
      const correctToken = generateRandomPasskey32('formatted');
      const wrongToken = generateRandomPasskey32('formatted');
      const encrypted = encryptWithPasskey(secretMessage, correctToken);

      expect(() => decryptWithPasskey(encrypted, wrongToken)).toThrow(
        /Decryption failed: incorrect passkey, token mismatch/,
      );
    });

    it('fails decryption on corrupt ciphertext or altered bytes', () => {
      const token = generateRandomPasskey32('formatted');
      const encrypted = encryptWithPasskey(secretMessage, token);
      encrypted[encrypted.length - 1] ^= 0xff; // Tamper with MAC tag

      expect(() => decryptWithPasskey(encrypted, token)).toThrow(
        /Decryption failed: incorrect passkey, token mismatch/,
      );
    });

    it('guarantees V1 and V2 container interoperability and backward compatibility', () => {
      const passphrase = 'quantum-falcon-cipher-node';
      const encV1 = encryptWithPasskey(secretMessage, passphrase, 1);
      const encV2 = encryptWithPasskey(secretMessage, passphrase, 2);

      expect(encV1[7]).toBe(0x01);
      expect(encV2[7]).toBe(0x02);
      expect(isPasskeyEncrypted(encV1)).toBe(true);
      expect(isPasskeyEncrypted(encV2)).toBe(true);

      const decV1 = decryptWithPasskey(encV1, passphrase);
      const decV2 = decryptWithPasskey(encV2, passphrase);

      expect(decV1).toEqual(secretMessage);
      expect(decV2).toEqual(secretMessage);
    });

    it('guarantees unique salts across successive V2 encryptions (anti-rainbow-table)', () => {
      const phrase = 'static-shared-passphrase';
      const enc1 = encryptWithPasskey(secretMessage, phrase);
      const enc2 = encryptWithPasskey(secretMessage, phrase);

      // Extract 16-byte salts
      const salt1 = enc1.subarray(8, 24);
      const salt2 = enc2.subarray(8, 24);
      expect(salt1).not.toEqual(salt2);
      expect(enc1).not.toEqual(enc2);
    });

    it('safely zeroizes memory buffers and performs constant-time comparison', () => {
      const keyBuffer = new Uint8Array([1, 2, 3, 4, 5]);
      zeroMemory(keyBuffer);
      expect(keyBuffer).toEqual(new Uint8Array(5));

      const bufA = new Uint8Array([10, 20, 30]);
      const bufB = new Uint8Array([10, 20, 30]);
      const bufC = new Uint8Array([10, 20, 31]);
      const bufD = new Uint8Array([10, 20]);

      expect(constantTimeEqual(bufA, bufB)).toBe(true);
      expect(constantTimeEqual(bufA, bufC)).toBe(false);
      expect(constantTimeEqual(bufA, bufD)).toBe(false);

      wipeBuffers(bufA, bufB, null, undefined);
      expect(bufA).toEqual(new Uint8Array(3));
      expect(bufB).toEqual(new Uint8Array(3));
    });
  });
});
