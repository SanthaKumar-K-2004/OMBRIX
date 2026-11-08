import { beforeAll, describe, expect, it } from 'vitest';
import {
  DecryptionFailedError,
  InvalidKeyError,
  generateEncryptionKeyPair,
  initCrypto,
  openSeal,
  seal,
} from '../src/index.js';

describe('X25519 Sealed Box Encryption & Decryption', () => {
  beforeAll(async () => {
    await initCrypto();
  });

  it('generates valid 32-byte Curve25519 keypairs', () => {
    const pair = generateEncryptionKeyPair();
    expect(pair.publicKey).toBeInstanceOf(Uint8Array);
    expect(pair.privateKey).toBeInstanceOf(Uint8Array);
    expect(pair.publicKey.length).toBe(32);
    expect(pair.privateKey.length).toBe(32);
  });

  it('derives public key from private key correctly using scalarmult_base', async () => {
    const { deriveEncryptionPublicKey } = await import('../src/index.js');
    const pair = generateEncryptionKeyPair();
    const derivedPub = deriveEncryptionPublicKey(pair.privateKey);
    expect(derivedPub).toEqual(pair.publicKey);
  });

  it('successfully seals and decrypts plaintext for designated recipient', () => {
    const recipient = generateEncryptionKeyPair();
    const plaintext = new TextEncoder().encode('Confidential steganographic message for Bob.');

    const ciphertext = seal(plaintext, recipient.publicKey);
    expect(ciphertext.length).toBeGreaterThan(plaintext.length);

    const decrypted = openSeal(ciphertext, recipient.publicKey, recipient.privateKey);
    expect(new TextDecoder().decode(decrypted)).toBe(
      'Confidential steganographic message for Bob.',
    );
  });

  it('fails decryption with wrong recipient private key (zero plaintext leak)', () => {
    const alice = generateEncryptionKeyPair();
    const eve = generateEncryptionKeyPair();
    const plaintext = new TextEncoder().encode('Eyes only: Top secret.');

    const ciphertext = seal(plaintext, alice.publicKey);

    expect(() => {
      openSeal(ciphertext, alice.publicKey, eve.privateKey);
    }).toThrow(DecryptionFailedError);
  });

  it('fails decryption when ciphertext is tampered (Poly1305 MAC failure)', () => {
    const recipient = generateEncryptionKeyPair();
    const plaintext = new TextEncoder().encode('Integrity verified payload.');
    const ciphertext = seal(plaintext, recipient.publicKey);

    // Tamper with one byte in the ciphertext
    const tampered = new Uint8Array(ciphertext);
    tampered[tampered.length - 1] ^= 0x01;

    expect(() => {
      openSeal(tampered, recipient.publicKey, recipient.privateKey);
    }).toThrow(DecryptionFailedError);
  });

  it('rejects invalid key lengths', () => {
    const shortKey = new Uint8Array(16);
    const plaintext = new TextEncoder().encode('Test');

    expect(() => {
      seal(plaintext, shortKey);
    }).toThrow(InvalidKeyError);

    const validPair = generateEncryptionKeyPair();
    const ciphertext = seal(plaintext, validPair.publicKey);

    expect(() => {
      openSeal(ciphertext, shortKey, validPair.privateKey);
    }).toThrow(InvalidKeyError);

    expect(() => {
      openSeal(ciphertext, validPair.publicKey, shortKey);
    }).toThrow(InvalidKeyError);
  });
});
