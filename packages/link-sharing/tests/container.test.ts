import { initCrypto } from '@ombrix/crypto-adapter';
import { beforeAll, describe, expect, it } from 'vitest';
import { computeCarrierHash, createLinkContainer, openLinkContainer } from '../src/container.js';
import {
  CarrierTamperedError,
  LinkExpiredError,
  LinkPassphraseInvalidError,
  LinkPassphraseRequiredError,
} from '../src/errors.js';

describe('@ombrix/link-sharing - Container Lifecycle & Policies', () => {
  beforeAll(async () => {
    await initCrypto();
  });

  const dummyCarrier = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3, 4, 5]);
  const dummyPayload = new TextEncoder().encode('Confidential steganographic message for OMBRIX');

  it('computes deterministic 32-byte BLAKE2b carrier hash', async () => {
    const hash1 = await computeCarrierHash(dummyCarrier);
    const hash2 = await computeCarrierHash(dummyCarrier);
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  it('creates and opens unencrypted link container with valid carrier', async () => {
    const container = await createLinkContainer({
      expiresInSeconds: 3600,
      carrierBytes: dummyCarrier,
      payloadBytes: dummyPayload,
      carrierName: 'secret.png',
    });

    expect(container.magic).toBe('OMBRIX_LINK');
    expect(container.version).toBe(1);
    expect(container.metadata.hasPassphrase).toBe(false);
    expect(container.metadata.expiresAt).toBeGreaterThan(Date.now());

    const opened = await openLinkContainer(container, {
      carrierBytes: dummyCarrier,
    });

    expect(opened.carrierVerified).toBe(true);
    expect(opened.isExpired).toBe(false);
    expect(new TextDecoder().decode(opened.payloadBytes)).toBe(
      'Confidential steganographic message for OMBRIX',
    );
  });

  it('detects carrier tampering and aborts with CarrierTamperedError', async () => {
    const container = await createLinkContainer({
      expiresInSeconds: 3600,
      carrierBytes: dummyCarrier,
      payloadBytes: dummyPayload,
    });

    const tamperedCarrier = new Uint8Array(dummyCarrier);
    const lastIdx = tamperedCarrier.length - 1;
    tamperedCarrier[lastIdx] = (tamperedCarrier[lastIdx] ?? 0) ^ 0x01; // flip single bit

    await expect(
      openLinkContainer(container, {
        carrierBytes: tamperedCarrier,
      }),
    ).rejects.toThrow(CarrierTamperedError);
  });

  it('strictly enforces TTL expiration timestamps with LinkExpiredError', async () => {
    const container = await createLinkContainer({
      expiresInSeconds: 60, // 1 minute
      carrierBytes: dummyCarrier,
      payloadBytes: dummyPayload,
    });

    const futureTime = container.metadata.expiresAt + 1000; // 1 second after expiration

    await expect(
      openLinkContainer(container, {
        currentTimeMs: futureTime,
      }),
    ).rejects.toThrow(LinkExpiredError);
  });

  it('encrypts payload with Argon2id passphrase and validates authentication', async () => {
    const container = await createLinkContainer({
      expiresInSeconds: 3600,
      carrierBytes: dummyCarrier,
      payloadBytes: dummyPayload,
      passphrase: 'super-secure-passphrase-ombrix-2026',
    });

    expect(container.metadata.hasPassphrase).toBe(true);
    expect(container.salt).toBeDefined();
    expect(container.nonce).toBeDefined();

    // 1. Opening without passphrase should fail
    await expect(openLinkContainer(container)).rejects.toThrow(LinkPassphraseRequiredError);

    // 2. Opening with incorrect passphrase should fail
    await expect(openLinkContainer(container, { passphrase: 'wrong-passphrase' })).rejects.toThrow(
      LinkPassphraseInvalidError,
    );

    // 3. Opening with correct passphrase succeeds
    const opened = await openLinkContainer(container, {
      passphrase: 'super-secure-passphrase-ombrix-2026',
      carrierBytes: dummyCarrier,
    });

    expect(opened.carrierVerified).toBe(true);
    expect(new TextDecoder().decode(opened.payloadBytes)).toBe(
      'Confidential steganographic message for OMBRIX',
    );
  });
});
