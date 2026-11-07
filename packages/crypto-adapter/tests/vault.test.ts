import { beforeAll, describe, expect, it } from 'vitest';
import {
  VaultPassphraseError,
  computeFingerprint,
  decryptVaultData,
  encryptVaultData,
  fromBase64,
  generateEncryptionKeyPair,
  generateSigningKeyPair,
  initCrypto,
  toBase64,
} from '../src/index.js';
import type { VaultIdentityData } from '../src/types.js';

describe('OMBRIX Vault — Argon2id KDF & Encrypted Backup', () => {
  let sampleVaultData: VaultIdentityData;

  beforeAll(async () => {
    await initCrypto();
    sampleVaultData = {
      version: 1,
      id: 'vault-test-id-1234',
      name: 'Alice Personal Vault',
      encryptionKeyPair: {
        publicKey: toBase64(new Uint8Array(32).fill(0x01)),
        privateKey: toBase64(new Uint8Array(32).fill(0x02)),
      },
      signingKeyPair: {
        publicKey: toBase64(new Uint8Array(32).fill(0x03)),
        privateKey: toBase64(new Uint8Array(64).fill(0x04)),
      },
      fingerprint: 'A1B2-C3D4-E5F6-7890-1234-5678-9ABC-DEF0',
      contacts: [
        {
          id: 'contact-bob',
          name: 'Bob',
          encPublicKey: toBase64(new Uint8Array(32).fill(0x05)),
          fingerprint: '1111-2222-3333-4444-5555-6666-7777-8888',
          isVerified: true,
          createdAt: 1700000000,
        },
      ],
      createdAt: 1700000000,
    };
  });

  it('encrypts and successfully decrypts vault data with valid passphrase', () => {
    const passphrase = 'correct horse battery staple';
    // Use lower ops/mem limit for test execution speed while verifying argon2id derivation
    const bundle = encryptVaultData(sampleVaultData, passphrase, 1, 1024 * 1024);

    expect(bundle.magic).toBe('OMBRIX_VAULT_BACKUP');
    expect(bundle.version).toBe(1);
    expect(bundle.kdf.algorithm).toBe('argon2id');
    expect(bundle.cipher.algorithm).toBe('xchacha20poly1305');

    const restored = decryptVaultData(bundle, passphrase);
    expect(restored.id).toBe(sampleVaultData.id);
    expect(restored.name).toBe(sampleVaultData.name);
    expect(restored.encryptionKeyPair.publicKey).toBe(sampleVaultData.encryptionKeyPair.publicKey);
    expect(restored.contacts).toHaveLength(1);
    expect(restored.contacts[0]?.name).toBe('Bob');
  });

  it('fails decryption with wrong passphrase (VaultPassphraseError)', () => {
    const bundle = encryptVaultData(sampleVaultData, 'secret123', 1, 1024 * 1024);

    expect(() => {
      decryptVaultData(bundle, 'wrong-password');
    }).toThrow(VaultPassphraseError);
  });

  it('fails decryption when vault bundle ciphertext is corrupted', () => {
    const bundle = encryptVaultData(sampleVaultData, 'passphrase', 1, 1024 * 1024);

    const rawCiphertext = fromBase64(bundle.cipher.ciphertext);
    rawCiphertext[rawCiphertext.length - 1] ^= 0xff;

    const corruptedBundle = {
      ...bundle,
      cipher: {
        ...bundle.cipher,
        ciphertext: toBase64(rawCiphertext),
      },
    };

    expect(() => {
      decryptVaultData(corruptedBundle, 'passphrase');
    }).toThrow(VaultPassphraseError);
  });
});
