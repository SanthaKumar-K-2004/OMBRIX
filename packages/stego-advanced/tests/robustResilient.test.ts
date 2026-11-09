import type { CarrierImage } from '@ombrix/stego-interface';
import { describe, expect, it } from 'vitest';
import {
  FEC_REPETITION_FACTOR,
  ROBUST_SYNC_MARKER,
  robustResilientStego,
} from '../src/robustResilient.js';

function createTestCarrier(width = 256, height = 256): CarrierImage {
  const data = new Uint8ClampedArray(width * height * 4);
  // Generate a realistic gradient/textured image
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = Math.floor((x / width) * 200) + 20; // R
      data[idx + 1] = Math.floor((y / height) * 200) + 20; // G
      data[idx + 2] = Math.floor(((x + y) / (width + height)) * 200) + 20; // B
      data[idx + 3] = 255; // A
    }
  }
  return { width, height, data };
}

describe('RobustResilientStegoMethod', () => {
  it('has correct identification and metadata', () => {
    expect(robustResilientStego.id).toBe('stego-robust-resilient');
    expect(robustResilientStego.name).toContain('Robust Messaging');
    expect(FEC_REPETITION_FACTOR).toBe(5);
    expect(ROBUST_SYNC_MARKER).toBe(0x3d4c5a9f);
  });

  it('calculates realistic capacity for carrier dimensions', () => {
    const carrier = createTestCarrier(256, 256);
    const capacity = robustResilientStego.calculateCapacity(carrier);
    expect(capacity.usableBytes).toBeGreaterThan(50);
    expect(capacity.overheadBytes).toBe(12);
  });

  it('embeds and extracts payload bit-for-bit in direct lossless mode', async () => {
    const carrier = createTestCarrier(256, 256);
    const secret = new TextEncoder().encode('Mission Alpha: Coordinate 48.8584, 2.2945 verified.');

    const embedded = await robustResilientStego.embed(carrier, secret);
    expect(embedded.width).toBe(carrier.width);
    expect(embedded.height).toBe(carrier.height);

    const extracted = await robustResilientStego.extract(embedded);
    expect(new TextDecoder().decode(extracted)).toBe(
      'Mission Alpha: Coordinate 48.8584, 2.2945 verified.',
    );
  });

  it('survives random channel noise via 5x Forward Error Correction', async () => {
    const carrier = createTestCarrier(256, 256);
    const secretText = 'SECURE-TOKEN-ALPHA-772';
    const secret = new TextEncoder().encode(secretText);

    const stego = await robustResilientStego.embed(carrier, secret);

    // Apply random bit flips to 0.5% of pixels
    const noisyData = new Uint8ClampedArray(stego.data);
    let rng = 0x12345678;
    for (let i = 0; i < noisyData.length; i++) {
      if (i % 4 === 3) continue;
      rng = (1664525 * rng + 1013904223) >>> 0;
      if ((rng & 0xff) < 2) {
        // small perturbation +/- 3
        noisyData[i] = Math.max(0, Math.min(255, (noisyData[i] ?? 0) + (rng & 1 ? 3 : -3)));
      }
    }

    const extracted = await robustResilientStego.extract({
      width: stego.width,
      height: stego.height,
      data: noisyData,
    });
    expect(new TextDecoder().decode(extracted)).toBe(secretText);
  });
});
