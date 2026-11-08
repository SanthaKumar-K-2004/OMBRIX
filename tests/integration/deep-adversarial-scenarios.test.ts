import { generateEncryptionKeyPair, initCrypto, openSeal, seal } from '@ombrix/crypto-adapter';
import {
  type OpticalAssemblyResult,
  OpticalFrameAssembler,
  chunkIntoOpticalFrames,
  parseOpticalFrame,
  serializeOpticalFrame,
} from '@ombrix/optical-airgap';
import {
  LocalOpaqueRelayStore,
  RelayInvalidTokenError,
  RelayMessageExpiredError,
  RelayMessageNotFoundError,
  createOpaqueRelayEnvelope,
} from '@ombrix/relay-core';
import { haarDwtStego, jpegDctStego, pvdStego } from '@ombrix/stego-advanced';
import {
  analyzeConsensus,
  analyzeRsSteganalysis,
  analyzeSamplePairs,
  computeNoiseResidual,
} from '@ombrix/stego-forensics';
import { type CarrierImage, InsufficientCapacityError } from '@ombrix/stego-interface';
import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import { analyzeChiSquare } from '@ombrix/transit-trace';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Deep Adversarial Scenarios & Boundary Hardening Suite', () => {
  beforeAll(async () => {
    await initCrypto();
  });

  describe('Level 1: Steganography Engine Boundary & Extreme Carrier Dimensions', () => {
    it('rejects embedding into carriers with insufficient header capacity across all 4 algorithms', async () => {
      // 1x1 carrier (1 pixel = 4 bytes)
      const tinyCarrier1x1: CarrierImage = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray(4),
      };

      // 2x2 carrier (4 pixels = 16 bytes)
      const tinyCarrier2x2: CarrierImage = {
        width: 2,
        height: 2,
        data: new Uint8ClampedArray(16),
      };

      const emptyPayload = new Uint8Array(0);

      // Sequential LSB
      await expect(pngLsbSequential.embed(tinyCarrier1x1, emptyPayload)).rejects.toThrow(
        InsufficientCapacityError,
      );
      await expect(pngLsbSequential.embed(tinyCarrier2x2, emptyPayload)).rejects.toThrow(
        InsufficientCapacityError,
      );

      // PVD
      await expect(pvdStego.embed(tinyCarrier1x1, emptyPayload)).rejects.toThrow(
        InsufficientCapacityError,
      );
      await expect(pvdStego.embed(tinyCarrier2x2, emptyPayload)).rejects.toThrow(
        InsufficientCapacityError,
      );

      // Haar DWT (requires 2x2 blocks, at least 11 blocks for 32 bits header)
      await expect(haarDwtStego.embed(tinyCarrier1x1, emptyPayload)).rejects.toThrow(
        InsufficientCapacityError,
      );
      await expect(haarDwtStego.embed(tinyCarrier2x2, emptyPayload)).rejects.toThrow(
        InsufficientCapacityError,
      );

      // JPEG DCT (requires 8x8 blocks, at least 3 blocks for 32 bits header)
      await expect(jpegDctStego.embed(tinyCarrier1x1, emptyPayload)).rejects.toThrow(
        InsufficientCapacityError,
      );
      await expect(jpegDctStego.embed(tinyCarrier2x2, emptyPayload)).rejects.toThrow(
        InsufficientCapacityError,
      );
    });

    it('successfully handles exact-capacity saturation on non-square dimensions', async () => {
      // Non-square carrier 27 x 19 = 513 pixels
      const width = 27;
      const height = 19;
      const carrier: CarrierImage = {
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4).fill(128),
      };

      const cap = pngLsbSequential.calculateCapacity(carrier);
      expect(cap.usableBytes).toBeGreaterThan(100);

      // Fill exactly to 100% capacity
      const fullPayload = new Uint8Array(cap.usableBytes);
      for (let i = 0; i < fullPayload.length; i++) {
        fullPayload[i] = (i * 17 + 23) & 0xff;
      }

      const stego = await pngLsbSequential.embed(carrier, fullPayload);
      expect(stego.width).toBe(width);
      expect(stego.height).toBe(height);

      const recovered = await pngLsbSequential.extract(stego);
      expect(recovered.length).toBe(fullPayload.length);
      expect(recovered).toEqual(fullPayload);

      // 1 byte over capacity must throw InsufficientCapacityError
      const overPayload = new Uint8Array(cap.usableBytes + 1);
      await expect(pngLsbSequential.embed(carrier, overPayload)).rejects.toThrow(
        InsufficientCapacityError,
      );
    });
  });

  describe('Level 2: Forensic Steganalysis Under Pathological Carrier Distributions', () => {
    it('produces finite numerical values and no NaN on completely flat solid-color images', () => {
      const width = 64;
      const height = 64;

      // Solid pure white
      const solidWhite: CarrierImage = {
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4).fill(255),
      };

      // Solid pure black
      const solidBlack: CarrierImage = {
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4).fill(0),
      };

      for (const carrier of [solidWhite, solidBlack]) {
        const rs = analyzeRsSteganalysis(carrier);
        expect(Number.isFinite(rs.estimatedPayloadRatio)).toBe(true);
        expect(Number.isNaN(rs.estimatedPayloadRatio)).toBe(false);
        expect(Number.isFinite(rs.confidence)).toBe(true);
        expect(rs.estimatedPayloadRatio).toBeGreaterThanOrEqual(0);
        expect(rs.estimatedPayloadRatio).toBeLessThanOrEqual(1);

        const spa = analyzeSamplePairs(carrier);
        expect(Number.isFinite(spa.estimatedPayloadRatio)).toBe(true);
        expect(Number.isNaN(spa.estimatedPayloadRatio)).toBe(false);
        expect(Number.isFinite(spa.confidence)).toBe(true);
        expect(spa.estimatedPayloadRatio).toBeGreaterThanOrEqual(0);
        expect(spa.estimatedPayloadRatio).toBeLessThanOrEqual(1);

        const noise = computeNoiseResidual(carrier);
        expect(Number.isFinite(noise.variance)).toBe(true);
        expect(noise.variance).toBe(0);
        expect(noise.highFrequencyPerturbationIndex).toBe(0);

        const chi = analyzeChiSquare(carrier);
        expect(Number.isFinite(chi.pValue)).toBe(true);

        const consensus = analyzeConsensus(carrier);
        expect(Number.isFinite(consensus.overallAnomalyScore)).toBe(true);
        expect(Number.isFinite(consensus.confidence)).toBe(true);
        expect(consensus.verdict).toBeDefined();
      }
    });

    it('correctly evaluates high sample counts via enhanced vertical-horizontal SPA', () => {
      const width = 32;
      const height = 32;
      const data = new Uint8ClampedArray(width * height * 4);

      // Create synthetic image with gradient
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          data[idx] = (x * 4) & 0xff;
          data[idx + 1] = (y * 4) & 0xff;
          data[idx + 2] = ((x + y) * 2) & 0xff;
          data[idx + 3] = 255;
        }
      }

      const cleanCarrier: CarrierImage = { width, height, data };
      const spaClean = analyzeSamplePairs(cleanCarrier);

      // Verify that sample pair count includes both horizontal and vertical edges
      // Horizontal pairs per channel: 32 * 31 = 992. Vertical pairs per channel: 31 * 32 = 992.
      // Total potential pairs across 3 channels = (992 + 992) * 3 = 5952
      expect(spaClean.primarySetCounts.p).toBeGreaterThan(0);
      expect(spaClean.estimatedPayloadRatio).toBeLessThan(0.2);
    });
  });

  describe('Level 3: Optical Air-Gap Protocol Resilience & Malformed Frame Defense', () => {
    it('rejects invalid chunk size parameters and empty buffers', () => {
      const payload = new Uint8Array([1, 2, 3, 4, 5]);

      expect(() => chunkIntoOpticalFrames(new Uint8Array(0))).toThrow(/Cannot chunk empty buffer/);
      expect(() => chunkIntoOpticalFrames(payload, 0)).toThrow(
        /maxBytesPerFrame must be a positive integer/,
      );
      expect(() => chunkIntoOpticalFrames(payload, -10)).toThrow(
        /maxBytesPerFrame must be a positive integer/,
      );
    });

    it('rejects frames with tampered CRC32 or corrupted payload bytes', () => {
      const payload = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);
      const frames = chunkIntoOpticalFrames(payload, 4);
      expect(frames.length).toBe(2);

      const frame0Json = serializeOpticalFrame(frames[0]!);
      const parsed = parseOpticalFrame(frame0Json);
      expect(parsed.frameIndex).toBe(0);

      // Tamper with the chunkBase64 data in the JSON
      const tamperedObj = JSON.parse(frame0Json);
      tamperedObj.chunkBase64 = btoa('corrupted-data');
      const tamperedJson = JSON.stringify(tamperedObj);

      expect(() => parseOpticalFrame(tamperedJson)).toThrow(/CRC32 mismatch/);
    });

    it('rejects frames with out-of-bounds or negative frame indices', () => {
      const validFrame = chunkIntoOpticalFrames(new Uint8Array([1, 2, 3, 4]), 4)[0]!;
      const frameJson = serializeOpticalFrame(validFrame);

      // Test negative frameIndex
      const negativeObj = { ...JSON.parse(frameJson), frameIndex: -1 };
      expect(() => parseOpticalFrame(JSON.stringify(negativeObj))).toThrow(
        /Malformed optical frame index bounds/,
      );

      // Test frameIndex >= totalFrames
      const outOfBoundsObj = { ...JSON.parse(frameJson), frameIndex: 5, totalFrames: 2 };
      expect(() => parseOpticalFrame(JSON.stringify(outOfBoundsObj))).toThrow(
        /Malformed optical frame index bounds/,
      );
    });

    it('reliably reassembles a large stream subjected to high packet shuffle', () => {
      // 10 KB payload chunked into 64-byte frames -> ~157 frames
      const largePayload = new Uint8Array(10_000);
      for (let i = 0; i < largePayload.length; i++) {
        largePayload[i] = (i * 31 + 7) & 0xff;
      }

      const frames = chunkIntoOpticalFrames(largePayload, 64);
      expect(frames.length).toBeGreaterThan(150);

      // Deep pseudo-random shuffle of frames
      const shuffled = [...frames];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.sin(i * 997) * 10000) % (i + 1);
        const idx = Math.abs(j);
        const temp = shuffled[i]!;
        shuffled[i] = shuffled[idx]!;
        shuffled[idx] = temp;
      }

      const assembler = new OpticalFrameAssembler();
      let lastResult: OpticalAssemblyResult | undefined;
      for (const frame of shuffled) {
        lastResult = assembler.addFrame(frame);
      }

      expect(lastResult?.complete).toBe(true);
      expect(lastResult?.data?.length).toBe(largePayload.length);
      expect(lastResult?.data).toEqual(largePayload);
    });
  });

  describe('Level 4: Zero-Knowledge Relay Security & Boundary Enforcement', () => {
    it('enforces single-use capability token retrieval with automatic memory burn', () => {
      const store = new LocalOpaqueRelayStore();
      const secret = new TextEncoder().encode('CLASSIFIED RELAY CONTENT');

      const deposit = store.deposit(secret, { maxRetrievals: 1, ttlSeconds: 300 });
      expect(store.count()).toBe(1);

      // First retrieval with valid bearer token succeeds
      const retrieved = store.retrieve(deposit.envelope.messageId, deposit.bearerToken);
      expect(retrieved.ciphertext).toEqual(secret);
      expect(retrieved.remainingRetrievals).toBe(0);

      // Envelope is immediately burned from store
      expect(store.count()).toBe(0);

      // Second retrieval attempt must fail with RelayMessageNotFoundError
      expect(() => store.retrieve(deposit.envelope.messageId, deposit.bearerToken)).toThrow(
        RelayMessageNotFoundError,
      );
    });

    it('rejects retrieval with invalid or tampered capability bearer tokens', () => {
      const store = new LocalOpaqueRelayStore();
      const secret = new Uint8Array([1, 2, 3, 4, 5]);

      const deposit = store.deposit(secret);

      // Bogus bearer token
      expect(() =>
        store.retrieve(deposit.envelope.messageId, 'ombtok_invalid_token_xyz_123'),
      ).toThrow(RelayInvalidTokenError);

      // Message still preserved for authorized caller
      expect(store.count()).toBe(1);

      // Correct token succeeds
      const ok = store.retrieve(deposit.envelope.messageId, deposit.bearerToken);
      expect(ok.ciphertext).toEqual(secret);
    });

    it('enforces TTL expiration and rejects expired envelope retrieval', () => {
      const store = new LocalOpaqueRelayStore();
      const secret = new Uint8Array([9, 8, 7]);

      // Create an envelope that was expired 1 second ago
      const deposit = createOpaqueRelayEnvelope(secret, { ttlSeconds: 1 });
      deposit.envelope.expiresAt = Date.now() - 1000;
      store.depositEnvelope(deposit.envelope);

      // Attempting retrieve triggers RelayMessageExpiredError and purges
      expect(() => store.retrieve(deposit.envelope.messageId, deposit.bearerToken)).toThrow(
        RelayMessageExpiredError,
      );

      expect(store.count()).toBe(0);
    });
  });

  describe('Level 5: Cryptographic Sealed Box & Key Management Cohesion', () => {
    it('guarantees confidential sealed box roundtrip and rejects tampered ciphertext or wrong keys', () => {
      const alice = generateEncryptionKeyPair();
      const bob = generateEncryptionKeyPair();

      const message = new TextEncoder().encode('TOP SECRET TRANSMISSION TO BOB');

      // Alice seals to Bob's public key
      const ciphertext = seal(message, bob.publicKey);

      // Bob successfully opens seal with his keypair
      const decrypted = openSeal(ciphertext, bob.publicKey, bob.privateKey);
      expect(new TextDecoder().decode(decrypted)).toBe('TOP SECRET TRANSMISSION TO BOB');

      // Alice cannot decrypt Bob's message with her private key
      expect(() => openSeal(ciphertext, alice.publicKey, alice.privateKey)).toThrow(
        /Sealed box decryption failed/,
      );

      // Tampered ciphertext byte rejected
      const tampered = new Uint8Array(ciphertext);
      tampered[tampered.length - 1]! ^= 0x55;
      expect(() => openSeal(tampered, bob.publicKey, bob.privateKey)).toThrow(
        /Sealed box decryption failed/,
      );
    });
  });
});
