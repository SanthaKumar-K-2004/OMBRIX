import { isPng, validatePng } from '@ombrix/image-validation';
import type { CarrierImage } from '@ombrix/stego-interface';
import { describe, expect, it } from 'vitest';
import { decodePng, encodePng } from '../src/png-codec.js';

describe('CLI PNG Codec', () => {
  it('encodes and decodes a CarrierImage losslessly', () => {
    const width = 16;
    const height = 16;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = (i * 3) % 256; // R
      data[i + 1] = (i * 7) % 256; // G
      data[i + 2] = (i * 11) % 256; // B
      data[i + 3] = 255; // A
    }
    const carrier: CarrierImage = { width, height, data };

    const pngBytes = encodePng(carrier);
    expect(isPng(pngBytes)).toBe(true);

    const validation = validatePng(pngBytes);
    expect(validation.valid).toBe(true);
    if (validation.valid) {
      expect(validation.metadata.width).toBe(16);
      expect(validation.metadata.height).toBe(16);
    }

    const decoded = decodePng(pngBytes);
    expect(decoded.width).toBe(16);
    expect(decoded.height).toBe(16);
    expect(decoded.data.length).toBe(carrier.data.length);

    for (let i = 0; i < carrier.data.length; i++) {
      expect(decoded.data[i]).toBe(carrier.data[i]);
    }
  });

  it('throws on invalid png buffer during decode', () => {
    const corrupt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(() => decodePng(corrupt)).toThrow(/Invalid PNG image/);
  });
});
