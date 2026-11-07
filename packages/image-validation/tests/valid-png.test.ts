import { describe, expect, it } from 'vitest';
import { validatePng, validatePngOrThrow } from '../src/index.js';
import {
  buildPngFromChunks,
  createValidPng,
  makeIhdrData,
  makeMinimalDeflateIdat,
} from './helpers/png-builder.js';

describe('valid-png test suite', () => {
  it('validates minimal 1x1 RGBA PNG', () => {
    const png = createValidPng({ width: 1, height: 1, colorType: 6 });
    const res = validatePng(png);

    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.metadata.width).toBe(1);
      expect(res.metadata.height).toBe(1);
      expect(res.metadata.channels).toBe(4);
      expect(res.metadata.colorTypeName).toBe('rgba');
      expect(res.metadata.hasAlpha).toBe(true);
      expect(res.metadata.totalPixels).toBe(1);
      expect(res.metadata.chunkTypes).toEqual(['IHDR', 'IDAT', 'IEND']);
    }

    const meta = validatePngOrThrow(png);
    expect(meta.width).toBe(1);
    expect(meta.totalPixels).toBe(1);
  });

  it('validates 10x10 Grayscale PNG (ColorType 0)', () => {
    const png = createValidPng({ width: 10, height: 10, colorType: 0 });
    const res = validatePng(png);

    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.metadata.colorTypeName).toBe('grayscale');
      expect(res.metadata.channels).toBe(1);
      expect(res.metadata.hasAlpha).toBe(false);
      expect(res.metadata.totalPixels).toBe(100);
    }
  });

  it('validates 100x100 Truecolor RGB PNG (ColorType 2)', () => {
    const png = createValidPng({ width: 100, height: 100, colorType: 2 });
    const res = validatePng(png);

    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.metadata.colorTypeName).toBe('rgb');
      expect(res.metadata.channels).toBe(3);
      expect(res.metadata.hasAlpha).toBe(false);
      expect(res.metadata.totalPixels).toBe(10000);
    }
  });

  it('validates Indexed-Color PNG (ColorType 3)', () => {
    const png = createValidPng({ width: 20, height: 20, colorType: 3 });
    const res = validatePng(png);

    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.metadata.colorTypeName).toBe('palette');
      expect(res.metadata.channels).toBe(1);
      expect(res.metadata.hasAlpha).toBe(false);
    }
  });

  it('validates Grayscale with Alpha PNG (ColorType 4)', () => {
    const png = createValidPng({ width: 20, height: 20, colorType: 4 });
    const res = validatePng(png);

    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.metadata.colorTypeName).toBe('grayscale-alpha');
      expect(res.metadata.channels).toBe(2);
      expect(res.metadata.hasAlpha).toBe(true);
    }
  });

  it('validates 16-bit depth image', () => {
    const png = createValidPng({ width: 10, height: 10, colorType: 6, bitDepth: 16 });
    const res = validatePng(png);

    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.metadata.bitDepth).toBe(16);
      // 10 * (1 + ceil(10 * 8 / 8) * 8)? channels=4, bitDepth=16 -> 64 bits/pixel = 8 bytes/px
      // rawScanline = 1 + 10 * 8 = 81 bytes; 10 rows * 81 = 810 bytes
      expect(res.metadata.estimatedUncompressedBytes).toBe(810);
    }
  });

  it('accumulates multiple consecutive IDAT chunks', () => {
    const ihdr = { type: 'IHDR', data: makeIhdrData({ width: 20, height: 20 }) };
    const idat1 = { type: 'IDAT', data: new Uint8Array(50) };
    const idat2 = { type: 'IDAT', data: new Uint8Array(50) };
    const idat3 = { type: 'IDAT', data: new Uint8Array(25) };
    const iend = { type: 'IEND', data: new Uint8Array(0) };

    const png = buildPngFromChunks([ihdr, idat1, idat2, idat3, iend]);
    const res = validatePng(png);

    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.metadata.chunkTypes).toEqual(['IHDR', 'IDAT', 'IDAT', 'IDAT', 'IEND']);
    }
  });

  it('preserves ancillary chunks in metadata', () => {
    const ihdr = { type: 'IHDR', data: makeIhdrData({ width: 10, height: 10 }) };
    const phys = { type: 'pHYs', data: new Uint8Array(9) };
    const gama = { type: 'gAMA', data: new Uint8Array(4) };
    const idat = { type: 'IDAT', data: makeMinimalDeflateIdat() };
    const text = { type: 'tEXt', data: new TextEncoder().encode('Author\0OMBRIX') };
    const iend = { type: 'IEND', data: new Uint8Array(0) };

    const png = buildPngFromChunks([ihdr, phys, gama, idat, text, iend]);
    const res = validatePng(png);

    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.metadata.chunkTypes).toEqual(['IHDR', 'pHYs', 'gAMA', 'IDAT', 'tEXt', 'IEND']);
    }
  });

  it('accepts Adam7 interlacing flag (interlaceMethod: 1)', () => {
    const png = createValidPng({ width: 16, height: 16, interlaceMethod: 1 });
    const res = validatePng(png);

    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.metadata.interlaceMethod).toBe(1);
      expect(res.metadata.estimatedUncompressedBytes).toBeGreaterThan(0);
    }
  });
});
