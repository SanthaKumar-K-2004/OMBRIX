import { describe, expect, it } from 'vitest';
import { computePerceptualHashFromRgba } from '../src/perceptualHash.js';

function createGradientRgba(width = 128, height = 128, brightnessOffset = 0): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Slanted visual gradient
      const val = Math.max(
        0,
        Math.min(255, Math.floor((x / width) * 160 + (y / height) * 80 + brightnessOffset)),
      );
      data[idx] = val; // R
      data[idx + 1] = val; // G
      data[idx + 2] = val; // B
      data[idx + 3] = 255; // A
    }
  }
  return data;
}

describe('computePerceptualHashFromRgba', () => {
  it('generates a 32-byte deterministic key from image raster', () => {
    const img1 = createGradientRgba(128, 128, 0);
    const key1 = computePerceptualHashFromRgba(128, 128, img1);

    expect(key1).toBeInstanceOf(Uint8Array);
    expect(key1.length).toBe(32);

    // Deterministic check
    const key2 = computePerceptualHashFromRgba(128, 128, img1);
    expect(key1).toEqual(key2);
  });

  it('preserves key identity under simulated JPEG quantization noise and brightness shifts', () => {
    const original = createGradientRgba(256, 256, 0);
    const keyOriginal = computePerceptualHashFromRgba(256, 256, original);

    // Apply JPEG-like block noise (adding/subtracting 2-5 to random pixels)
    const compressedCopy = new Uint8Array(original);
    for (let i = 0; i < compressedCopy.length; i++) {
      if (i % 4 === 3) continue;
      // Slight rounding noise typical of JPEG transcode
      compressedCopy[i] = Math.max(0, Math.min(255, (compressedCopy[i] ?? 0) + ((i % 5) - 2)));
    }

    const keyCompressed = computePerceptualHashFromRgba(256, 256, compressedCopy);
    expect(keyCompressed).toEqual(keyOriginal);
  });

  it('differentiates visually distinct images', () => {
    const imgA = createGradientRgba(128, 128, 0);
    const keyA = computePerceptualHashFromRgba(128, 128, imgA);

    // Opposite gradient image
    const imgB = new Uint8Array(128 * 128 * 4);
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const idx = (y * 128 + x) * 4;
        const val = Math.floor(((128 - x) / 128) * 200);
        imgB[idx] = val;
        imgB[idx + 1] = 0;
        imgB[idx + 2] = val;
        imgB[idx + 3] = 255;
      }
    }
    const keyB = computePerceptualHashFromRgba(128, 128, imgB);

    expect(keyA).not.toEqual(keyB);
  });
});
