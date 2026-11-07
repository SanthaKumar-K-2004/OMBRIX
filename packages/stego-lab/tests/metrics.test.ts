import { describe, expect, it } from 'vitest';
import { calculateDistortion } from '../src/metrics.js';

describe('Stego Lab: Distortion Metrics (MSE, PSNR, SSIM)', () => {
  it('reports MSE=0, PSNR=Infinity, SSIM=1 for identical carriers', () => {
    const carrierA = {
      width: 4,
      height: 4,
      data: new Uint8ClampedArray(64).fill(120),
    };
    const carrierB = {
      width: 4,
      height: 4,
      data: new Uint8ClampedArray(64).fill(120),
    };

    const metrics = calculateDistortion(carrierA, carrierB);
    expect(metrics.mse).toBe(0);
    expect(metrics.psnr).toBe(Number.POSITIVE_INFINITY);
    expect(metrics.ssim).toBe(1);
    expect(metrics.totalAlteredChannels).toBe(0);
    expect(metrics.maxChannelDiff).toBe(0);
  });

  it('computes accurate MSE and PSNR for controlled perturbations', () => {
    // 2x1 carrier: 2 pixels = 6 RGB channels
    // Perturb 3 channels by 1: sumSquaredDiff = 3, MSE = 3 / 6 = 0.5
    // PSNR = 10 * log10(255^2 / 0.5) ≈ 10 * log10(130050) ≈ 51.14 dB
    const carrierA = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([100, 100, 100, 255, 100, 100, 100, 255]),
    };
    const carrierB = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([101, 101, 101, 255, 100, 100, 100, 255]),
    };

    const metrics = calculateDistortion(carrierA, carrierB);
    expect(metrics.mse).toBe(0.5);
    expect(metrics.psnr).toBeCloseTo(51.14, 1);
    expect(metrics.totalAlteredChannels).toBe(3);
    expect(metrics.maxChannelDiff).toBe(1);
    expect(metrics.ssim).toBeGreaterThan(0.99);
  });

  it('throws Error on carrier dimension mismatch', () => {
    const a = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
    const b = { width: 3, height: 2, data: new Uint8ClampedArray(24) };
    expect(() => calculateDistortion(a, b)).toThrow(/Dimension mismatch/);
  });
});
