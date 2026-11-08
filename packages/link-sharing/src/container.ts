import {
  DEFAULT_MEM_LIMIT,
  DEFAULT_OPS_LIMIT,
  deriveKeyArgon2id,
  fromBase64,
  getSodium,
  initCrypto,
  toBase64,
  zeroMemory,
} from '@ombrix/crypto-adapter';
import {
  CarrierTamperedError,
  InvalidLinkFormatError,
  LinkExpiredError,
  LinkPassphraseInvalidError,
  LinkPassphraseRequiredError,
  LinkSharingError,
} from './errors.js';
import type {
  CreateLinkOptions,
  LinkContainer,
  LinkMetadata,
  OpenLinkOptions,
  OpenedLink,
} from './types.js';

export async function computeCarrierHash(carrierBytes: Uint8Array): Promise<string> {
  await initCrypto();
  const sodium = getSodium();
  const hashBytes = sodium.crypto_generichash(32, carrierBytes, null);
  return Array.from(hashBytes)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createLinkContainer(options: CreateLinkOptions): Promise<LinkContainer> {
  if (options.expiresInSeconds <= 0) {
    throw new Error('expiresInSeconds must be a positive integer.');
  }

  await initCrypto();
  const sodium = getSodium();

  const carrierHash = await computeCarrierHash(options.carrierBytes);
  const now = Date.now();
  const expiresAt = now + Math.floor(options.expiresInSeconds * 1000);

  // Generate a random 16-byte hex ID
  const idBytes = sodium.randombytes_buf(16);
  const id = Array.from(idBytes)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('');

  const metadata: LinkMetadata = {
    id,
    version: 1,
    createdAt: now,
    expiresAt,
    carrierHash,
    carrierName: options.carrierName,
    hasPassphrase: Boolean(options.passphrase && options.passphrase.length > 0),
    burnAfterReading: options.burnAfterReading ?? false,
    senderFingerprint: options.senderFingerprint,
  };

  if (metadata.hasPassphrase && options.passphrase) {
    const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const opsLimit = options.opsLimit ?? DEFAULT_OPS_LIMIT;
    const memLimit = options.memLimit ?? DEFAULT_MEM_LIMIT;

    const derivedKey = deriveKeyArgon2id(options.passphrase, salt, opsLimit, memLimit);

    try {
      const ciphertext = sodium.crypto_secretbox_easy(options.payloadBytes, nonce, derivedKey);
      return {
        magic: 'OMBRIX_LINK',
        version: 1,
        metadata,
        salt: toBase64(salt),
        nonce: toBase64(nonce),
        ciphertext: toBase64(ciphertext),
      };
    } finally {
      zeroMemory(derivedKey);
    }
  }

  // Unencrypted payload container (still protected by steganography, integrity hash ring, and TTL)
  return {
    magic: 'OMBRIX_LINK',
    version: 1,
    metadata,
    ciphertext: toBase64(options.payloadBytes),
  };
}

export async function openLinkContainer(
  container: LinkContainer,
  options?: OpenLinkOptions,
): Promise<OpenedLink> {
  if (container.magic !== 'OMBRIX_LINK' || container.version !== 1 || !container.metadata) {
    throw new InvalidLinkFormatError('Magic byte or version mismatch.');
  }

  const attemptedAt = options?.currentTimeMs ?? Date.now();
  if (attemptedAt > container.metadata.expiresAt) {
    throw new LinkExpiredError(container.metadata.expiresAt, attemptedAt);
  }

  let carrierVerified = false;
  if (options?.carrierBytes) {
    const actualHash = await computeCarrierHash(options.carrierBytes);
    if (actualHash !== container.metadata.carrierHash) {
      throw new CarrierTamperedError(container.metadata.carrierHash, actualHash);
    }
    carrierVerified = true;
  }

  await initCrypto();
  const sodium = getSodium();

  if (container.metadata.hasPassphrase) {
    if (!options?.passphrase) {
      throw new LinkPassphraseRequiredError();
    }
    if (!container.salt || !container.nonce) {
      throw new InvalidLinkFormatError('Missing salt or nonce in encrypted link container.');
    }

    const salt = fromBase64(container.salt);
    const nonce = fromBase64(container.nonce);
    const ciphertext = fromBase64(container.ciphertext);
    const derivedKey = deriveKeyArgon2id(options.passphrase, salt);

    try {
      const decrypted = sodium.crypto_secretbox_open_easy(ciphertext, nonce, derivedKey);
      if (!decrypted) {
        throw new LinkPassphraseInvalidError();
      }
      return {
        metadata: container.metadata,
        payloadBytes: decrypted,
        isExpired: false,
        carrierVerified,
      };
    } catch (err) {
      if (err instanceof LinkSharingError) throw err;
      throw new LinkPassphraseInvalidError();
    } finally {
      zeroMemory(derivedKey);
    }
  }

  const payloadBytes = fromBase64(container.ciphertext);
  return {
    metadata: container.metadata,
    payloadBytes,
    isExpired: false,
    carrierVerified,
  };
}
