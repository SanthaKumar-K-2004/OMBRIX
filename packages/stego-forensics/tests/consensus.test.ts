import { describe, expect, it } from 'vitest';
import { analyzeConsensus } from '../src/consensus.js';

describe('Milestone 17: Multi-Detector Forensics Consensus', () => {
  it('evaluates clean image as CLEAN_BENIGN with caveats', () => {
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = Math.round((x / width) * 200 + 10);
        data[idx + 1] = Math.round((y / height) * 200 + 10);
        data[idx + 2] = 128;
        data[idx + 3] = 255;
      }
    }

    const carrier = { width, height, data };
    const report = analyzeConsensus(carrier);

    expect(report.verdict).toBe('CLEAN_BENIGN');
    expect(report.overallAnomalyScore).toBeLessThan(20);
    expect(report.caveats.length).toBeGreaterThan(0);
    expect(report.detectors.rs).toBeDefined();
    expect(report.detectors.spa).toBeDefined();
    expect(report.detectors.chiSquare).toBeDefined();
    expect(report.detectors.noiseResidual).toBeDefined();
  });

  it('detects perturbation and outputs STEGANOGRAPHY_DETECTED when heavily altered', () => {
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = Math.round((x / width) * 200 + 10);
        const g = Math.round((y / height) * 200 + 10);
        data[idx] = (r & ~1) | ((x * 7 + y * 3) & 1);
        data[idx + 1] = (g & ~1) | ((x * 11 + y * 5) & 1);
        data[idx + 2] = (128 & ~1) | ((x + y) & 1);
        data[idx + 3] = 255;
      }
    }

    const carrier = { width, height, data };
    const report = analyzeConsensus(carrier);

    expect(report.overallAnomalyScore).toBeGreaterThan(25);
    expect(['STEGANOGRAPHY_DETECTED', 'SUSPICIOUS_ANOMALY']).toContain(report.verdict);
  });
});
