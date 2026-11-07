import { InvalidKeyError } from './errors.js';
import { getSodium } from './sodium.js';

export function computeFingerprint(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) {
    throw new InvalidKeyError(`Expected 32-byte public key, received ${publicKey.length} bytes.`);
  }
  const sodium = getSodium();
  const hash = sodium.crypto_generichash(16, publicKey, null);
  const hex = sodium.to_hex(hash).toUpperCase();

  // Format into 8 groups of 4 characters: AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG-HHHH
  const groups: string[] = [];
  for (let i = 0; i < hex.length; i += 4) {
    groups.push(hex.slice(i, i + 4));
  }
  return groups.join('-');
}

export function computeKeyId(publicKey: Uint8Array): Uint8Array {
  if (publicKey.length !== 32) {
    throw new InvalidKeyError(`Expected 32-byte public key, received ${publicKey.length} bytes.`);
  }
  const sodium = getSodium();
  return sodium.crypto_generichash(8, publicKey, null);
}

export function toBase64(bytes: Uint8Array): string {
  const sodium = getSodium();
  return sodium.to_base64(bytes, sodium.base64_variants.ORIGINAL);
}

export function fromBase64(b64: string): Uint8Array {
  const sodium = getSodium();
  return sodium.from_base64(b64, sodium.base64_variants.ORIGINAL);
}

export function toHex(bytes: Uint8Array): string {
  const sodium = getSodium();
  return sodium.to_hex(bytes);
}

export function fromHex(hex: string): Uint8Array {
  const sodium = getSodium();
  return sodium.from_hex(hex);
}
