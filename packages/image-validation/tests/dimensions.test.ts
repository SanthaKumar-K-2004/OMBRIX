import { describe, expect, it } from 'vitest';
import {
  DimensionLimitExceededError,
  DimensionOutOfBoundsError,
  PixelCountLimitExceededError,
  PixelLimitExceededError,
  validatePng,
  validatePngOrThrow,
} from '../src/index.js';
import { buildPngFromChunks, createValidPng, makeIhdrData } from './helpers/png-builder.js';

describe('dimensions test suite', () => {
  it('rejects zero width (0x100)', () => {
    const png = buildPngFromChunks([
      { type: 'IHDR', data: makeIhdrData({ width: 0, height: 100 }) },
      { type: 'IDAT', data: new Uint8Array(10) },
      { type: 'IEND', data: new Uint8Array(0) },
    ]);

    expect(() => validatePngOrThrow(png)).toThrow(DimensionOutOfBoundsError);
    const res = validatePng(png);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toBeInstanceOf(DimensionOutOfBoundsError);
      expect(res.error.message).toContain('Invalid zero dimension');
    }
  });

  it('rejects zero height (100x0)', () => {
    const png = buildPngFromChunks([
      { type: 'IHDR', data: makeIhdrData({ width: 100, height: 0 }) },
      { type: 'IDAT', data: new Uint8Array(10) },
      { type: 'IEND', data: new Uint8Array(0) },
    ]);

    expect(() => validatePngOrThrow(png)).toThrow(DimensionOutOfBoundsError);
    const res = validatePng(png);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toBeInstanceOf(DimensionOutOfBoundsError);
    }
  });

  it('rejects zero width and height (0x0)', () => {
    const png = buildPngFromChunks([
      { type: 'IHDR', data: makeIhdrData({ width: 0, height: 0 }) },
      { type: 'IDAT', data: new Uint8Array(10) },
      { type: 'IEND', data: new Uint8Array(0) },
    ]);

    expect(() => validatePngOrThrow(png)).toThrow(DimensionOutOfBoundsError);
  });

  it('rejects width exceeding maxWidth limit', () => {
    const png = createValidPng({ width: 4097, height: 100 });

    expect(() => validatePngOrThrow(png, { maxWidth: 4096 })).toThrow(DimensionOutOfBoundsError);
    expect(() => validatePngOrThrow(png, { maxWidth: 4096 })).toThrow(DimensionLimitExceededError);

    const res = validatePng(png, { maxWidth: 4096 });
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toBeInstanceOf(DimensionOutOfBoundsError);
      expect(res.error.code).toBe('DIMENSION_OUT_OF_BOUNDS');
    }
  });

  it('rejects height exceeding maxHeight limit', () => {
    const png = createValidPng({ width: 100, height: 4097 });

    expect(() => validatePngOrThrow(png, { maxHeight: 4096 })).toThrow(DimensionOutOfBoundsError);

    const res = validatePng(png, { maxHeight: 4096 });
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toBeInstanceOf(DimensionOutOfBoundsError);
    }
  });

  it('accepts dimensions at exact maximum boundary', () => {
    const png = createValidPng({ width: 4096, height: 100 });
    const res = validatePng(png, { maxWidth: 4096, maxHeight: 4096 });

    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.metadata.width).toBe(4096);
      expect(res.metadata.height).toBe(100);
    }
  });

  it('rejects pixel area exceeding maxPixels limit', () => {
    const png = createValidPng({ width: 4096, height: 4096 }); // 16,777,216 px

    expect(() =>
      validatePngOrThrow(png, { maxWidth: 5000, maxHeight: 5000, maxPixels: 12_000_000 }),
    ).toThrow(PixelCountLimitExceededError);
    expect(() =>
      validatePngOrThrow(png, { maxWidth: 5000, maxHeight: 5000, maxPixels: 12_000_000 }),
    ).toThrow(PixelLimitExceededError);

    const res = validatePng(png, { maxWidth: 5000, maxHeight: 5000, maxPixels: 12_000_000 });
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toBeInstanceOf(PixelCountLimitExceededError);
      expect(res.error.code).toBe('PIXEL_COUNT_LIMIT_EXCEEDED');
    }
  });

  it('accepts pixel area at exact maximum boundary', () => {
    const png = createValidPng({
      width: 4000,
      height: 3000,
      idatPayload: new Uint8Array(100 * 1024),
    }); // 12,000,000 px
    const res = validatePng(png, {
      maxWidth: 4096,
      maxHeight: 4096,
      maxPixels: 12_000_000,
      maxUncompressedBytes: 100 * 1024 * 1024,
    });

    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.metadata.totalPixels).toBe(12_000_000);
    }
  });

  it('rejects pixel area 1 row above boundary', () => {
    const png = createValidPng({ width: 4000, height: 3001 }); // 12,004,000 px

    expect(() =>
      validatePngOrThrow(png, { maxWidth: 4096, maxHeight: 4096, maxPixels: 12_000_000 }),
    ).toThrow(PixelCountLimitExceededError);
  });
});
