import {
  type CarrierImage,
  ExtractionError,
  InsufficientCapacityError,
  InvalidCarrierError,
  StegoAbortError,
} from '@ombrix/stego-interface';
import { describe, expect, it } from 'vitest';
import { pngLsbSequential } from '../src/index.js';

function createBlankCarrier(
  width: number,
  height: number,
  fillRgba = [30, 40, 50, 255],
): CarrierImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fillRgba[0]!;
    data[i * 4 + 1] = fillRgba[1]!;
    data[i * 4 + 2] = fillRgba[2]!;
    data[i * 4 + 3] = fillRgba[3]!;
  }
  return { width, height, data };
}

describe('stego-png-lsb package', () => {
  it('correctly calculates capacity for given dimensions', () => {
    const carrier = createBlankCarrier(100, 100); // 10,000 pixels
    const capacity = pngLsbSequential.calculateCapacity(carrier);

    expect(capacity.totalPixels).toBe(10000);
    expect(capacity.theoreticalBytes).toBe(Math.floor((10000 * 3) / 8)); // 3750 bytes
    expect(capacity.overheadBytes).toBe(4);
    expect(capacity.usableBytes).toBe(Math.floor((10000 * 3 - 32) / 8)); // 3746 bytes
  });

  it('performs exact round-trip embedding and extraction of empty payload (0 bytes)', async () => {
    const carrier = createBlankCarrier(20, 20);
    const payload = new Uint8Array(0);

    const stegoCarrier = await pngLsbSequential.embed(carrier, payload);
    const extracted = await pngLsbSequential.extract(stegoCarrier);

    expect(extracted.length).toBe(0);
    expect(extracted).toEqual(payload);
  });

  it('performs exact round-trip for small, medium, and binary payloads', async () => {
    const carrier = createBlankCarrier(50, 50); // 2,500 pixels = 933 usable bytes
    const textPayload = new TextEncoder().encode('OMBRIX: Beyond what the eye can see.');

    const stegoCarrier = await pngLsbSequential.embed(carrier, textPayload);
    const extracted = await pngLsbSequential.extract(stegoCarrier);

    expect(new TextDecoder().decode(extracted)).toBe('OMBRIX: Beyond what the eye can see.');
    expect(extracted).toEqual(textPayload);
  });

  it('embeds and extracts up to 100% of maximum usable capacity', async () => {
    const carrier = createBlankCarrier(20, 20); // 400 pixels = 146 usable bytes
    const capacity = pngLsbSequential.calculateCapacity(carrier);
    const maxPayload = new Uint8Array(capacity.usableBytes);
    for (let i = 0; i < maxPayload.length; i++) {
      maxPayload[i] = (i * 17) & 0xff;
    }

    const stegoCarrier = await pngLsbSequential.embed(carrier, maxPayload);
    const extracted = await pngLsbSequential.extract(stegoCarrier);

    expect(extracted.length).toBe(capacity.usableBytes);
    expect(extracted).toEqual(maxPayload);
  });

  it('throws InsufficientCapacityError when payload exceeds usable capacity', async () => {
    const carrier = createBlankCarrier(10, 10); // 100 pixels = 33 usable bytes
    const capacity = pngLsbSequential.calculateCapacity(carrier);
    const oversizedPayload = new Uint8Array(capacity.usableBytes + 1);

    await expect(pngLsbSequential.embed(carrier, oversizedPayload)).rejects.toThrow(
      InsufficientCapacityError,
    );
  });

  it('preserves alpha channel completely without alteration', async () => {
    const carrier = createBlankCarrier(30, 30, [100, 150, 200, 222]);
    const payload = new TextEncoder().encode('Preserve alpha channel integrity strictly!');

    const stegoCarrier = await pngLsbSequential.embed(carrier, payload);

    for (let i = 0; i < carrier.width * carrier.height; i++) {
      expect(stegoCarrier.data[i * 4 + 3]).toBe(222);
    }
  });

  it('rejects invalid carrier dimensions and undersized buffers', async () => {
    expect(() =>
      pngLsbSequential.calculateCapacity({ width: 0, height: 10, data: new Uint8Array(0) }),
    ).toThrow(InvalidCarrierError);

    expect(() =>
      pngLsbSequential.calculateCapacity({
        width: 10,
        height: 10,
        data: new Uint8Array(10), // less than 10*10*4 = 400
      }),
    ).toThrow(InvalidCarrierError);
  });

  it('throws ExtractionError when carrier has corrupted or impossible length header', async () => {
    // Carrier with random noise or unfilled bits where header says length is 10,000,000
    const carrier = createBlankCarrier(20, 20, [255, 255, 255, 255]); // All 1s in LSBs
    await expect(pngLsbSequential.extract(carrier)).rejects.toThrow(ExtractionError);
  });

  it('throws ExtractionError when carrier has fewer than 11 pixels', async () => {
    const tinyCarrier = createBlankCarrier(3, 3); // 9 pixels
    await expect(pngLsbSequential.extract(tinyCarrier)).rejects.toThrow(ExtractionError);
  });

  it('respects AbortSignal cancellation during embedding', async () => {
    const carrier = createBlankCarrier(100, 100);
    const payload = new Uint8Array(2000);
    const controller = new AbortController();
    controller.abort();

    await expect(
      pngLsbSequential.embed(carrier, payload, undefined, controller.signal),
    ).rejects.toThrow(StegoAbortError);
  });

  it('reports progress via onProgress callback', async () => {
    const carrier = createBlankCarrier(80, 80);
    const payload = new Uint8Array(1500);
    const progressUpdates: number[] = [];

    await pngLsbSequential.embed(carrier, payload, undefined, undefined, (p) => {
      progressUpdates.push(p);
    });

    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[progressUpdates.length - 1]).toBe(1.0);
  });

  it('provides carrier analysis and noise estimation', async () => {
    const carrier = createBlankCarrier(40, 40);
    const analysis = await pngLsbSequential.analyze(carrier);

    expect(analysis.totalPixels).toBe(1600);
    expect(analysis.capacity.usableBytes).toBeGreaterThan(0);
    expect(typeof analysis.estimatedNoiseEntropy).toBe('number');
  });
});
