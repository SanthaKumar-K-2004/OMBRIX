import { describe, expect, it } from 'vitest';
import { forwardDct8x8, inverseDct8x8, jpegDctStego } from '../src/dct.js';

describe('Milestone 16: JPEG 8x8 Block DCT Stego Engine', () => {
  it('performs forward and inverse 8x8 DCT with near-zero mathematical error', () => {
    const originalBlock: number[][] = [
      [52, 55, 61, 66, 70, 61, 64, 73],
      [63, 59, 55, 90, 109, 85, 69, 72],
      [62, 59, 68, 113, 144, 104, 66, 73],
      [63, 58, 71, 122, 154, 106, 70, 69],
      [67, 61, 68, 104, 126, 88, 68, 70],
      [79, 65, 60, 70, 77, 68, 58, 75],
      [85, 71, 64, 59, 55, 61, 65, 83],
      [87, 79, 69, 68, 65, 76, 78, 94],
    ];

    const F = forwardDct8x8(originalBlock);
    const reconstructed = inverseDct8x8(F);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        expect(Math.abs(reconstructed[r]![c]! - originalBlock[r]![c]!)).toBeLessThan(1e-4);
      }
    }
  });

  it('embeds and extracts payload successfully in JPEG DCT coefficient domain', async () => {
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);

    // Populate with continuous image pattern
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = Math.round(128 + 40 * Math.sin(x / 8) * Math.cos(y / 8));
        data[idx + 1] = Math.round(128 + 35 * Math.sin(y / 6));
        data[idx + 2] = Math.round(128 + 30 * Math.cos(x / 6));
        data[idx + 3] = 255;
      }
    }

    const carrier = { width, height, data };
    const payload = new TextEncoder().encode('OMBRIX JPEG DCT AC Coefficient Steganography');

    const stego = await jpegDctStego.embed(carrier, payload);
    expect(stego.width).toBe(width);
    expect(stego.height).toBe(height);

    const extracted = await jpegDctStego.extract(stego);
    expect(extracted).toEqual(payload);
    expect(new TextDecoder().decode(extracted)).toBe(
      'OMBRIX JPEG DCT AC Coefficient Steganography',
    );
  });
});
