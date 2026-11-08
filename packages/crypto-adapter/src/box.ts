import { DecryptionFailedError, InvalidKeyError } from './errors.js';
import { getSodium } from './sodium.js';
import type { EncryptionKeyPair } from './types.js';

export function generateEncryptionKeyPair(): EncryptionKeyPair {
  const sodium = getSodium();
  const pair = sodium.crypto_box_keypair();
  return {
    publicKey: pair.publicKey,
    privateKey: pair.privateKey,
  };
}

export function deriveEncryptionPublicKey(privateKey: Uint8Array): Uint8Array {
  if (privateKey.length !== 32) {
    throw new InvalidKeyError(
      `Expected 32-byte recipient private key, received ${privateKey.length} bytes.`,
    );
  }
  const sodium = getSodium();
  return sodium.crypto_scalarmult_base(privateKey);
}

export function seal(plaintext: Uint8Array, recipientPublicKey: Uint8Array): Uint8Array {
  if (recipientPublicKey.length !== 32) {
    throw new InvalidKeyError(
      `Expected 32-byte recipient public key, received ${recipientPublicKey.length} bytes.`,
    );
  }
  const sodium = getSodium();
  return sodium.crypto_box_seal(plaintext, recipientPublicKey);
}

export function openSeal(
  ciphertext: Uint8Array,
  recipientPublicKey: Uint8Array,
  recipientPrivateKey: Uint8Array,
): Uint8Array {
  if (recipientPublicKey.length !== 32) {
    throw new InvalidKeyError(
      `Expected 32-byte recipient public key, received ${recipientPublicKey.length} bytes.`,
    );
  }
  if (recipientPrivateKey.length !== 32) {
    throw new InvalidKeyError(
      `Expected 32-byte recipient private key, received ${recipientPrivateKey.length} bytes.`,
    );
  }
  const sodium = getSodium();
  if (ciphertext.length < sodium.crypto_box_SEALBYTES) {
    throw new DecryptionFailedError('Ciphertext is shorter than minimum sealed box overhead.');
  }

  try {
    const plaintext = sodium.crypto_box_seal_open(
      ciphertext,
      recipientPublicKey,
      recipientPrivateKey,
    );
    return plaintext;
  } catch (_err) {
    throw new DecryptionFailedError(
      'Sealed box decryption failed: key mismatch or ciphertext altered.',
    );
  }
}
