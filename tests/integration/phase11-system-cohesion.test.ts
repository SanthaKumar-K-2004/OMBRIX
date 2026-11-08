import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeHistogram, extractBitplane } from '@ombrix/carrier-lens';
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
  RelayMessageNotFoundError,
} from '@ombrix/relay-core';
import { stealthMatrixMethod } from '@ombrix/stego-advanced';
import { analyzeConsensus } from '@ombrix/stego-forensics';
import type { CarrierImage } from '@ombrix/stego-interface';
import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import { beforeAll, describe, expect, it } from 'vitest';
import { packFilePayload, unpackFilePayload } from '../../apps/web/src/utils/filePayload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

describe('Phase 11: Real-Time System Architecture, Cross-Studio Cohesion & Brand Invariants', () => {
  beforeAll(async () => {
    await initCrypto();
  });

  describe('Milestone 31: Full Optical Air-Gap & Zero-Knowledge Relay Integration', () => {
    it('executes end-to-end air-gap chunking, noisy transmission, and zero-knowledge relay claim', async () => {
      // 1. Generate keypair for sender and recipient
      const recipientPair = generateEncryptionKeyPair();
      const secretIntel = 'OMBRIX-PHASE-11-AIRGAP-DIRECTIVE: Evacuate through optical node 7.';
      const plaintext = new TextEncoder().encode(secretIntel);

      // 2. Encrypt with Libsodium sealed box
      const ciphertext = seal(plaintext, recipientPair.publicKey);

      // 3. Chunk ciphertext into optical frames (32 bytes per frame)
      const frames = chunkIntoOpticalFrames(ciphertext, 32);
      expect(frames.length).toBeGreaterThan(1);

      // 4. Serialize to optical transmission strings
      const frameStrings = frames.map(serializeOpticalFrame);

      // 5. Simulate noisy optical camera scanner feed (shuffled order with duplicates)
      const scannedFeed = [
        ...frameStrings.slice(1),
        frameStrings[0]!, // arrived late
        frameStrings[1]!, // duplicate scan
      ];

      const assembler = new OpticalFrameAssembler();
      let assemblyResult: OpticalAssemblyResult | null = null;

      for (const raw of scannedFeed) {
        assemblyResult = assembler.addFrame(parseOpticalFrame(raw));
      }

      expect(assembler.isComplete()).toBe(true);
      expect(assemblyResult?.complete).toBe(true);
      const reassembledCiphertext = assemblyResult!.data!;
      expect(reassembledCiphertext).toEqual(ciphertext);

      // 6. Deposit reassembled ciphertext to Zero-Knowledge Opaque Relay
      const relay = new LocalOpaqueRelayStore();
      const { envelope, bearerToken } = relay.deposit(reassembledCiphertext, {
        maxRetrievals: 1,
        ttlSeconds: 120,
      });

      expect(relay.count()).toBe(1);

      // 7. Verify unauthorized attempt is rejected
      expect(() => relay.retrieve(envelope.messageId, 'invalid-token')).toThrow(
        RelayInvalidTokenError,
      );

      // 8. Authorized recipient claims secret
      const claimed = relay.retrieve(envelope.messageId, bearerToken);
      expect(claimed.ciphertext).toEqual(ciphertext);

      // 9. Decrypt and verify original message
      const decrypted = openSeal(
        claimed.ciphertext,
        recipientPair.publicKey,
        recipientPair.privateKey,
      );
      expect(new TextDecoder().decode(decrypted)).toBe(secretIntel);

      // 10. Verify message was burned immediately after read
      expect(() => relay.retrieve(envelope.messageId, bearerToken)).toThrow(
        RelayMessageNotFoundError,
      );
      expect(relay.count()).toBe(0);
    });
  });

  describe('Milestone 32: Cross-Studio Data Flow & Analytical Cohesion', () => {
    it('propagates stego image through Lens diagnostics and Stego Forensics without degradation', async () => {
      // Create a 64x64 synthetic gradient carrier
      const width = 64;
      const height = 64;
      const cleanData = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          cleanData[idx] = Math.round((x / width) * 255);
          cleanData[idx + 1] = Math.round((y / height) * 255);
          cleanData[idx + 2] = Math.round(((x + y) / (2 * width)) * 255);
          cleanData[idx + 3] = 255;
        }
      }

      const cleanCarrier: CarrierImage = { width, height, data: cleanData };

      // Embed payload using LSB Sequential
      const payload = new TextEncoder().encode('OMBRIX_CROSS_STUDIO_COHESION_TEST_PAYLOAD');
      const stegoCarrier = await pngLsbSequential.embed(cleanCarrier, payload);

      // Lens diagnostics: Extract Bit 0 of Red Channel
      const bit0Plane = extractBitplane(stegoCarrier, { channel: 'r', bitIndex: 0 });
      expect(bit0Plane.width).toBe(width);
      expect(bit0Plane.height).toBe(height);

      // Lens histograms
      const hist = computeHistogram(stegoCarrier);
      expect(hist.r.length).toBe(256);
      expect(hist.g.length).toBe(256);
      expect(hist.b.length).toBe(256);

      // Forensics consensus scan
      const report = analyzeConsensus(stegoCarrier);
      expect(report.verdict).toBeDefined();
      expect(report.confidence).toBeGreaterThanOrEqual(0);
      expect(report.detectors.rs.estimatedPayloadRatio).toBeDefined();
      expect(report.detectors.spa.estimatedPayloadRatio).toBeDefined();

      // Extract and verify exact lossless data recovery
      const extracted = await pngLsbSequential.extract(stegoCarrier);
      expect(new TextDecoder().decode(extracted)).toBe('OMBRIX_CROSS_STUDIO_COHESION_TEST_PAYLOAD');
    });
  });

  describe('Milestone 33: Brand System, Offline Architecture & Security Controls', () => {
    it('verifies strict Content Security Policy blocks all external network exfiltration', () => {
      const indexHtmlPath = path.resolve(rootDir, 'apps/web/index.html');
      const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

      expect(indexHtml).toContain('http-equiv="Content-Security-Policy"');
      expect(indexHtml).toContain("connect-src 'none'");
      expect(indexHtml).toContain("object-src 'none'");
      expect(indexHtml).toContain('https://fonts.googleapis.com');
      expect(indexHtml).toContain('https://fonts.gstatic.com');
      expect(indexHtml).toContain('family=Sora:wght@400;600;700;800');
      expect(indexHtml).toContain('family=Inter:wght@300;400;500;600;700');
    });

    it('verifies offline PWA Web App Manifest matches official brand tokens', () => {
      const manifestPath = path.resolve(rootDir, 'apps/web/public/manifest.webmanifest');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      expect(manifest.name).toBe('OMBRIX — Air-Gapped Forensic Steganography Suite');
      expect(manifest.short_name).toBe('OMBRIX');
      expect(manifest.theme_color).toBe('#0B0F19');
      expect(manifest.background_color).toBe('#0B0F19');
      expect(manifest.display).toBe('standalone');
      expect(manifest.icons.length).toBeGreaterThan(0);
    });

    it('verifies all 11 interactive studios are fully wired in navigation and view controllers', () => {
      const navbarPath = path.resolve(rootDir, 'apps/web/src/components/Navbar.tsx');
      const navbarContent = fs.readFileSync(navbarPath, 'utf8');

      const expectedModules = [
        'core',
        'vault',
        'lens',
        'lab',
        'transit',
        'scan',
        'airgap',
        'relay',
        'link',
        'flow',
        'edge',
      ];

      for (const mod of expectedModules) {
        expect(navbarContent).toContain(`id: '${mod}'`);
      }
    });

    it('verifies zero unwanted version mentions (1.0, 2.0, v1.0, v2.0) across primary UI components', () => {
      const logoContent = fs.readFileSync(
        path.resolve(rootDir, 'apps/web/src/components/OmbrixLogo.tsx'),
        'utf8',
      );
      const navbarContent = fs.readFileSync(
        path.resolve(rootDir, 'apps/web/src/components/Navbar.tsx'),
        'utf8',
      );
      const coreContent = fs.readFileSync(
        path.resolve(rootDir, 'apps/web/src/components/CoreStudio.tsx'),
        'utf8',
      );
      const modalContent = fs.readFileSync(
        path.resolve(rootDir, 'apps/web/src/components/DemoShowcaseModal.tsx'),
        'utf8',
      );

      // Logo must not contain v1.0 or v2.0
      expect(logoContent).not.toContain('v1.0');
      expect(logoContent).not.toContain('v2.0');

      // Navbar must not contain v1.0 or v2.0 badges
      expect(navbarContent).not.toContain("'v1.0'");
      expect(navbarContent).not.toContain("'v2.0'");

      // Core Studio header must not contain v2.0 or v1.0 version numbers
      expect(coreContent).not.toContain('Undetectable Stealth v2.0');
      expect(coreContent).not.toContain('Undetectable Stealth v1.0');

      // Demo modal must not contain capstone version tags
      expect(modalContent).not.toContain('v0.1.0 Capstone');

      // SuiteCards, FlowStudio, VaultStudio, ScanStudio must not contain Phase / Milestone numbers
      const suiteContent = fs.readFileSync(
        path.resolve(rootDir, 'apps/web/src/components/SuiteCards.tsx'),
        'utf8',
      );
      const vaultContent = fs.readFileSync(
        path.resolve(rootDir, 'apps/web/src/components/VaultStudio.tsx'),
        'utf8',
      );
      const flowContent = fs.readFileSync(
        path.resolve(rootDir, 'apps/web/src/components/FlowStudio.tsx'),
        'utf8',
      );
      const scanContent = fs.readFileSync(
        path.resolve(rootDir, 'apps/web/src/components/ScanStudio.tsx'),
        'utf8',
      );

      expect(suiteContent).not.toMatch(/Phase \d+/i);
      expect(vaultContent).not.toMatch(/Phase \d+/i);
      expect(flowContent).not.toMatch(/MILESTONE \d+/i);
      expect(flowContent).not.toContain("version: '1.0'");
      expect(scanContent).not.toMatch(/Milestone \d+/i);
    });

    it('successfully embeds a secret PNG image inside an RGB carrier and extracts it losslessly with metadata', async () => {
      // 1. Create a 64x64 synthetic carrier image
      const carrierWidth = 64;
      const carrierHeight = 64;
      const carrierData = new Uint8Array(carrierWidth * carrierHeight * 4);
      for (let i = 0; i < carrierData.length; i += 4) {
        carrierData[i] = (i * 7) % 256; // R
        carrierData[i + 1] = (i * 13) % 256; // G
        carrierData[i + 2] = (i * 19) % 256; // B
        carrierData[i + 3] = 255; // Opaque alpha
      }
      const carrier: CarrierImage = {
        width: carrierWidth,
        height: carrierHeight,
        data: carrierData,
      };

      // 2. Create a simulated secret PNG image
      const secretImageBytes = new Uint8Array([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a, // PNG magic
        0x00,
        0x00,
        0x00,
        0x0d,
        0x49,
        0x48,
        0x44,
        0x52, // IHDR chunk
        ...new Array(60).fill(0x33), // payload
      ]);

      const packed = packFilePayload(secretImageBytes, {
        name: 'secret-blueprint.png',
        mime: 'image/png',
        size: secretImageBytes.length,
        width: 16,
        height: 16,
      });

      // 3. Embed into carrier using StealthMatrixMethod with passphrase
      const passkey = 'coral-matrix-falcon-beacon';
      const stegoCarrier = await stealthMatrixMethod.embed(carrier, packed, {
        passphrase: passkey,
      });

      // 4. Verify visual imperceptibility: calculate PSNR
      let sumSq = 0;
      for (let i = 0; i < carrierData.length; i++) {
        const diff = (carrierData[i] ?? 0) - (stegoCarrier.data[i] ?? 0);
        sumSq += diff * diff;
      }
      const mse = sumSq / carrierData.length;
      const psnr = 10 * Math.log10((255 * 255) / mse);
      expect(psnr).toBeGreaterThan(60); // PSNR > 60 dB = imperceptible

      // 5. Extract payload using StealthMatrixMethod
      const extractedBytes = await stealthMatrixMethod.extract(stegoCarrier, {
        passphrase: passkey,
      });
      expect(extractedBytes).toEqual(packed);

      // 6. Unpack file payload and verify exact fidelity
      const revealed = unpackFilePayload(extractedBytes);
      expect(revealed).not.toBeNull();
      expect(revealed?.name).toBe('secret-blueprint.png');
      expect(revealed?.mime).toBe('image/png');
      expect(revealed?.isImage).toBe(true);
      expect(revealed?.size).toBe(secretImageBytes.length);
      expect(revealed?.width).toBe(16);
      expect(revealed?.height).toBe(16);
      expect(revealed?.data).toEqual(secretImageBytes);
    });
  });
});
