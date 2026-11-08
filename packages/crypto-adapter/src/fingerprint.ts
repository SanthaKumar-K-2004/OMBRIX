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

/**
 * Robustly parses any 32-byte key representation:
 * - Hyphenated hex (e.g. "ACD7-AE04-1234-5678-...")
 * - 64-character raw hex
 * - 44-character Base64
 * - Arbitrary passphrase/token (hashes deterministically to 32 bytes via generic hash)
 */
export function parseAnyKey32(input: string): Uint8Array {
  const cleaned = input.trim();
  if (!cleaned) {
    throw new InvalidKeyError('Key string cannot be empty.');
  }

  // 1. Strip hyphens, whitespace, colons
  const stripped = cleaned.replace(/[\s\-_:\n\r]/g, '');

  // 2. Check for 64-character hexadecimal (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(stripped)) {
    try {
      return fromHex(stripped.toLowerCase());
    } catch {
      const out = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        out[i] = Number.parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
      }
      return out;
    }
  }

  // 3. Try standard Base64
  try {
    const b64Bytes = fromBase64(cleaned);
    if (b64Bytes.length === 32) {
      return b64Bytes;
    }
  } catch {
    // Not valid base64
  }

  // 4. Fallback: hash deterministically to 32 bytes
  try {
    const sodium = getSodium();
    const enc = new TextEncoder().encode(cleaned);
    return sodium.crypto_generichash(32, enc, null);
  } catch {
    // Pure fallback if sodium not loaded
    const out = new Uint8Array(32);
    const enc = new TextEncoder().encode(cleaned);
    for (let i = 0; i < enc.length; i++) {
      out[i % 32] = ((out[i % 32] ?? 0) ^ enc[i]! ^ (i * 31)) & 0xff;
    }
    return out;
  }
}

/**
 * Normalizes any key input (hex, hyphenated hex, base64) into standard Base64.
 */
export function normalizePublicKeyToBase64(input: string): string {
  const bytes = parseAnyKey32(input);
  return toBase64(bytes);
}
