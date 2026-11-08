import { describe, expect, it } from 'vitest';
import { analyzeRsSteganalysis } from '../src/rsSteganalysis.js';

describe('Milestone 17: RS Steganalysis (Fridrich et al. 2001)', () => {
  it('classifies a clean smooth image as clean with low asymmetry', () => {
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);

    // Natural smooth gradient
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = Math.round((x / width) * 200 + 20);
        data[idx + 1] = Math.round((y / height) * 200 + 20);
        data[idx + 2] = Math.round(((x + y) / (width + height)) * 200 + 20);
        data[idx + 3] = 255;
      }
    }

    const carrier = { width, height, data };
    const result = analyzeRsSteganalysis(carrier);

    expect(result.rm).toBeGreaterThan(result.sm);
    expect(result.details.totalGroups).toBeGreaterThan(0);
    expect(result.classification).toBe('clean');
    expect(result.estimatedPayloadRatio).toBeLessThan(0.15);
  });

  it('detects strong anomaly and classifies 100% LSB randomized carrier as stego_detected', () => {
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);

    // Smooth base image with 100% LSB randomized
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const baseR = Math.round((x / width) * 200 + 20);
        const baseG = Math.round((y / height) * 200 + 20);
        const baseB = Math.round(((x + y) / (width + height)) * 200 + 20);

        // Randomize LSB completely
        data[idx] = (baseR & ~1) | (Math.random() < 0.5 ? 1 : 0);
        data[idx + 1] = (baseG & ~1) | (Math.random() < 0.5 ? 1 : 0);
        data[idx + 2] = (baseB & ~1) | (Math.random() < 0.5 ? 1 : 0);
        data[idx + 3] = 255;
      }
    }

    const carrier = { width, height, data };
    const result = analyzeRsSteganalysis(carrier);

    expect(result.classification).toBe('stego_detected');
    expect(result.estimatedPayloadRatio).toBeGreaterThan(0.3);
  });
});
