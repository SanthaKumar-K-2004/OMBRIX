import { describe, expect, it } from 'vitest';
import { computeDifferenceMap } from '../src/diffmap.js';

describe('Carrier Lens: Difference Map Computation', () => {
  it('returns zero diff for identical carriers', () => {
    const carrierA = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray(16).fill(100),
    };
    const carrierB = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray(16).fill(100),
    };

    const diff = computeDifferenceMap(carrierA, carrierB);
    expect(diff.totalDiffPixels).toBe(0);
    expect(diff.maxDiff).toBe(0);
    expect(diff.averageDiff).toBe(0);
    // Visual data buffer is black with 255 alpha
    expect(diff.data[0]).toBe(0);
    expect(diff.data[3]).toBe(255);
  });

  it('amplifies LSB alterations and tracks statistics', () => {
    const carrierA = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([
        100,
        100,
        100,
        255, // Pixel 0
        200,
        200,
        200,
        255, // Pixel 1
      ]),
    };
    const carrierB = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([
        101,
        100,
        100,
        255, // Pixel 0 modified R by 1 (LSB flip)
        200,
        200,
        200,
        255, // Pixel 1 identical
      ]),
    };

    const diff = computeDifferenceMap(carrierA, carrierB, { amplification: 100 });
    expect(diff.totalDiffPixels).toBe(1);
    expect(diff.maxDiff).toBe(1);
    expect(diff.averageDiff).toBe(0.5);

    // Pixel 0 Red difference of 1 amplified by 100
    expect(diff.data[0]).toBe(100);
    expect(diff.data[1]).toBe(0);
    expect(diff.data[2]).toBe(0);
    expect(diff.data[3]).toBe(255);

    // Pixel 1 identical -> black
    expect(diff.data[4]).toBe(0);
  });

  it('throws Error on dimension mismatch', () => {
    const carrierA = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
    const carrierB = { width: 3, height: 2, data: new Uint8ClampedArray(24) };

    expect(() => computeDifferenceMap(carrierA, carrierB)).toThrow(/Dimension mismatch/);
  });
});
