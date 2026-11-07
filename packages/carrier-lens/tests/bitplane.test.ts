import { describe, expect, it } from 'vitest';
import { extractBitplane } from '../src/bitplane.js';

import type { BitIndex } from '../src/types.js';

describe('Carrier Lens: Bitplane Extraction', () => {
  it('extracts bit 0 (LSB) correctly', () => {
    // 2x1 image: pixel 0 has R=1 (bit 0 is 1), pixel 1 has R=0 (bit 0 is 0)
    const carrier = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([
        1,
        0,
        0,
        255, // Pixel 0
        0,
        0,
        0,
        255, // Pixel 1
      ]),
    };

    const result = extractBitplane(carrier, { channel: 'r', bitIndex: 0 });
    expect(result.width).toBe(2);
    expect(result.height).toBe(1);

    // Pixel 0 should be white (255, 255, 255, 255)
    expect(result.data[0]).toBe(255);
    expect(result.data[1]).toBe(255);
    expect(result.data[2]).toBe(255);
    expect(result.data[3]).toBe(255);

    // Pixel 1 should be black (0, 0, 0, 255)
    expect(result.data[4]).toBe(0);
    expect(result.data[5]).toBe(0);
    expect(result.data[6]).toBe(0);
    expect(result.data[7]).toBe(255);
  });

  it('extracts bit 7 (MSB) correctly with invert option', () => {
    // Pixel 0 has G=128 (bit 7 is 1), Pixel 1 has G=127 (bit 7 is 0)
    const carrier = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([
        0,
        128,
        0,
        255, // Pixel 0
        0,
        127,
        0,
        255, // Pixel 1
      ]),
    };

    // When inverted, bit 1 becomes 0 (black), bit 0 becomes 255 (white)
    const result = extractBitplane(carrier, {
      channel: 'g',
      bitIndex: 7,
      invert: true,
    });

    expect(result.data[0]).toBe(0);
    expect(result.data[4]).toBe(255);
  });

  it('throws RangeError when bitIndex is outside [0, 7]', () => {
    const carrier = {
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([0, 0, 0, 255]),
    };

    expect(() =>
      extractBitplane(carrier, { channel: 'b', bitIndex: 8 as unknown as BitIndex }),
    ).toThrow(RangeError);
  });
});
