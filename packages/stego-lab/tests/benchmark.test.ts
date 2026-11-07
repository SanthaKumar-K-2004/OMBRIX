import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import { describe, expect, it } from 'vitest';
import { runStegoBenchmark } from '../src/benchmark.js';
import { pngLsbMatching } from '../src/lsbMatching.js';

describe('Stego Lab: Comparative Algorithm Benchmarking', () => {
  it('benchmarks Sequential LSB vs LSB Matching side-by-side', async () => {
    const width = 40;
    const height = 40;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < data.length; i += 4) {
      data[i] = (i * 3) % 256;
      data[i + 1] = (i * 5) % 256;
      data[i + 2] = (i * 7) % 256;
      data[i + 3] = 255;
    }

    const carrier = { width, height, data };
    const payload = new TextEncoder().encode('Competitive Steganography Benchmark Data 2026');

    const results = await runStegoBenchmark(carrier, payload, [pngLsbSequential, pngLsbMatching]);

    expect(results).toHaveLength(2);

    const seqResult = results[0]!;
    const matchResult = results[1]!;

    // Both methods successfully recover payload
    expect(seqResult.success).toBe(true);
    expect(matchResult.success).toBe(true);

    // Both methods maintain high PSNR (> 50 dB)
    expect(seqResult.distortion.psnr).toBeGreaterThan(50);
    expect(matchResult.distortion.psnr).toBeGreaterThan(50);

    // Both methods maintain near-perfect SSIM (> 0.99)
    expect(seqResult.distortion.ssim).toBeGreaterThan(0.99);
    expect(matchResult.distortion.ssim).toBeGreaterThan(0.99);

    // Max perturbation for single LSB manipulation must not exceed 1
    expect(seqResult.distortion.maxChannelDiff).toBe(1);
    expect(matchResult.distortion.maxChannelDiff).toBe(1);
  });
});
