import { VaultPassphraseError } from './errors.js';
import { fromBase64, toBase64 } from './fingerprint.js';
import { zeroMemory } from './memory.js';
import { getSodium } from './sodium.js';
import type { VaultBundle, VaultIdentityData } from './types.js';

export const DEFAULT_OPS_LIMIT = 2; // crypto_pwhash_OPSLIMIT_INTERACTIVE
export const DEFAULT_MEM_LIMIT = 67108864; // 64 MiB (crypto_pwhash_MEMLIMIT_INTERACTIVE)

export function deriveKeyArgon2id(
  passphrase: string,
  salt: Uint8Array,
  opsLimit: number = DEFAULT_OPS_LIMIT,
  memLimit: number = DEFAULT_MEM_LIMIT,
): Uint8Array {
  const sodium = getSodium();
  if (salt.length !== sodium.crypto_pwhash_SALTBYTES) {
    throw new Error(
      `Invalid salt length: expected ${sodium.crypto_pwhash_SALTBYTES}, received ${salt.length}`,
    );
  }

  const derivedKey = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES, // 32 bytes
    passphrase,
    salt,
    opsLimit,
    memLimit,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );

  return derivedKey;
}

export function encryptVaultData(
  vaultData: VaultIdentityData,
  passphrase: string,
  opsLimit: number = DEFAULT_OPS_LIMIT,
  memLimit: number = DEFAULT_MEM_LIMIT,
): VaultBundle {
  const sodium = getSodium();
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

  const derivedKey = deriveKeyArgon2id(passphrase, salt, opsLimit, memLimit);

  try {
    const jsonString = JSON.stringify(vaultData);
    const plaintext = new TextEncoder().encode(jsonString);
    const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, derivedKey);

    const bundle: VaultBundle = {
      magic: 'OMBRIX_VAULT_BACKUP',
      version: 1,
      createdAt: Date.now(),
      kdf: {
        algorithm: 'argon2id',
        opsLimit,
        memLimit,
        salt: toBase64(salt),
      },
      cipher: {
        algorithm: 'xchacha20poly1305',
        nonce: toBase64(nonce),
        ciphertext: toBase64(ciphertext),
      },
    };

    return bundle;
  } finally {
    zeroMemory(derivedKey);
  }
}

export function decryptVaultData(bundle: VaultBundle, passphrase: string): VaultIdentityData {
  if (bundle.magic !== 'OMBRIX_VAULT_BACKUP' || bundle.version !== 1) {
    throw new VaultPassphraseError('Invalid vault backup format or unsupported version.');
  }

  const sodium = getSodium();
  const salt = fromBase64(bundle.kdf.salt);
  const nonce = fromBase64(bundle.cipher.nonce);
  const ciphertext = fromBase64(bundle.cipher.ciphertext);

  const derivedKey = deriveKeyArgon2id(passphrase, salt, bundle.kdf.opsLimit, bundle.kdf.memLimit);

  try {
    const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, derivedKey);
    const jsonString = new TextDecoder().decode(plaintext);
    const parsed = JSON.parse(jsonString) as VaultIdentityData;
    return parsed;
  } catch (_err) {
    throw new VaultPassphraseError(
      'Failed to decrypt vault: incorrect passphrase or corrupted file.',
    );
  } finally {
    zeroMemory(derivedKey);
  }
}
