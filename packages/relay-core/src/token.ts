import { fromBase64, getSodium, toBase64, toHex } from '@ombrix/crypto-adapter';

export function generateCapabilityToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64(bytes);
}

export function hashCapabilityToken(bearerToken: string): string {
  const sodium = getSodium();
  const tokenBytes = fromBase64(bearerToken);
  const hash = sodium.crypto_generichash(32, tokenBytes, null);
  return toHex(hash);
}

export function verifyCapabilityToken(bearerToken: string, expectedHashHex: string): boolean {
  try {
    const computed = hashCapabilityToken(bearerToken);
    const sodium = getSodium();
    return sodium.memcmp(sodium.from_hex(computed), sodium.from_hex(expectedHashHex));
  } catch {
    return false;
  }
}
