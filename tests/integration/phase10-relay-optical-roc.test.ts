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
} from '@ombrix/relay-core';
import { computeTrapezoidalAuc, evaluateRocCurve } from '@ombrix/stego-forensics';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Phase 10: Zero-Knowledge Relay, Optical Air-Gap & ROC Forensics', () => {
  beforeAll(async () => {
    await initCrypto();
  });

  describe('Milestone 28: Zero-Knowledge Opaque Relay Protocol', () => {
    it('manages opaque message lifecycle with single-use capability token burning', async () => {
      const store = new LocalOpaqueRelayStore();
      const keypair = generateEncryptionKeyPair();
      const secretMessage = new TextEncoder().encode(
        'TOP-SECRET-INTEL: Station coordinates 45.1092, -122.6789. Evacuate at dawn.',
      );

      const ciphertext = seal(secretMessage, keypair.publicKey);

      // Deposit ciphertext with max 1 retrieval (burn after read)
      const { envelope, bearerToken } = store.deposit(ciphertext, {
        maxRetrievals: 1,
        ttlSeconds: 60,
      });

      expect(store.count()).toBe(1);

      // Unauthorized attempt
      expect(() => store.retrieve(envelope.messageId, 'wrong-bearer-token-hex')).toThrow(
        RelayInvalidTokenError,
      );

      // Authorized retrieval
      const retrieved = store.retrieve(envelope.messageId, bearerToken);
      expect(retrieved.messageId).toBe(envelope.messageId);

      // Decrypt retrieved payload
      const decrypted = openSeal(retrieved.ciphertext, keypair.publicKey, keypair.privateKey);
      expect(new TextDecoder().decode(decrypted)).toBe(
        'TOP-SECRET-INTEL: Station coordinates 45.1092, -122.6789. Evacuate at dawn.',
      );

      // Message was single-use: should now be burned/purged
      expect(() => store.retrieve(envelope.messageId, bearerToken)).toThrow(
        RelayMessageNotFoundError,
      );
      expect(store.count()).toBe(0);
    });

    it('handles expiration and TTL purging correctly', async () => {
      const store = new LocalOpaqueRelayStore();
      const { envelope, bearerToken } = store.deposit(new Uint8Array([1, 2, 3, 4]), {
        ttlSeconds: -10, // already expired
      });

      expect(() => store.retrieve(envelope.messageId, bearerToken)).toThrow(
        RelayMessageExpiredError,
      );
    });
  });

  describe('Milestone 29: Physical Optical Air-Gapped Transport & Frame Protocol', () => {
    it('chunks, serializes, shuffles, and reliably reassembles a binary carrier', () => {
      // Simulate an 8 KB binary carrier
      const carrierSize = 8192;
      const carrierData = new Uint8Array(carrierSize);
      for (let i = 0; i < carrierSize; i++) {
        carrierData[i] = (i * 31 + 17) & 0xff;
      }

      // Chunk into 512-byte optical frames
      const frames = chunkIntoOpticalFrames(carrierData, 512);
      expect(frames.length).toBe(16);

      // Serialize frames into strings (e.g. for QR transmission / visual flashing)
      const serializedFrames = frames.map(serializeOpticalFrame);

      // Simulate noisy, out-of-order optical scanning with duplicate frame captures
      const scannedFrames = [
        ...serializedFrames.slice(8),
        serializedFrames[2]!, // duplicate
        ...serializedFrames.slice(0, 8),
        serializedFrames[10]!, // duplicate
      ];

      const assembler = new OpticalFrameAssembler();
      let lastResult: OpticalAssemblyResult | null = null;

      for (const rawStr of scannedFrames) {
        const frame = parseOpticalFrame(rawStr);
        lastResult = assembler.addFrame(frame);
      }

      expect(assembler.isComplete()).toBe(true);
      expect(lastResult).not.toBeNull();
      expect(lastResult?.complete).toBe(true);
      expect(lastResult?.progressPercent).toBe(100);

      const assembledCarrier = lastResult?.data;
      expect(assembledCarrier).toBeDefined();
      expect(assembledCarrier?.length).toBe(carrierData.length);
      expect(assembledCarrier).toEqual(carrierData);
    });
  });

  describe('Milestone 30: Steganalysis ROC Detection & Statistical Benchmarking', () => {
    it('evaluates statistical detection thresholds and yields empirical ROC curve', () => {
      // Benchmark RS-Steganalysis or sample pair detector with 20 clean and 20 stego carriers
      const cleanCarriersScores = [
        0.002, 0.005, 0.008, 0.012, 0.015, 0.019, 0.022, 0.026, 0.031, 0.035, 0.04, 0.045, 0.051,
        0.058, 0.065, 0.072, 0.081, 0.09, 0.105, 0.12,
      ];
      const stegoCarriersScores = [
        0.11, 0.14, 0.165, 0.19, 0.22, 0.25, 0.29, 0.33, 0.38, 0.43, 0.48, 0.54, 0.61, 0.68, 0.74,
        0.81, 0.88, 0.92, 0.96, 0.99,
      ];

      const roc = evaluateRocCurve(cleanCarriersScores, stegoCarriersScores, {
        detectorName: 'RS-Consensus-Forensics',
        steps: 40,
      });

      expect(roc.detectorName).toBe('RS-Consensus-Forensics');
      expect(roc.totalSamples).toBe(40);
      expect(roc.positiveCount).toBe(20);
      expect(roc.negativeCount).toBe(20);

      // Slight overlap between clean [0.002..0.12] and stego [0.11..0.99]
      expect(roc.auc).toBeGreaterThan(0.95);
      expect(roc.optimalAccuracy).toBeGreaterThanOrEqual(0.95);
      expect(roc.points.length).toBeGreaterThan(40);

      // Verify trapezoidal AUC consistency
      const recomputedAuc = computeTrapezoidalAuc(roc.points);
      expect(recomputedAuc).toBe(roc.auc);
    });
  });

  describe('End-to-End Synergy: Encrypted Payload -> Air-Gap Chunking -> ROC Forensics -> Opaque Relay', () => {
    it('orchestrates complete secure multi-milestone data pipeline', async () => {
      // Step 1: Encrypt payload
      const keypair = generateEncryptionKeyPair();
      const originalIntel = new TextEncoder().encode(
        'INTELLIGENCE REPORT: Infiltration successful. Exfiltrate via air-gapped node 4.',
      );
      const ciphertext = seal(originalIntel, keypair.publicKey);

      // Step 2: Chunk into optical frames for air-gapped crossing
      const frames = chunkIntoOpticalFrames(ciphertext, 32);
      const assembler = new OpticalFrameAssembler();

      // Transmit across air-gap
      let finalAssembly: OpticalAssemblyResult | null = null;
      for (const frame of frames) {
        finalAssembly = assembler.addFrame(frame);
      }
      expect(assembler.isComplete()).toBe(true);
      expect(finalAssembly?.complete).toBe(true);
      const reassembledCiphertext = finalAssembly!.data!;

      // Step 3: Run Forensics ROC assessment to ensure detector integrity
      const baselineClean = [0.01, 0.02, 0.04, 0.05, 0.07];
      const baselineStego = [0.65, 0.72, 0.81, 0.89, 0.94];
      const rocAssessment = evaluateRocCurve(baselineClean, baselineStego);
      expect(rocAssessment.auc).toBe(1.0);

      // Step 4: Deposit reassembled ciphertext to Zero-Knowledge Opaque Relay
      const relay = new LocalOpaqueRelayStore();
      const { envelope, bearerToken } = relay.deposit(reassembledCiphertext, {
        maxRetrievals: 1,
        ttlSeconds: 120,
      });

      // Step 5: Recipient claims and decrypts
      const fetched = relay.retrieve(envelope.messageId, bearerToken);
      const decrypted = openSeal(fetched.ciphertext, keypair.publicKey, keypair.privateKey);

      expect(new TextDecoder().decode(decrypted)).toBe(
        'INTELLIGENCE REPORT: Infiltration successful. Exfiltrate via air-gapped node 4.',
      );
    });
  });
});
