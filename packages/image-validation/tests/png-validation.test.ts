import { describe, expect, it } from 'vitest';
import {
  FileSizeLimitExceededError,
  InvalidSignatureError,
  MalformedChunkError,
  MalformedIhdrError,
  MissingIendError,
  MissingIhdrError,
  TruncatedFileError,
  UnsupportedColorTypeError,
  crc32,
  isPng,
  validatePng,
  validatePngOrThrow,
} from '../src/index.js';
import {
  buildPngFromChunks,
  createCorruptedCrcVector,
  createNonConsecutiveIdatVector,
  createValidPng,
  makeIhdrData,
  makeMinimalDeflateIdat,
} from './helpers/png-builder.js';

describe('png-validation stream traversal & integrity suite', () => {
  it('isPng() detects valid PNG and rejects others', () => {
    const validSig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(isPng(validSig)).toBe(true);

    const invalidSig = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]); // JPEG
    expect(isPng(invalidSig)).toBe(false);

    const shortSig = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(isPng(shortSig)).toBe(false);
  });

  it('validates a standard static PNG successfully with both APIs', () => {
    const png = createValidPng({ width: 100, height: 80, colorType: 6 });

    const result = validatePng(png);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.metadata.width).toBe(100);
      expect(result.metadata.height).toBe(80);
      expect(result.metadata.colorType).toBe(6);
      expect(result.metadata.channels).toBe(4);
      expect(result.metadata.totalPixels).toBe(8000);
      expect(result.metadata.chunkTypes).toEqual(['IHDR', 'IDAT', 'IEND']);
    }

    const meta = validatePngOrThrow(png);
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(80);
  });

  it('throws TruncatedFileError on empty buffer (0 bytes)', () => {
    const empty = new Uint8Array(0);
    expect(() => validatePngOrThrow(empty)).toThrow(TruncatedFileError);
    const res = validatePng(empty);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toBeInstanceOf(TruncatedFileError);
      expect(res.error.code).toBe('TRUNCATED_FILE');
    }
  });

  it('throws TruncatedFileError on 7-byte buffer', () => {
    const partial = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a]);
    expect(() => validatePngOrThrow(partial)).toThrow(TruncatedFileError);
  });

  it('throws InvalidSignatureError for non-PNG signature of length 8+', () => {
    const nonPng = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(() => validatePngOrThrow(nonPng)).toThrow(InvalidSignatureError);
  });

  it('throws TruncatedFileError on signature-only buffer (8 bytes)', () => {
    const sigOnly = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => validatePngOrThrow(sigOnly)).toThrow(TruncatedFileError);
  });

  it('throws TruncatedFileError on truncated chunk header', () => {
    // 8-byte sig + 4-byte length = 12 bytes (< 8 + 12 = 20 minimum for chunk header)
    const truncated = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    expect(() => validatePngOrThrow(truncated)).toThrow(TruncatedFileError);
  });

  it('throws TruncatedFileError when chunk length exceeds buffer', () => {
    const fakeChunk = buildPngFromChunks([
      { type: 'IHDR', data: makeIhdrData() },
      { type: 'IDAT', data: makeMinimalDeflateIdat() },
      { type: 'IEND', data: new Uint8Array(0) },
    ]);

    // Mutate IDAT length at offset 8 (sig) + 25 (IHDR chunk) = 33 to huge length 0x0fffffff
    const view = new DataView(fakeChunk.buffer);
    view.setUint32(33, 0x00ffffff, false);

    expect(() => validatePngOrThrow(fakeChunk)).toThrow(TruncatedFileError);
  });

  it('throws MalformedChunkError when chunk length exceeds 2^31-1', () => {
    const chunk = buildPngFromChunks([
      { type: 'IHDR', data: makeIhdrData() },
      { type: 'IDAT', data: makeMinimalDeflateIdat() },
      { type: 'IEND', data: new Uint8Array(0) },
    ]);

    const view = new DataView(chunk.buffer);
    view.setUint32(33, 0x80000000, false);

    expect(() => validatePngOrThrow(chunk)).toThrow(MalformedChunkError);
  });

  it('throws MissingIhdrError when first chunk is not IHDR', () => {
    const noIhdr = buildPngFromChunks([
      { type: 'IDAT', data: makeMinimalDeflateIdat() },
      { type: 'IEND', data: new Uint8Array(0) },
    ]);

    expect(() => validatePngOrThrow(noIhdr)).toThrow(MissingIhdrError);
  });

  it('throws MalformedIhdrError on duplicate IHDR chunk', () => {
    const duplicateIhdr = buildPngFromChunks([
      { type: 'IHDR', data: makeIhdrData() },
      { type: 'IHDR', data: makeIhdrData() },
      { type: 'IDAT', data: makeMinimalDeflateIdat() },
      { type: 'IEND', data: new Uint8Array(0) },
    ]);

    expect(() => validatePngOrThrow(duplicateIhdr)).toThrow(MalformedIhdrError);
  });

  it('throws MalformedIhdrError on IHDR length != 13', () => {
    const badIhdrLength = buildPngFromChunks([
      { type: 'IHDR', data: new Uint8Array(12) },
      { type: 'IDAT', data: makeMinimalDeflateIdat() },
      { type: 'IEND', data: new Uint8Array(0) },
    ]);

    expect(() => validatePngOrThrow(badIhdrLength)).toThrow(MalformedIhdrError);
  });

  it('throws MalformedIhdrError on unsupported compression method', () => {
    const badComp = buildPngFromChunks([
      { type: 'IHDR', data: makeIhdrData({ compressionMethod: 1 }) },
      { type: 'IDAT', data: makeMinimalDeflateIdat() },
      { type: 'IEND', data: new Uint8Array(0) },
    ]);

    expect(() => validatePngOrThrow(badComp)).toThrow(MalformedIhdrError);
  });

  it('throws MalformedIhdrError on unsupported filter method', () => {
    const badFilter = buildPngFromChunks([
      { type: 'IHDR', data: makeIhdrData({ filterMethod: 1 }) },
      { type: 'IDAT', data: makeMinimalDeflateIdat() },
      { type: 'IEND', data: new Uint8Array(0) },
    ]);

    expect(() => validatePngOrThrow(badFilter)).toThrow(MalformedIhdrError);
  });

  it('throws MalformedIhdrError on unsupported interlace method', () => {
    const badInterlace = buildPngFromChunks([
      { type: 'IHDR', data: makeIhdrData({ interlaceMethod: 2 }) },
      { type: 'IDAT', data: makeMinimalDeflateIdat() },
      { type: 'IEND', data: new Uint8Array(0) },
    ]);

    expect(() => validatePngOrThrow(badInterlace)).toThrow(MalformedIhdrError);
  });

  it('throws UnsupportedColorTypeError on invalid color type or bit depth', () => {
    // Color type 1 does not exist in PNG spec
    const invalidColorType = buildPngFromChunks([
      { type: 'IHDR', data: makeIhdrData({ colorType: 1 }) },
      { type: 'IDAT', data: makeMinimalDeflateIdat() },
      { type: 'IEND', data: new Uint8Array(0) },
    ]);

    expect(() => validatePngOrThrow(invalidColorType)).toThrow(UnsupportedColorTypeError);

    // RGB with bit depth 4 (only 8, 16 allowed)
    const invalidBitDepth = buildPngFromChunks([
      { type: 'IHDR', data: makeIhdrData({ colorType: 2, bitDepth: 4 }) },
      { type: 'IDAT', data: makeMinimalDeflateIdat() },
      { type: 'IEND', data: new Uint8Array(0) },
    ]);

    expect(() => validatePngOrThrow(invalidBitDepth)).toThrow(UnsupportedColorTypeError);
  });

  it('throws UnsupportedColorTypeError when color type disallowed by limits', () => {
    const png = createValidPng({ width: 10, height: 10, colorType: 3 }); // Indexed
    expect(() => validatePngOrThrow(png, { allowedColorTypes: [2, 6] })).toThrow(
      UnsupportedColorTypeError,
    );
  });

  it('throws MalformedChunkError on non-consecutive IDAT chunks', () => {
    const nonConsecutivePng = createNonConsecutiveIdatVector();
    expect(() => validatePngOrThrow(nonConsecutivePng)).toThrow(MalformedChunkError);
  });

  it('throws MalformedChunkError when IEND has length > 0', () => {
    const badIend = buildPngFromChunks([
      { type: 'IHDR', data: makeIhdrData() },
      { type: 'IDAT', data: makeMinimalDeflateIdat() },
      { type: 'IEND', data: new Uint8Array([0x01]) },
    ]);

    expect(() => validatePngOrThrow(badIend)).toThrow(MalformedChunkError);
  });

  it('throws MalformedChunkError on corrupted IHDR CRC', () => {
    const corruptedIhdrCrc = createCorruptedCrcVector('ihdr-crc');
    expect(() => validatePngOrThrow(corruptedIhdrCrc)).toThrow(MalformedChunkError);
  });

  it('throws MalformedChunkError on corrupted IDAT data byte', () => {
    const corruptedIdat = createCorruptedCrcVector('idat-data');
    expect(() => validatePngOrThrow(corruptedIdat)).toThrow(MalformedChunkError);
  });

  it('throws MalformedChunkError on corrupted chunk type byte', () => {
    const corruptedType = createCorruptedCrcVector('chunk-type');
    expect(() => validatePngOrThrow(corruptedType)).toThrow(MalformedChunkError);
  });

  it('throws MissingIendError when stream terminates without IEND', () => {
    const noIend = buildPngFromChunks([
      { type: 'IHDR', data: makeIhdrData() },
      { type: 'IDAT', data: makeMinimalDeflateIdat() },
    ]);

    expect(() => validatePngOrThrow(noIend)).toThrow(MissingIendError);
  });

  it('throws FileSizeLimitExceededError when file exceeds limits', () => {
    const png = createValidPng({ width: 10, height: 10 });
    expect(() => validatePngOrThrow(png, { maxFileSize: 20 })).toThrow(FileSizeLimitExceededError);
    expect(() => validatePngOrThrow(png, { maxFileSizeBytes: 20 })).toThrow(
      FileSizeLimitExceededError,
    );
  });

  it('crc32 standard test vectors and slice parameters', () => {
    // 1. Empty buffer -> 0
    expect(crc32(new Uint8Array(0))).toBe(0);

    // 2. Standard ASCII vector "123456789" -> 0xCBF43926 = 3421780262
    const ascii = new TextEncoder().encode('123456789');
    expect(crc32(ascii)).toBe(0xcbf43926);

    // 3. Slice parameters start and end
    const padded = new Uint8Array([0x00, 0x00, ...ascii, 0xff, 0xff]);
    expect(crc32(padded, 2, 2 + ascii.length)).toBe(0xcbf43926);
  });
});
