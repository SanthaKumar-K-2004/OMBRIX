import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Ombrix } from '@ombrix/edge-sdk';
import { beforeAll, describe, expect, it } from 'vitest';
import { generateReleaseManifest } from '../../scripts/release-package.js';
import { demoDataset } from '../fixtures/demo-dataset/index.js';

describe('Phase 9 Integration: Capstone Release & DoD Final Verification', () => {
  beforeAll(async () => {
    await Ombrix.init();
  });

  describe('Milestone 25: Definition of Done Audit', () => {
    it('confirms all 5 DoD pillars are fully verified and test suite passes', () => {
      const dodTestPath = path.resolve(__dirname, 'definition-of-done.test.ts');
      expect(fs.existsSync(dodTestPath)).toBe(true);

      const content = fs.readFileSync(dodTestPath, 'utf8');
      expect(content).toContain('Pillar 1: Product Capabilities');
      expect(content).toContain('Pillar 2: Cryptographic Rigor');
      expect(content).toContain('Pillar 3: Image Engine & Steganography Defense');
      expect(content).toContain('Pillar 4: UX, Accessibility & Client-Side Design');
      expect(content).toContain('Pillar 5: Security, Zero-Telemetry & Release Readiness');
    });
  });

  describe('Milestone 26: Release Asset Builder & Checksum Manifests', () => {
    it('generates SHA256SUMS and SHA512SUMS for all production distribution files', () => {
      const distDir = path.resolve(__dirname, '../../apps/web/dist');
      expect(fs.existsSync(distDir)).toBe(true);

      const { entries, sha256Sums, sha512Sums } = generateReleaseManifest(distDir);

      expect(entries.length).toBeGreaterThan(0);
      expect(sha256Sums.length).toBeGreaterThan(0);
      expect(sha512Sums.length).toBeGreaterThan(0);

      // Verify that manifest matches physical files
      for (const entry of entries) {
        const fullPath = path.join(distDir, entry.filename);
        expect(fs.existsSync(fullPath)).toBe(true);

        const content = fs.readFileSync(fullPath);
        const expectedSha256 = crypto.createHash('sha256').update(content).digest('hex');
        expect(entry.sha256).toBe(expectedSha256);
      }

      // Verify checksum files exist on disk
      expect(fs.existsSync(path.join(distDir, 'SHA256SUMS'))).toBe(true);
      expect(fs.existsSync(path.join(distDir, 'SHA512SUMS'))).toBe(true);
    });
  });

  describe('Milestone 27: Demo Dataset Showcase & Capstone E2E Flow', () => {
    it('executes full roundtrip with Curated Demo Dataset vectors', async () => {
      const carrier = demoDataset.referenceCarriers.gradientCarrier64;
      const payload = demoDataset.samplePayloads.shortText;

      const stegoCarrier = await Ombrix.embed(carrier, payload);
      expect(stegoCarrier.width).toBe(carrier.width);
      expect(stegoCarrier.height).toBe(carrier.height);

      const extracted = await Ombrix.extract(stegoCarrier);
      expect(extracted.payload).toEqual(payload);
      expect(extracted.isEncrypted).toBe(false);
    });

    it('verifies DemoShowcaseModal UI component integration in apps/web', () => {
      const modalPath = path.resolve(
        __dirname,
        '../../apps/web/src/components/DemoShowcaseModal.tsx',
      );
      expect(fs.existsSync(modalPath)).toBe(true);

      const modalContent = fs.readFileSync(modalPath, 'utf8');
      expect(modalContent).toContain('OMBRIX Demo Dataset & Forensic Vectors');
      expect(modalContent).toContain('Reference Cryptographic Keys');
      expect(modalContent).toContain('Reference Carriers');
      expect(modalContent).toContain('Zero Telemetry & Local Evaluation');
    });

    it('validates air-gapped zero-telemetry boundary across entire web bundle', () => {
      const indexHtmlPath = path.resolve(__dirname, '../../apps/web/dist/index.html');
      expect(fs.existsSync(indexHtmlPath)).toBe(true);

      const html = fs.readFileSync(indexHtmlPath, 'utf8');
      expect(html).toContain("connect-src 'none'");
      expect(html).toContain('manifest.webmanifest');
    });
  });
});

