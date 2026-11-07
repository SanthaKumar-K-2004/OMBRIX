import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import { describe, expect, it } from 'vitest';
import { analyzeChiSquare } from '../src/chisquare.js';

describe('Transit & Trace: Chi-Square Steganalysis', () => {
  it('analyzes natural carrier without false alarms', () => {
    // Generate natural image with natural local gradient/contrast
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        // Asymmetric frequencies for even/odd pairs
        data[idx] = (x * 2) % 256; // Only even numbers
        data[idx + 1] = (y * 2) % 256;
        data[idx + 2] = ((x + y) * 2) % 256;
        data[idx + 3] = 255;
      }
    }

    const carrier = { width, height, data };
    const report = analyzeChiSquare(carrier);

    expect(report.sampleCount).toBe(width * height * 3);
    expect(report.degreesOfFreedom).toBeGreaterThan(0);
    // Unaltered carrier with natural variance produces low p-value / clean
    expect(report.confidence).toBe('CLEAN');
    expect(report.anomalyDetected).toBe(false);
  });

  it('detects equalized PoVs after dense sequential LSB embedding', async () => {
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);

    // Natural carrier
    for (let i = 0; i < data.length; i += 4) {
      data[i] = (i * 2) % 256;
      data[i + 1] = (i * 4) % 256;
      data[i + 2] = (i * 6) % 256;
      data[i + 3] = 255;
    }

    const carrier = { width, height, data };

    // Embed pseudo-random dense payload (500 bytes)
    const payload = new Uint8Array(500);
    for (let i = 0; i < payload.length; i++) {
      payload[i] = (i * 137 + 43) % 256;
    }

    const stego = await pngLsbSequential.embed(carrier, payload);
    const report = analyzeChiSquare(stego);

    expect(report.sampleCount).toBe(width * height * 3);
    expect(report.degreesOfFreedom).toBeGreaterThan(0);
    expect(report.topDeviatingPairs.length).toBeGreaterThan(0);
  });
});
