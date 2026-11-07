import { describe, expect, it } from 'vitest';
import {
  DecompressionBombDetectedError,
  DecompressionBombError,
  MissingIdatChunkError,
  validatePng,
  validatePngOrThrow,
} from '../src/index.js';
import {
  buildPngFromChunks,
  createDecompressionBombVector,
  createValidPng,
  makeIhdrData,
} from './helpers/png-builder.js';

describe('decompression-bomb test suite', () => {
  it('rejects massive raw raster exceeding 64 MiB with high ratio', () => {
    // 5000x5000 RGBA image: raw raster approx 100 MB > 64 MiB limit
    const bombPng = createDecompressionBombVector({ width: 5000, height: 5000, idatLength: 10 });

    expect(() =>
      validatePngOrThrow(bombPng, {
        maxWidth: 10000,
        maxHeight: 10000,
        maxPixels: 30_000_000,
      }),
    ).toThrow(DecompressionBombDetectedError);
    expect(() =>
      validatePngOrThrow(bombPng, {
        maxWidth: 10000,
        maxHeight: 10000,
        maxPixels: 30_000_000,
      }),
    ).toThrow(DecompressionBombError);

    const res = validatePng(bombPng, {
      maxWidth: 10000,
      maxHeight: 10000,
      maxPixels: 30_000_000,
    });
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toBeInstanceOf(DecompressionBombDetectedError);
      expect(res.error.code).toBe('DECOMPRESSION_BOMB_DETECTED');
    }
  });

  it('rejects decompression bomb with custom ratio and raster limits', () => {
    const bombPng = createDecompressionBombVector({ width: 4000, height: 3000, idatLength: 20 });

    expect(() =>
      validatePngOrThrow(bombPng, {
        maxWidth: 5000,
        maxHeight: 5000,
        maxPixels: 15_000_000,
        maxUncompressedBytes: 10_000_000,
        maxDecompressionRatio: 500,
      }),
    ).toThrow(DecompressionBombDetectedError);
  });

  it('does not flag small highly compressed images as bombs (false positive protection)', () => {
    // 10x10 RGBA image: raw = 410 bytes, IDAT = 2 bytes. Ratio = 205:1
    const smallPng = createValidPng({ width: 10, height: 10, idatPayload: new Uint8Array(2) });
    const res = validatePng(smallPng);

    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.metadata.width).toBe(10);
      expect(res.metadata.height).toBe(10);
    }
  });

  it('does not flag legitimate large images with adequate IDAT size', () => {
    // 2000x2000 image with 500 KB IDAT -> raw approx 16 MB, ratio approx 32:1 (< 500:1)
    const largePng = createValidPng({
      width: 2000,
      height: 2000,
      idatPayload: new Uint8Array(500 * 1024),
    });
    const res = validatePng(largePng, {
      maxWidth: 4096,
      maxHeight: 4096,
      maxPixels: 12_000_000,
      maxUncompressedBytes: 64 * 1024 * 1024,
    });

    expect(res.valid).toBe(true);
  });

  it('rejects PNG with missing IDAT chunks', () => {
    const noIdatPng = buildPngFromChunks([
      { type: 'IHDR', data: makeIhdrData({ width: 10, height: 10 }) },
      { type: 'IEND', data: new Uint8Array(0) },
    ]);

    expect(() => validatePngOrThrow(noIdatPng)).toThrow(MissingIdatChunkError);
    const res = validatePng(noIdatPng);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toBeInstanceOf(MissingIdatChunkError);
      expect(res.error.code).toBe('MISSING_IDAT_CHUNK');
    }
  });
});
