import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import { describe, expect, it } from 'vitest';
import {
  runTransitSimulation,
  simulateJpegCompression,
  simulateNoise,
  simulateResize,
} from '../src/transit.js';

describe('Transit & Trace: Transformation Simulator', () => {
  it('simulates JPEG lossy compression preserving dimensions and alpha channel', () => {
    const carrier = {
      width: 16,
      height: 16,
      data: new Uint8ClampedArray(16 * 16 * 4).fill(128),
    };
    // Set alpha to 255
    for (let i = 3; i < carrier.data.length; i += 4) {
      carrier.data[i] = 255;
    }

    const compressed = simulateJpegCompression(carrier, 70);
    expect(compressed.width).toBe(16);
    expect(compressed.height).toBe(16);

    for (let i = 3; i < compressed.data.length; i += 4) {
      expect(compressed.data[i]).toBe(255);
    }
  });

  it('simulates downsampling/upsampling resize transformations', () => {
    const carrier = {
      width: 20,
      height: 20,
      data: new Uint8ClampedArray(20 * 20 * 4).fill(100),
    };
    for (let i = 3; i < carrier.data.length; i += 4) {
      carrier.data[i] = 255;
    }

    const resized = simulateResize(carrier, 0.5);
    expect(resized.width).toBe(20);
    expect(resized.height).toBe(20);
    expect(resized.data.length).toBe(carrier.data.length);
  });

  it('simulates channel transmission noise injection', () => {
    const carrier = {
      width: 10,
      height: 10,
      data: new Uint8ClampedArray(10 * 10 * 4).fill(100),
    };
    for (let i = 3; i < carrier.data.length; i += 4) {
      carrier.data[i] = 255;
    }

    const noisy = simulateNoise(carrier, 0.1);
    let alteredCount = 0;
    for (let i = 0; i < noisy.data.length; i += 4) {
      if (noisy.data[i] !== 100) alteredCount++;
    }

    expect(alteredCount).toBeGreaterThan(0);
    // Alpha remains completely untouched
    for (let i = 3; i < noisy.data.length; i += 4) {
      expect(noisy.data[i]).toBe(255);
    }
  });

  it('empirically demonstrates that spatial LSB fails under lossy JPEG transformation', async () => {
    const width = 32;
    const height = 32;
    const carrier = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4).fill(120),
    };
    for (let i = 3; i < carrier.data.length; i += 4) {
      carrier.data[i] = 255;
    }

    const payload = new TextEncoder().encode('Fragile LSB message intended to be tested');
    const stego = await pngLsbSequential.embed(carrier, payload);

    // Subject stego carrier to JPEG lossy compression
    const result = await runTransitSimulation(
      stego,
      pngLsbSequential,
      'JPEG',
      { jpegQuality: 70 },
      payload,
    );

    // Spatial LSB is fragile by design: lossy quantization alters LSB bits
    expect(result.payloadRecovered).toBe(false);
    expect(result.errorSummary).toBeDefined();
  });
});
