import { describe, expect, it } from 'vitest';
import { computeHistogram } from '../src/histogram.js';

describe('Carrier Lens: Histogram Computation', () => {
  it('correctly tallies channel frequency bins across 256 levels', () => {
    // 3 pixels:
    // Pixel 0: Red 50, Green 100, Blue 150, Alpha 255
    // Pixel 1: Red 50, Green 200, Blue 150, Alpha 255
    // Pixel 2: Red 0, Green 0, Blue 0, Alpha 128
    const carrier = {
      width: 3,
      height: 1,
      data: new Uint8ClampedArray([50, 100, 150, 255, 50, 200, 150, 255, 0, 0, 0, 128]),
    };

    const hist = computeHistogram(carrier);

    expect(hist.r[50]).toBe(2);
    expect(hist.r[0]).toBe(1);
    expect(hist.r[255]).toBe(0);

    expect(hist.g[100]).toBe(1);
    expect(hist.g[200]).toBe(1);
    expect(hist.g[0]).toBe(1);

    expect(hist.b[150]).toBe(2);
    expect(hist.b[0]).toBe(1);

    expect(hist.a[255]).toBe(2);
    expect(hist.a[128]).toBe(1);

    // Luminance BT.601 for Pixel 2 (0,0,0) is 0
    expect(hist.luminance[0]).toBe(1);
    // For Pixel 0: 0.299*50 + 0.587*100 + 0.114*150 = 14.95 + 58.7 + 17.1 = 90.75 -> 91
    expect(hist.luminance[91]).toBe(1);
  });
});
