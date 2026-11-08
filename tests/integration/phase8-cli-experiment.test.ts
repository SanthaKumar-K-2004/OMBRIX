import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCli } from '@ombrix/cli';
import { encodePng } from '@ombrix/cli';
import {
  generateEncryptionKeyPair,
  generateSigningKeyPair,
  toBase64,
} from '@ombrix/crypto-adapter';
import { Ombrix } from '@ombrix/edge-sdk';
import type { CarrierImage } from '@ombrix/stego-interface';
import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function makeCarrier(width: number, height: number): CarrierImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = Math.round((x / width) * 200 + 25);
      data[idx + 1] = Math.round((y / height) * 200 + 25);
      data[idx + 2] = Math.round(((x + y) / (width + height)) * 200 + 25);
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('Phase 8 Integration: CLI Tooling, Experiment Engine & Offline PWA', () => {
  let tmpDir: string;
  let carrierPath: string;

  beforeAll(async () => {
    await Ombrix.init();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ombrix-phase8-test-'));
    const carrier = makeCarrier(64, 64);
    carrierPath = path.join(tmpDir, 'test-carrier.png');
    fs.writeFileSync(carrierPath, encodePng(carrier));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('Milestone 22: Scientific Experiment Engine (Section 16.5 Record)', () => {
    it('executes automated experiment, measures latency & distortion, and validates schema', async () => {
      const carrier = makeCarrier(64, 64);
      const secret = new TextEncoder().encode(
        'Section 16.5 Scientific Reproducibility Record Payload',
      );

      const exp = await Ombrix.runExperiment(carrier, secret, pngLsbSequential, {
        title: 'Sequential LSB Baseline Distortion & Forensics Test',
        description: 'End-to-end integration test of Milestone 22',
        author: 'OMBRIX Verification Suite',
        seed: 42,
      });

      // 1. Schema Validation
      expect(exp.schemaVersion).toBe('OMBRIX_EXPERIMENT_V1');
      expect(exp.experimentId).toMatch(/^exp_\d+_[a-z0-9]+/);
      expect(exp.timestamp).toBeDefined();
      expect(exp.ombrixVersion).toBe('0.1.0');

      // 2. Carrier Metadata
      expect(exp.carrier.width).toBe(64);
      expect(exp.carrier.height).toBe(64);
      expect(exp.carrier.totalPixels).toBe(4096);
      expect(exp.carrier.format).toBe('RAW_RGBA');

      // 3. Algorithm Metadata
      expect(exp.algorithm.methodId).toBe('png-lsb-sequential');
      expect(exp.algorithm.seed).toBe(42);

      // 4. Payload & Rates
      expect(exp.payload.sizeBytes).toBe(secret.length);
      expect(exp.payload.embeddingRateBpp).toBeGreaterThan(0);
      expect(exp.payload.embeddingRateCapacityPercent).toBeGreaterThan(0);

      // 5. Distortion Metrics
      expect(exp.metrics.roundtripSuccess).toBe(true);
      expect(exp.metrics.distortion.psnr).toBeGreaterThan(45);
      expect(exp.metrics.distortion.ssim).toBeGreaterThan(0.99);
      expect(exp.metrics.distortion.mse).toBeGreaterThanOrEqual(0);
      expect(exp.metrics.distortion.mae).toBeDefined();

      // 6. Forensics Multi-Detector Outputs
      expect(exp.forensics.consensusVerdict).toBeDefined();
      expect(exp.forensics.overallAnomalyScore).toBeGreaterThanOrEqual(0);
      expect(exp.forensics.rsEstimatedPayload).toBeDefined();
      expect(exp.forensics.spaEstimatedPayload).toBeDefined();
      expect(exp.forensics.chiSquarePValue).toBeDefined();
      expect(exp.forensics.noiseResidualVariance).toBeDefined();

      // 7. Serialization and Parsing Roundtrip
      const serialized = Ombrix.serializeExperiment(exp);
      const parsed = Ombrix.parseExperiment(serialized);

      expect(parsed.experimentId).toBe(exp.experimentId);
      expect(parsed.metrics.roundtripSuccess).toBe(true);
      expect(parsed.metrics.distortion.psnr).toBe(exp.metrics.distortion.psnr);

      // 8. Rejects invalid schema version
      const invalidJson = JSON.stringify({ ...exp, schemaVersion: 'INVALID_VERSION' });
      expect(() => Ombrix.parseExperiment(invalidJson)).toThrow(
        /Invalid experiment record schema version/,
      );
    });
  });

  describe('Milestone 23: OMBRIX CLI Execution', () => {
    it('executes embed, extract, scan, benchmark, experiment, and verify end-to-end', async () => {
      const stegoPath = path.join(tmpDir, 'cli-stego.png');
      const experimentPath = path.join(tmpDir, 'cli-experiment.json');
      const secret = 'OMBRIX End-to-End CLI Pipeline Test Secret';

      // 1. Embed
      const embedRes = await runCli(['embed', carrierPath, '-p', secret, '-o', stegoPath]);
      expect(embedRes.exitCode).toBe(0);
      expect(embedRes.stdout).toContain('Payload embedded successfully');
      expect(fs.existsSync(stegoPath)).toBe(true);

      // 2. Extract
      const extractRes = await runCli(['extract', stegoPath]);
      expect(extractRes.exitCode).toBe(0);
      expect(extractRes.stdout).toContain(secret);

      // 3. Scan
      const scanRes = await runCli(['scan', stegoPath, '--json']);
      expect(scanRes.exitCode).toBe(0);
      const scanData = JSON.parse(scanRes.stdout);
      expect(scanData.verdict).toBeDefined();
      expect(scanData.detectors).toBeDefined();

      // 4. Benchmark
      const benchRes = await runCli(['benchmark', carrierPath, '--json']);
      expect(benchRes.exitCode).toBe(0);
      const benchData = JSON.parse(benchRes.stdout);
      expect(Array.isArray(benchData)).toBe(true);
      expect(benchData.length).toBeGreaterThan(0);

      // 5. Experiment
      const expRes = await runCli([
        'experiment',
        carrierPath,
        '-p',
        'Experiment Payload via CLI',
        '-o',
        experimentPath,
      ]);
      expect(expRes.exitCode).toBe(0);
      expect(fs.existsSync(experimentPath)).toBe(true);
      const savedExp = JSON.parse(fs.readFileSync(experimentPath, 'utf8'));
      expect(savedExp.schemaVersion).toBe('OMBRIX_EXPERIMENT_V1');

      // 6. Verify
      const verifyRes = await runCli(['verify', stegoPath]);
      expect(verifyRes.exitCode).toBe(0);
      expect(verifyRes.stdout).toContain('Verified OMB1 steganographic container');
    });

    it('supports authenticated encrypted and signed payload via CLI flags', async () => {
      const alice = generateSigningKeyPair();
      const bob = generateEncryptionKeyPair();

      const stegoCryptoPath = path.join(tmpDir, 'cli-crypto-stego.png');
      const secret = 'Top Secret Tactical Command Payload';

      const embedRes = await runCli([
        'embed',
        carrierPath,
        '-p',
        secret,
        '-o',
        stegoCryptoPath,
        '--recipient-key',
        toBase64(bob.publicKey),
        '--signing-key',
        toBase64(alice.privateKey),
      ]);
      expect(embedRes.exitCode).toBe(0);

      const extractRes = await runCli([
        'extract',
        stegoCryptoPath,
        '--recipient-key',
        toBase64(bob.privateKey),
        '--sender-key',
        toBase64(alice.publicKey),
      ]);
      expect(extractRes.exitCode).toBe(0);
      expect(extractRes.stdout).toContain(secret);
      expect(extractRes.stdout).toContain('Payload decrypted via Curve25519/Poly1305');
      expect(extractRes.stdout).toContain('Ed25519 digital signature verified');
    });
  });

  describe('Milestone 24: Offline PWA & Air-Gapped Deployment', () => {
    const webPublicDir = path.resolve(__dirname, '../../apps/web/public');
    const webIndexHtml = path.resolve(__dirname, '../../apps/web/index.html');

    it('verifies Web App Manifest metadata and styling', () => {
      const manifestPath = path.join(webPublicDir, 'manifest.webmanifest');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(manifestContent.name).toContain('OMBRIX');
      expect(manifestContent.short_name).toBe('OMBRIX');
      expect(manifestContent.display).toBe('standalone');
      expect(manifestContent.theme_color).toBe('#0B0F19');
      expect(manifestContent.background_color).toBe('#0B0F19');
      expect(manifestContent.icons.length).toBeGreaterThan(0);
    });

    it('verifies Cache-First Service Worker implementation', () => {
      const swPath = path.join(webPublicDir, 'sw.js');
      expect(fs.existsSync(swPath)).toBe(true);

      const swContent = fs.readFileSync(swPath, 'utf8');
      expect(swContent).toContain('CACHE_NAME');
      expect(swContent).toContain('caches.match(event.request)');
      expect(swContent).toContain("self.addEventListener('fetch'");
      expect(swContent).toContain('/manifest.webmanifest');
      expect(swContent).toContain('/index.html');
    });

    it('verifies index.html links manifest and enforces strict zero-telemetry CSP', () => {
      const htmlContent = fs.readFileSync(webIndexHtml, 'utf8');

      // 1. Web App Manifest Link
      expect(htmlContent).toContain('rel="manifest"');
      expect(htmlContent).toContain('href="/manifest.webmanifest"');

      // 2. Strict Content Security Policy with zero telemetry
      expect(htmlContent).toContain("connect-src 'none'");
      expect(htmlContent).toContain("default-src 'self'");
      expect(htmlContent).toContain("object-src 'none'");
    });
  });
});
