import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CarrierImage } from '@ombrix/stego-interface';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCli } from '../src/cli.js';
import { encodePng } from '../src/png-codec.js';

describe('OMBRIX CLI - Test Suite', () => {
  let tmpDir: string;
  let carrierPath: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ombrix-cli-test-'));

    // Create a dummy 48x48 PNG carrier
    const width = 48;
    const height = 48;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = (i * 5) % 256;
      data[i + 1] = (i * 7) % 256;
      data[i + 2] = (i * 13) % 256;
      data[i + 3] = 255;
    }
    const carrier: CarrierImage = { width, height, data };
    const png = encodePng(carrier);
    carrierPath = path.join(tmpDir, 'carrier.png');
    fs.writeFileSync(carrierPath, png);
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('prints help banner on empty args or help command', async () => {
    const res = await runCli(['help']);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('OMBRIX CLI');
    expect(res.stdout).toContain('Zero-Telemetry Forensic Steganography Suite');
  });

  it('prints version on --version or -v', async () => {
    const res = await runCli(['--version']);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('OMBRIX CLI v0.1.0');
  });

  it('fails gracefully when missing arguments', async () => {
    const res = await runCli(['embed']);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain('Missing <carrierPath>');
  });

  it('embeds and extracts message using default LSB', async () => {
    const stegoPath = path.join(tmpDir, 'stego-lsb.png');
    const secret = 'OMBRIX CLI LSB Secret Payload 2026';

    const embedRes = await runCli(['embed', carrierPath, '-p', secret, '-o', stegoPath]);

    expect(embedRes.exitCode).toBe(0);
    expect(embedRes.stdout).toContain('Payload embedded successfully');
    expect(fs.existsSync(stegoPath)).toBe(true);

    const extractRes = await runCli(['extract', stegoPath]);
    expect(extractRes.exitCode).toBe(0);
    expect(extractRes.stdout).toContain(secret);
  });

  it('scans an image and outputs forensic report and JSON', async () => {
    const resText = await runCli(['scan', carrierPath]);
    expect(resText.exitCode).toBe(0);
    expect(resText.stdout).toContain('OMBRIX Multi-Detector Steganalysis Report');
    expect(resText.stdout).toContain('Fridrich RS Steg');

    const resJson = await runCli(['scan', carrierPath, '--json']);
    expect(resJson.exitCode).toBe(0);
    const parsed = JSON.parse(resJson.stdout);
    expect(parsed.verdict).toBeDefined();
    expect(parsed.detectors.rs).toBeDefined();
    expect(parsed.detectors.spa).toBeDefined();
  });

  it('benchmarks steganographic algorithms on a carrier', async () => {
    const res = await runCli(['benchmark', carrierPath]);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('OMBRIX Algorithm Benchmark Matrix');
    expect(res.stdout).toContain('PSNR');

    const resJson = await runCli(['benchmark', carrierPath, '--json']);
    expect(resJson.exitCode).toBe(0);
    const parsed = JSON.parse(resJson.stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });

  it('runs automated experiment and produces Section 16.5 record', async () => {
    const reportPath = path.join(tmpDir, 'experiment.json');
    const res = await runCli([
      'experiment',
      carrierPath,
      '-p',
      'Scientific reproducible benchmark experiment',
      '-o',
      reportPath,
    ]);

    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('Experiment record saved');
    expect(fs.existsSync(reportPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    expect(content.schemaVersion).toBe('OMBRIX_EXPERIMENT_V1');
    expect(content.experimentId).toMatch(/^exp_/);
    expect(content.metrics.roundtripSuccess).toBe(true);
  });

  it('verifies stego image vs clean image', async () => {
    const stegoPath = path.join(tmpDir, 'stego-lsb.png');
    const verifyStego = await runCli(['verify', stegoPath]);
    expect(verifyStego.exitCode).toBe(0);
    expect(verifyStego.stdout).toContain('Verified OMB1 steganographic container');

    const verifyClean = await runCli(['verify', carrierPath]);
    expect(verifyClean.exitCode).toBe(0);
    expect(verifyClean.stdout).toContain('Carrier is clean');
  });
});
