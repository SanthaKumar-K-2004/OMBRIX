import {
  type CarrierImage,
  CarrierTamperedError,
  LinkExpiredError,
  Ombrix,
  generateEncryptionKeyPair,
  generateSigningKeyPair,
  initCrypto,
  toBase64,
} from '@ombrix/edge-sdk';
import { beforeAll, describe, expect, it } from 'vitest';

function createCarrier(width: number, height: number, pattern: number): CarrierImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (i * pattern) % 256;
    data[i + 1] = (i * (pattern + 3)) % 256;
    data[i + 2] = (i * (pattern + 7)) % 256;
    data[i + 3] = 255;
  }
  return { width, height, data };
}

describe('Phase 5: Link, Flow & Edge Unified Ecosystem Integration', () => {
  beforeAll(async () => {
    await initCrypto();
  });

  describe('Milestone 13: OMBRIX Link Ephemeral Sharing Lifecycle', () => {
    it('creates, serializes, verifies, and decrypts an ephemeral link container', async () => {
      const carrierBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 100, 101, 102]);
      const secret = 'Mission Rendezvous: Latitude 52.5200, Longitude 13.4050';
      const passphrase = 'berlin-rendezvous-secure-phrase';

      // 1. Create link with 2 hours TTL
      const { uri, container } = await Ombrix.createShareLink({
        expiresInSeconds: 7200,
        carrierBytes,
        payloadBytes: new TextEncoder().encode(secret),
        passphrase,
      });

      expect(uri).toContain('#link=');
      expect(container.metadata.hasPassphrase).toBe(true);

      // 2. Open link with matching carrier and passphrase
      const opened = await Ombrix.openShareLink(uri, {
        carrierBytes,
        passphrase,
      });

      expect(opened.carrierVerified).toBe(true);
      expect(opened.isExpired).toBe(false);
      expect(new TextDecoder().decode(opened.payloadBytes)).toBe(secret);
    });

    it('rejects tampered carriers via BLAKE2b hash ring', async () => {
      const carrierBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
      const { uri } = await Ombrix.createShareLink({
        expiresInSeconds: 3600,
        carrierBytes,
        payloadBytes: new TextEncoder().encode('Test Data'),
      });

      const tamperedBytes = new Uint8Array(carrierBytes);
      const lastIdx = tamperedBytes.length - 1;
      tamperedBytes[lastIdx] = (tamperedBytes[lastIdx] ?? 0) ^ 0xff;

      await expect(
        Ombrix.openShareLink(uri, {
          carrierBytes: tamperedBytes,
        }),
      ).rejects.toThrow(CarrierTamperedError);
    });

    it('rejects expired link containers strictly based on client TTL', async () => {
      const carrierBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 5, 6, 7]);
      const { uri, container } = await Ombrix.createShareLink({
        expiresInSeconds: 60, // 60s
        carrierBytes,
        payloadBytes: new TextEncoder().encode('Short lived secret'),
      });

      const futureTime = container.metadata.expiresAt + 5000;

      await expect(
        Ombrix.openShareLink(uri, {
          carrierBytes,
          currentTimeMs: futureTime,
        }),
      ).rejects.toThrow(LinkExpiredError);
    });
  });

  describe('Milestone 14: OMBRIX Flow Multi-Carrier Batch Pipeline', () => {
    it('audits batch capacity, stripes payload across carriers, and reassembles stream', async () => {
      const carriers = [
        { name: 'cover-1.png', carrier: createCarrier(50, 50, 3) },
        { name: 'cover-2.png', carrier: createCarrier(60, 60, 5) },
        { name: 'cover-3.png', carrier: createCarrier(40, 40, 7) },
      ];

      // 1. Audit capacity
      const audit = Ombrix.auditBatchCarriers(carriers);
      expect(audit.totalCarriers).toBe(3);
      expect(audit.validCarriers).toBe(3);
      expect(audit.totalCapacityBytes).toBeGreaterThan(2000);

      // 2. Stripe payload across carriers
      const largeSecret = 'OMBRIX-BATCH-PAYLOAD-CHUNK-STREAM-'.repeat(25); // ~850 bytes
      const secretBytes = new TextEncoder().encode(largeSecret);

      const embedTasks = Ombrix.splitPayloadAcrossCarriers(secretBytes, audit.items);
      expect(embedTasks.length).toBeGreaterThanOrEqual(1);

      // 3. Execute batch embedding
      const embedResults = await Ombrix.runBatchEmbed(embedTasks, { concurrency: 2 });
      expect(embedResults.every((r) => r.success)).toBe(true);

      // 4. Execute batch extraction
      const extractTasks = embedResults.map((r) => ({
        id: r.id,
        carrierName: r.carrierName,
        stegoImage: r.stegoImage!,
      }));

      const extractResults = await Ombrix.runBatchExtract(extractTasks, { concurrency: 2 });
      expect(extractResults.every((r) => r.success)).toBe(true);

      // 5. Reassemble chunked payload
      const validChunks = extractResults.map((r) => r.payloadBytes!);
      const reassembled = Ombrix.reassembleChunkedPayload(validChunks);

      expect(new TextDecoder().decode(reassembled)).toBe(largeSecret);
    });
  });

  describe('Milestone 15: OMBRIX Edge Unified SDK Facade', () => {
    it('verifies authenticated sealed box roundtrip and stego detection via Edge API', async () => {
      const carrier = createCarrier(90, 90, 11);
      const alice = generateSigningKeyPair();
      const bob = generateEncryptionKeyPair();

      const secretText = 'Zero-Server End-to-End Steganographic Channel';

      // 1. Embed encrypted and signed
      const stego = await Ombrix.embed(carrier, secretText, {
        recipientPublicKey: toBase64(bob.publicKey),
        signingPrivateKey: toBase64(alice.privateKey),
      });

      // 2. Extract and authenticate
      const result = await Ombrix.extract(stego, {
        recipientPublicKey: toBase64(bob.publicKey),
        recipientPrivateKey: toBase64(bob.privateKey),
        senderSigningPublicKey: toBase64(alice.publicKey),
      });

      expect(result.text).toBe(secretText);
      expect(result.isEncrypted).toBe(true);
      expect(result.signatureVerified).toBe(true);

      // 3. Detect stego anomalies via Chi-Square
      const trace = Ombrix.detectStego(stego);
      expect(trace.sampleCount).toBeGreaterThan(0);
      expect(trace.degreesOfFreedom).toBeGreaterThan(0);
    });
  });
});
