import { beforeAll, describe, expect, it } from 'vitest';
import {
  InvalidSignatureError,
  buildSignDoc,
  generateSigningKeyPair,
  initCrypto,
  signDetached,
  verifyDetached,
  verifyDetachedOrThrow,
} from '../src/index.js';

describe('Ed25519 Detached Signatures & Canonical SignDoc', () => {
  beforeAll(async () => {
    await initCrypto();
  });

  it('generates valid Ed25519 keypairs (32-byte public, 64-byte private)', () => {
    const pair = generateSigningKeyPair();
    expect(pair.publicKey.length).toBe(32);
    expect(pair.privateKey.length).toBe(64);
  });

  it('signs and verifies a message successfully', () => {
    const signer = generateSigningKeyPair();
    const message = new TextEncoder().encode('Authentic payload from Alice.');

    const signature = signDetached(message, signer.privateKey);
    expect(signature.length).toBe(64);

    const isValid = verifyDetached(message, signature, signer.publicKey);
    expect(isValid).toBe(true);
    expect(() => verifyDetachedOrThrow(message, signature, signer.publicKey)).not.toThrow();
  });

  it('fails verification if message is modified', () => {
    const signer = generateSigningKeyPair();
    const message = new TextEncoder().encode('Authentic payload from Alice.');
    const altered = new TextEncoder().encode('Altered payload from Mallory.');

    const signature = signDetached(message, signer.privateKey);
    expect(verifyDetached(altered, signature, signer.publicKey)).toBe(false);
    expect(() => verifyDetachedOrThrow(altered, signature, signer.publicKey)).toThrow(
      InvalidSignatureError,
    );
  });

  it('fails verification with wrong signer public key', () => {
    const alice = generateSigningKeyPair();
    const bob = generateSigningKeyPair();
    const message = new TextEncoder().encode('Signed by Alice.');

    const signature = signDetached(message, alice.privateKey);
    expect(verifyDetached(message, signature, bob.publicKey)).toBe(false);
  });

  it('canonical SignDoc prevents metadata-malleability attacks', () => {
    const signer = generateSigningKeyPair();
    const magic = new Uint8Array([0x4f, 0x4d, 0x42, 0x31]); // "OMB1"
    const recipientKeyId = new Uint8Array(8).fill(0xaa);
    const messageId = new Uint8Array(16).fill(0x55);
    const ciphertext = new TextEncoder().encode('Encrypted ciphertext bytes');

    // Build canonical doc with flags = 0x0001 (has_signature)
    const signDoc = buildSignDoc({
      magic,
      version: 1,
      cipherSuite: 1,
      flags: 0x0001,
      recipientKeyId,
      messageId,
      ciphertext,
    });

    const signature = signDetached(signDoc, signer.privateKey);
    expect(verifyDetached(signDoc, signature, signer.publicKey)).toBe(true);

    // Attacker tampers with header flags: flips compression flag to 0x0003
    const tamperedDoc = buildSignDoc({
      magic,
      version: 1,
      cipherSuite: 1,
      flags: 0x0003, // Tampered flag
      recipientKeyId,
      messageId,
      ciphertext,
    });

    expect(verifyDetached(tamperedDoc, signature, signer.publicKey)).toBe(false);
  });
});
