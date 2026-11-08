import { describe, expect, it } from 'vitest';
import { PVD_RANGES, pvdStego } from '../src/pvd.js';

describe('Milestone 16: PVD Stego Engine', () => {
  it('has valid Wu & Tsai range definitions spanning 0 to 255', () => {
    expect(PVD_RANGES[0]?.lower).toBe(0);
    expect(PVD_RANGES[PVD_RANGES.length - 1]?.upper).toBe(255);
    for (let i = 0; i < PVD_RANGES.length - 1; i++) {
      expect(PVD_RANGES[i + 1]?.lower).toBe((PVD_RANGES[i]?.upper ?? 0) + 1);
    }
  });

  it('embeds and extracts payload successfully via PVD', async () => {
    const width = 32;
    const height = 32;
    const data = new Uint8ClampedArray(width * height * 4);

    // Populate with varied gradient to provide diverse edge contrasts
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = (x * 13 + y * 5) % 256;
        data[idx + 1] = (y * 11 + x * 3) % 256;
        data[idx + 2] = (x * y + 30) % 256;
        data[idx + 3] = 255;
      }
    }

    const carrier = { width, height, data };
    const payload = new TextEncoder().encode(
      'OMBRIX Pixel Value Differencing Secret Message (Wu & Tsai)',
    );

    const stego = await pvdStego.embed(carrier, payload);
    expect(stego.width).toBe(width);
    expect(stego.height).toBe(height);

    const extracted = await pvdStego.extract(stego);
    expect(extracted).toEqual(payload);
    expect(new TextDecoder().decode(extracted)).toBe(
      'OMBRIX Pixel Value Differencing Secret Message (Wu & Tsai)',
    );
  });

  it('handles boundary pixels (near 0 and near 255) without distortion or crash', async () => {
    const width = 16;
    const height = 16;
    const data = new Uint8ClampedArray(width * height * 4);

    // Create extreme boundary pixels (0, 1, 254, 255)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = i % 8 === 0 ? 0 : 255;
      data[i + 1] = i % 12 === 0 ? 1 : 254;
      data[i + 2] = i % 16 === 0 ? 5 : 250;
      data[i + 3] = 255;
    }

    const carrier = { width, height, data };
    const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe]);

    const stego = await pvdStego.embed(carrier, payload);
    const extracted = await pvdStego.extract(stego);
    expect(extracted).toEqual(payload);
  });
});
