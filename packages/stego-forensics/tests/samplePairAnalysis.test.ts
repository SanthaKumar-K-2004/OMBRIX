import { describe, expect, it } from 'vitest';
import { analyzeSamplePairs } from '../src/samplePairAnalysis.js';

describe('Milestone 17: Sample Pair Analysis (Dumitrescu et al. 2003)', () => {
  it('correctly calculates primary sets and estimates near-zero payload for smooth carrier', () => {
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = Math.round((x / width) * 220 + 10);
        data[idx + 1] = Math.round((y / height) * 220 + 10);
        data[idx + 2] = 128;
        data[idx + 3] = 255;
      }
    }

    const carrier = { width, height, data };
    const result = analyzeSamplePairs(carrier);

    expect(result.primarySetCounts.p).toBeGreaterThan(0);
    expect(result.estimatedPayloadRatio).toBeLessThan(0.2);
    expect(result.classification).toBe('clean');
  });

  it('detects high payload ratio when LSBs are heavily modified', () => {
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = Math.round((x / width) * 220 + 10);
        const g = Math.round((y / height) * 220 + 10);
        data[idx] = (r & ~1) | ((x + y) & 1);
        data[idx + 1] = (g & ~1) | ((x * 3 + y) & 1);
        data[idx + 2] = (128 & ~1) | (x & 1);
        data[idx + 3] = 255;
      }
    }

    const carrier = { width, height, data };
    const result = analyzeSamplePairs(carrier);

    expect(result.estimatedPayloadRatio).toBeGreaterThan(0.2);
  });
});
