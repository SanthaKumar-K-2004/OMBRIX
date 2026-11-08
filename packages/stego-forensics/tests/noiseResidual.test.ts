import { describe, expect, it } from 'vitest';
import { computeNoiseResidual } from '../src/noiseResidual.js';

describe('Milestone 17: Spatial Noise Residual Analysis', () => {
  it('computes 2nd-derivative Laplacian variance and returns valid heatmap buffer', () => {
    const width = 32;
    const height = 32;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < data.length; i += 4) {
      data[i] = 120;
      data[i + 1] = 130;
      data[i + 2] = 140;
      data[i + 3] = 255;
    }

    const carrier = { width, height, data };
    const result = computeNoiseResidual(carrier);

    expect(result.variance).toBe(0);
    expect(result.highFrequencyPerturbationIndex).toBe(0);
    expect(result.heatmapData.length).toBe(width * height * 4);
  });

  it('elevates variance and HFPI when spatial perturbations are added', () => {
    const width = 32;
    const height = 32;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const noise = (x % 2 === 0 ? 15 : -15) + (y % 2 === 0 ? 10 : -10);
        data[idx] = Math.max(0, Math.min(255, 128 + noise));
        data[idx + 1] = Math.max(0, Math.min(255, 128 + noise));
        data[idx + 2] = Math.max(0, Math.min(255, 128 + noise));
        data[idx + 3] = 255;
      }
    }

    const carrier = { width, height, data };
    const result = computeNoiseResidual(carrier);

    expect(result.variance).toBeGreaterThan(50);
    expect(result.highFrequencyPerturbationIndex).toBeGreaterThan(10);
  });
});
