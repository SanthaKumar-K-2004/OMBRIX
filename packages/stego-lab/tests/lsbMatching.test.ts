import { describe, expect, it } from 'vitest';
import { pngLsbMatching } from '../src/lsbMatching.js';

describe('Stego Lab: LSB Matching (±1 Embedding)', () => {
  it('correctly calculates capacity for carrier', () => {
    const carrier = {
      width: 100,
      height: 100,
      data: new Uint8ClampedArray(100 * 100 * 4),
    };
    const cap = pngLsbMatching.calculateCapacity(carrier);
    // 10000 pixels * 3 channels = 30000 bits = 3750 bytes - 4 header = 3746 usable
    expect(cap.theoreticalBytes).toBe(3750);
    expect(cap.usableBytes).toBe(3746);
  });

  it('performs exact roundtrip embed and extract with boundary clamping', async () => {
    const width = 30;
    const height = 30;
    const data = new Uint8ClampedArray(width * height * 4);

    // Initialize with varied boundary values including 0 and 255
    for (let i = 0; i < data.length; i += 4) {
      data[i] = i % 256; // 0..255
      data[i + 1] = 0; // Test lower bound 0
      data[i + 2] = 255; // Test upper bound 255
      data[i + 3] = 255; // Alpha
    }

    const carrier = { width, height, data };
    const payload = new TextEncoder().encode(
      'OMBRIX LSB-Matching Steganography Engine: ±1 randomized embedding test.',
    );

    const stego = await pngLsbMatching.embed(carrier, payload);

    // Verify alpha channel is completely unaltered
    for (let i = 3; i < stego.data.length; i += 4) {
      expect(stego.data[i]).toBe(255);
    }

    // Verify no values overflow [0, 255]
    for (let i = 0; i < stego.data.length; i++) {
      expect(stego.data[i]).toBeGreaterThanOrEqual(0);
      expect(stego.data[i]).toBeLessThanOrEqual(255);
    }

    // Verify exact roundtrip recovery
    const extracted = await pngLsbMatching.extract(stego);
    expect(extracted).toEqual(payload);
    expect(new TextDecoder().decode(extracted)).toBe(
      'OMBRIX LSB-Matching Steganography Engine: ±1 randomized embedding test.',
    );
  });

  it('throws InsufficientCapacityError when payload exceeds capacity', async () => {
    const carrier = {
      width: 4,
      height: 4,
      data: new Uint8ClampedArray(4 * 4 * 4),
    };
    // 16 pixels * 3 channels = 48 bits = 6 bytes - 4 = 2 bytes usable
    const hugePayload = new Uint8Array(10);
    await expect(pngLsbMatching.embed(carrier, hugePayload)).rejects.toThrow(
      /exceeds usable carrier capacity/,
    );
  });
});
