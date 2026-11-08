/**
 * OMBRIX Chameleon: Dual-Layer Plausible Deniability Container.
 *
 * Implements anti-coercion steganography by packaging two independent
 * cryptographic payloads within the same carrier:
 * - Decoy Layer: Unlocked with Decoy Passkey (surrendered under duress).
 * - Confidential Master Layer: Unlocked with Master Passkey.
 *
 * An adversary cannot prove whether a second layer exists or if the
 * residual bytes are simply natural high-frequency carrier noise.
 */

import { ChaCha20Prng, hmacSha256, sha256 } from '@ombrix/stego-advanced';

const CHAMELEON_MAGIC = new Uint8Array([0x43, 0x48, 0x41, 0x4d]); // "CHAM"

function deriveLayerKey(
  passphrase: string,
  salt: string,
): { cipherKey: Uint8Array; authKey: Uint8Array } {
  const enc = new TextEncoder();
  const base = sha256(new Uint8Array([...enc.encode(passphrase.trim()), ...enc.encode(salt)]));
  const cipherKey = sha256(new Uint8Array([...base, 0x01, 0x45, 0x4e, 0x43]));
  const authKey = sha256(new Uint8Array([...base, 0x02, 0x4d, 0x41, 0x43]));
  return { cipherKey, authKey };
}

export interface ChameleonResult {
  isChameleon: boolean;
  layer: 'master' | 'decoy';
  data: Uint8Array;
}

export function packChameleonContainer(
  masterPayload: Uint8Array,
  masterPassphrase: string,
  decoyPayload: Uint8Array,
  decoyPassphrase: string,
): Uint8Array {
  // 1. Encrypt Decoy Layer
  const { cipherKey: decoyCipherKey, authKey: decoyAuthKey } = deriveLayerKey(
    decoyPassphrase,
    'OMBRIX_CHAMELEON_DECOY_LAYER_V1',
  );
  const encryptedDecoy = new Uint8Array(decoyPayload.length);
  const decoyPrng = new ChaCha20Prng(decoyCipherKey);
  for (let i = 0; i < decoyPayload.length; i++) {
    encryptedDecoy[i] = (decoyPayload[i]! ^ decoyPrng.nextByte()) & 0xff;
  }
  const decoyTag = hmacSha256(decoyAuthKey, encryptedDecoy).slice(0, 8);

  // 2. Encrypt Master Layer
  const { cipherKey: masterCipherKey, authKey: masterAuthKey } = deriveLayerKey(
    masterPassphrase,
    'OMBRIX_CHAMELEON_MASTER_LAYER_V1',
  );
  const encryptedMaster = new Uint8Array(masterPayload.length);
  const masterPrng = new ChaCha20Prng(masterCipherKey);
  for (let i = 0; i < masterPayload.length; i++) {
    encryptedMaster[i] = (masterPayload[i]! ^ masterPrng.nextByte()) & 0xff;
  }
  const masterTag = hmacSha256(masterAuthKey, encryptedMaster).slice(0, 8);

  // 3. Assemble Binary Container:
  // [4-byte CHAM] [4-byte decoyLen] [8-byte decoyTag] [encryptedDecoy]
  // [4-byte masterLen] [8-byte masterTag] [encryptedMaster]
  const totalLength = 4 + 4 + 8 + encryptedDecoy.length + 4 + 8 + encryptedMaster.length;
  const container = new Uint8Array(totalLength);
  let offset = 0;

  container.set(CHAMELEON_MAGIC, offset);
  offset += 4;

  const dLen = encryptedDecoy.length;
  container[offset++] = (dLen >>> 24) & 0xff;
  container[offset++] = (dLen >>> 16) & 0xff;
  container[offset++] = (dLen >>> 8) & 0xff;
  container[offset++] = dLen & 0xff;

  container.set(decoyTag, offset);
  offset += 8;

  container.set(encryptedDecoy, offset);
  offset += encryptedDecoy.length;

  const mLen = encryptedMaster.length;
  container[offset++] = (mLen >>> 24) & 0xff;
  container[offset++] = (mLen >>> 16) & 0xff;
  container[offset++] = (mLen >>> 8) & 0xff;
  container[offset++] = mLen & 0xff;

  container.set(masterTag, offset);
  offset += 8;

  container.set(encryptedMaster, offset);

  return container;
}

export function isChameleonContainer(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 28 &&
    bytes[0] === CHAMELEON_MAGIC[0] &&
    bytes[1] === CHAMELEON_MAGIC[1] &&
    bytes[2] === CHAMELEON_MAGIC[2] &&
    bytes[3] === CHAMELEON_MAGIC[3]
  );
}

export function unpackChameleonContainer(bytes: Uint8Array, passphrase: string): ChameleonResult {
  if (!isChameleonContainer(bytes)) {
    throw new Error('Not a valid Chameleon container.');
  }

  let offset = 4;
  const decoyLen =
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0;
  offset += 4;

  const decoyTag = bytes.slice(offset, offset + 8);
  offset += 8;

  const encryptedDecoy = bytes.slice(offset, offset + decoyLen);
  offset += decoyLen;

  const masterLen =
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0;
  offset += 4;

  const masterTag = bytes.slice(offset, offset + 8);
  offset += 8;

  const encryptedMaster = bytes.slice(offset, offset + masterLen);

  // 1. First test if passkey decrypts Master Layer
  const { cipherKey: masterCipherKey, authKey: masterAuthKey } = deriveLayerKey(
    passphrase,
    'OMBRIX_CHAMELEON_MASTER_LAYER_V1',
  );
  const expectedMasterTag = hmacSha256(masterAuthKey, encryptedMaster).slice(0, 8);
  let masterMatch = 0;
  for (let i = 0; i < 8; i++) {
    masterMatch |= (masterTag[i] ?? 0) ^ (expectedMasterTag[i] ?? 0);
  }

  if (masterMatch === 0) {
    const decryptedMaster = new Uint8Array(encryptedMaster.length);
    const masterPrng = new ChaCha20Prng(masterCipherKey);
    for (let i = 0; i < encryptedMaster.length; i++) {
      decryptedMaster[i] = (encryptedMaster[i]! ^ masterPrng.nextByte()) & 0xff;
    }
    return { isChameleon: true, layer: 'master', data: decryptedMaster };
  }

  // 2. Next test if passkey decrypts Decoy Layer
  const { cipherKey: decoyCipherKey, authKey: decoyAuthKey } = deriveLayerKey(
    passphrase,
    'OMBRIX_CHAMELEON_DECOY_LAYER_V1',
  );
  const expectedDecoyTag = hmacSha256(decoyAuthKey, encryptedDecoy).slice(0, 8);
  let decoyMatch = 0;
  for (let i = 0; i < 8; i++) {
    decoyMatch |= (decoyTag[i] ?? 0) ^ (expectedDecoyTag[i] ?? 0);
  }

  if (decoyMatch === 0) {
    const decryptedDecoy = new Uint8Array(encryptedDecoy.length);
    const decoyPrng = new ChaCha20Prng(decoyCipherKey);
    for (let i = 0; i < encryptedDecoy.length; i++) {
      decryptedDecoy[i] = (encryptedDecoy[i]! ^ decoyPrng.nextByte()) & 0xff;
    }
    return { isChameleon: true, layer: 'decoy', data: decryptedDecoy };
  }

  throw new Error(
    'Chameleon authentication failed: provided passkey matches neither Master nor Decoy layer.',
  );
}
