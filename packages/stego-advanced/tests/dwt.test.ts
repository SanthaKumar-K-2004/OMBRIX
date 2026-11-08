import { describe, expect, it } from 'vitest';
import { forwardHaar2x2, haarDwtStego, inverseHaar2x2 } from '../src/dwt.js';

describe('Milestone 16: Haar DWT Stego Engine', () => {
  it('performs exact 2D integer Haar roundtrip', () => {
    const testCases: [number, number, number, number][] = [
      [10, 20, 30, 40],
      [255, 255, 255, 255],
      [0, 0, 0, 0],
      [128, 64, 192, 32],
      [100, 101, 102, 103],
    ];

    for (const [p00, p01, p10, p11] of testCases) {
      const block = forwardHaar2x2(p00, p01, p10, p11);
      const [r00, r01, r10, r11] = inverseHaar2x2(block.ll, block.lh, block.hl, block.hh);
      expect(r00).toBe(p00);
      expect(r01).toBe(p01);
      expect(r10).toBe(p10);
      expect(r11).toBe(p11);
    }
  });

  it('embeds and extracts payload successfully across all RGB channels', async () => {
    const width = 32;
    const height = 32;
    const data = new Uint8ClampedArray(width * height * 4);

    // Populate with gradient
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = (x * 7) % 256;
        data[idx + 1] = (y * 7) % 256;
        data[idx + 2] = ((x + y) * 5) % 256;
        data[idx + 3] = 255;
      }
    }

    const carrier = { width, height, data };
    const payload = new TextEncoder().encode('OMBRIX DWT Wavelet Test 12345!');

    const stego = await haarDwtStego.embed(carrier, payload);
    expect(stego.width).toBe(width);
    expect(stego.height).toBe(height);

    const extracted = await haarDwtStego.extract(stego);
    expect(extracted).toEqual(payload);
    expect(new TextDecoder().decode(extracted)).toBe('OMBRIX DWT Wavelet Test 12345!');
  });
});
