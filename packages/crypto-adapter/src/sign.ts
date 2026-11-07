import { InvalidKeyError, InvalidSignatureError } from './errors.js';
import { getSodium } from './sodium.js';
import type { SigningKeyPair } from './types.js';

export function generateSigningKeyPair(): SigningKeyPair {
  const sodium = getSodium();
  const pair = sodium.crypto_sign_keypair();
  return {
    publicKey: pair.publicKey,
    privateKey: pair.privateKey,
  };
}

export function signDetached(message: Uint8Array, privateKey: Uint8Array): Uint8Array {
  if (privateKey.length !== 64) {
    throw new InvalidKeyError(
      `Expected 64-byte Ed25519 private key, received ${privateKey.length} bytes.`,
    );
  }
  const sodium = getSodium();
  return sodium.crypto_sign_detached(message, privateKey);
}

export function verifyDetached(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  if (publicKey.length !== 32) {
    throw new InvalidKeyError(
      `Expected 32-byte Ed25519 public key, received ${publicKey.length} bytes.`,
    );
  }
  if (signature.length !== 64) {
    return false;
  }
  const sodium = getSodium();
  return sodium.crypto_sign_verify_detached(signature, message, publicKey);
}

export function verifyDetachedOrThrow(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): void {
  const valid = verifyDetached(message, signature, publicKey);
  if (!valid) {
    throw new InvalidSignatureError('Ed25519 detached signature verification failed.');
  }
}

/**
 * Builds the canonical SignDoc according to docs/protocol-v1.md to prevent metadata-malleability:
 * "OMBRIX-V1-SIG:" || magic(4) || version(1) || cipher_suite(1) || flags(2) || recipient_key_id(8) || message_id(16) || ciphertext
 */
export function buildSignDoc(params: {
  magic: Uint8Array; // 4 bytes
  version: number; // 1 byte
  cipherSuite: number; // 1 byte
  flags: number; // 2 bytes
  recipientKeyId: Uint8Array; // 8 bytes
  messageId: Uint8Array; // 16 bytes
  ciphertext: Uint8Array;
}): Uint8Array {
  const prefix = new TextEncoder().encode('OMBRIX-V1-SIG:');
  const totalLength = prefix.length + 4 + 1 + 1 + 2 + 8 + 16 + params.ciphertext.length;
  const doc = new Uint8Array(totalLength);
  const view = new DataView(doc.buffer, doc.byteOffset, doc.byteLength);

  let offset = 0;
  doc.set(prefix, offset);
  offset += prefix.length;

  doc.set(params.magic, offset);
  offset += 4;

  doc[offset] = params.version;
  offset += 1;

  doc[offset] = params.cipherSuite;
  offset += 1;

  view.setUint16(offset, params.flags, false); // Big-Endian
  offset += 2;

  doc.set(params.recipientKeyId, offset);
  offset += 8;

  doc.set(params.messageId, offset);
  offset += 16;

  doc.set(params.ciphertext, offset);
  return doc;
}
