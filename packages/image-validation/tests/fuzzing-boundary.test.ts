import { describe, expect, it } from 'vitest';
import {
  DecompressionBombDetectedError,
  DimensionOutOfBoundsError,
  FileSizeLimitExceededError,
  ImageValidationError,
  InvalidSignatureError,
  MalformedChunkError,
  PixelCountLimitExceededError,
  TruncatedFileError,
  validatePng,
  validatePngOrThrow,
} from '../src/index.js';
import {
  buildPngFromChunks,
  createValidPng,
  makeIhdrData,
  makeMinimalDeflateIdat,
} from './helpers/png-builder.js';

describe('Milestone 1 Challenger 2: Fuzzing & Boundary Testing', () => {
  describe('Boundary Condition Tests', () => {
    describe('Width & Height boundaries: 0, 1, 4096, 4097', () => {
      it('rejects width = 0 with DimensionOutOfBoundsError', () => {
        const ihdrData = makeIhdrData({ width: 0, height: 10 });
        const png = buildPngFromChunks([
          { type: 'IHDR', data: ihdrData },
          { type: 'IDAT', data: makeMinimalDeflateIdat() },
          { type: 'IEND', data: new Uint8Array(0) },
        ]);

        const result = validatePng(png);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBeInstanceOf(DimensionOutOfBoundsError);
        }
      });

      it('rejects height = 0 with DimensionOutOfBoundsError', () => {
        const ihdrData = makeIhdrData({ width: 10, height: 0 });
        const png = buildPngFromChunks([
          { type: 'IHDR', data: ihdrData },
          { type: 'IDAT', data: makeMinimalDeflateIdat() },
          { type: 'IEND', data: new Uint8Array(0) },
        ]);

        const result = validatePng(png);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBeInstanceOf(DimensionOutOfBoundsError);
        }
      });

      it('accepts width = 1 and height = 1 (minimal positive boundary)', () => {
        const png = createValidPng({ width: 1, height: 1 });
        const result = validatePng(png);
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.metadata.width).toBe(1);
          expect(result.metadata.height).toBe(1);
        }
      });

      it('accepts width = 4096 and height = 10 (exact max dimension boundary)', () => {
        const png = createValidPng({ width: 4096, height: 10 });
        const result = validatePng(png, { maxWidth: 4096, maxHeight: 4096 });
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.metadata.width).toBe(4096);
          expect(result.metadata.height).toBe(10);
        }
      });

      it('accepts height = 4096 and width = 10 (exact max dimension boundary)', () => {
        const png = createValidPng({ width: 10, height: 4096 });
        const result = validatePng(png, { maxWidth: 4096, maxHeight: 4096 });
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.metadata.width).toBe(10);
          expect(result.metadata.height).toBe(4096);
        }
      });

      it('rejects width = 4097 with DimensionOutOfBoundsError when maxWidth: 4096', () => {
        const png = createValidPng({ width: 4097, height: 10 });
        const result = validatePng(png, { maxWidth: 4096 });
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBeInstanceOf(DimensionOutOfBoundsError);
        }
      });

      it('rejects height = 4097 with DimensionOutOfBoundsError when maxHeight: 4096', () => {
        const png = createValidPng({ width: 10, height: 4097 });
        const result = validatePng(png, { maxHeight: 4096 });
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBeInstanceOf(DimensionOutOfBoundsError);
        }
      });

      it('default limits reject width 4097 without explicit options', () => {
        const png = createValidPng({ width: 4097, height: 10 });
        const resultWithDefaults = validatePng(png);
        expect(resultWithDefaults.valid).toBe(false);
        if (!resultWithDefaults.valid) {
          expect(resultWithDefaults.error).toBeInstanceOf(DimensionOutOfBoundsError);
          expect(resultWithDefaults.error.code).toBe('DIMENSION_OUT_OF_BOUNDS');
        }
      });
    });

    describe('Pixel Area Limits: 12,000,000 vs 12,000,001 vs 12,004,000', () => {
      it('accepts exact 12,000,000 pixels (4000 x 3000) under maxPixels: 12_000_000', () => {
        // RGB (bpp=24): raw scanline = 1 + 12000 = 12001. Raw uncompressed = 36,003,000 bytes.
        // Provide adequate IDAT (80 KB) so expansion ratio is ~450:1 (< 500).
        const png = createValidPng({
          width: 4000,
          height: 3000,
          colorType: 2,
          bitDepth: 8,
          idatPayload: new Uint8Array(80 * 1024),
        });

        const result = validatePng(png, {
          maxWidth: 4096,
          maxHeight: 4096,
          maxPixels: 12_000_000,
          maxUncompressedBytes: 64 * 1024 * 1024,
          maxDecompressionRatio: 500,
        });

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.metadata.totalPixels).toBe(12_000_000);
        }
      });

      it('rejects 12,004,000 pixels (4000 x 3001) under maxPixels: 12_000_000', () => {
        const png = createValidPng({
          width: 4000,
          height: 3001,
          colorType: 2,
          bitDepth: 8,
          idatPayload: new Uint8Array(80 * 1024),
        });

        const result = validatePng(png, {
          maxWidth: 4096,
          maxHeight: 4096,
          maxPixels: 12_000_000,
        });

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBeInstanceOf(PixelCountLimitExceededError);
          expect(result.error.code).toBe('PIXEL_COUNT_LIMIT_EXCEEDED');
        }
      });

      it('rejects 12,001,280 pixels (4096 x 2930) under maxPixels: 12_000_000', () => {
        const png = createValidPng({
          width: 4096,
          height: 2930,
          colorType: 2,
          bitDepth: 8,
          idatPayload: new Uint8Array(80 * 1024),
        });

        const result = validatePng(png, {
          maxWidth: 4096,
          maxHeight: 4096,
          maxPixels: 12_000_000,
        });

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBeInstanceOf(PixelCountLimitExceededError);
        }
      });

      it('default limits reject 12,004,000 pixels without explicit options', () => {
        const png = createValidPng({
          width: 4000,
          height: 3001,
          colorType: 2,
          bitDepth: 8,
          idatPayload: new Uint8Array(80 * 1024),
        });

        const result = validatePng(png);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBeInstanceOf(PixelCountLimitExceededError);
          expect(result.error.code).toBe('PIXEL_COUNT_LIMIT_EXCEEDED');
        }
      });
    });

    describe('File Size Boundaries: 15,728,640 bytes (15 MiB) vs 15,728,641 bytes', () => {
      it('accepts exact 15,728,640 bytes (15 MiB boundary) under maxFileSize: 15_728_640', () => {
        // Base PNG overhead without IDAT data payload:
        // Sig (8) + IHDR (25) + IDAT header & CRC (12) + IEND (12) = 57 bytes
        const targetFileSize = 15 * 1024 * 1024; // 15,728,640
        const idatPayloadLength = targetFileSize - 57;
        const exactPng = createValidPng({
          width: 10,
          height: 10,
          idatPayload: new Uint8Array(idatPayloadLength),
        });

        expect(exactPng.length).toBe(targetFileSize);

        const result = validatePng(exactPng, { maxFileSize: targetFileSize });
        expect(result.valid).toBe(true);
      });

      it('rejects 15,728,641 bytes (15 MiB + 1 byte) under maxFileSize: 15_728_640', () => {
        const targetFileSize = 15 * 1024 * 1024; // 15,728,640
        const idatPayloadLength = targetFileSize - 57 + 1; // 15,728,584
        const overPng = createValidPng({
          width: 10,
          height: 10,
          idatPayload: new Uint8Array(idatPayloadLength),
        });

        expect(overPng.length).toBe(targetFileSize + 1);

        const result = validatePng(overPng, { maxFileSize: targetFileSize });
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBeInstanceOf(FileSizeLimitExceededError);
          expect(result.error.code).toBe('FILE_SIZE_LIMIT_EXCEEDED');
        }
      });

      it('default limits reject 15,728,641 bytes without explicit options', () => {
        const targetFileSize = 15 * 1024 * 1024;
        const idatPayloadLength = targetFileSize - 57 + 1;
        const overPng = createValidPng({
          width: 10,
          height: 10,
          idatPayload: new Uint8Array(idatPayloadLength),
        });

        const result = validatePng(overPng);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBeInstanceOf(FileSizeLimitExceededError);
          expect(result.error.code).toBe('FILE_SIZE_LIMIT_EXCEEDED');
        }
      });
    });

    describe('Uncompressed Memory (Raw Raster) Boundaries: 64 MiB (67,108,864 bytes)', () => {
      it('accepts exact 67,108,864 bytes raw raster when maxUncompressedBytes: 67_108_864', () => {
        // RGB 8-bit (bpp=24): width=5461 -> rawScanline = 1 + 5461 * 3 = 16384 bytes.
        // height = 4096. 4096 * 16384 = 67,108,864 bytes EXACTLY (64 MiB).
        // Provide sufficient IDAT (150 KB) so expansion ratio is ~447:1 (< 500).
        const png = createValidPng({
          width: 5461,
          height: 4096,
          colorType: 2,
          bitDepth: 8,
          idatPayload: new Uint8Array(150 * 1024),
        });

        const result = validatePng(png, {
          maxWidth: 6000,
          maxHeight: 5000,
          maxPixels: 25_000_000,
          maxUncompressedBytes: 67_108_864,
          maxDecompressionRatio: 500,
        });

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.metadata.estimatedUncompressedBytes).toBe(67_108_864);
        }
      });

      it('rejects 1-byte overflow above maxUncompressedBytes with DecompressionBombDetectedError', () => {
        // RGB 8-bit (bpp=24): width=5461, height=4096 -> 67,108,864 bytes.
        // Limit set to 67_108_863 (1 byte less).
        const png = createValidPng({
          width: 5461,
          height: 4096,
          colorType: 2,
          bitDepth: 8,
          idatPayload: new Uint8Array(150 * 1024),
        });

        const result = validatePng(png, {
          maxWidth: 6000,
          maxHeight: 5000,
          maxPixels: 25_000_000,
          maxUncompressedBytes: 67_108_863, // 1 byte below raw raster
          maxDecompressionRatio: 500,
        });

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBeInstanceOf(DecompressionBombDetectedError);
          expect(result.error.code).toBe('DECOMPRESSION_BOMB_DETECTED');
        }
      });

      it('rejects 4096 x 4096 RGBA image (67,112,960 bytes raw raster) exceeding 64 MiB default', () => {
        // RGBA 8-bit (bpp=32): rawScanline = 1 + 4096 * 4 = 16385 bytes.
        // 4096 lines = 67,112,960 bytes (> 67,108,864 bytes by 4,096 bytes).
        const png = createValidPng({
          width: 4096,
          height: 4096,
          colorType: 6,
          bitDepth: 8,
          idatPayload: new Uint8Array(200 * 1024),
        });

        const result = validatePng(png, {
          maxWidth: 4096,
          maxHeight: 4096,
          maxPixels: 20_000_000,
          maxUncompressedBytes: 64 * 1024 * 1024,
        });

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBeInstanceOf(DecompressionBombDetectedError);
        }
      });
    });
  });

  describe('Mutation Fuzzing & Crash Resilience', () => {
    it('gracefully handles bit flips across standard PNG signature bytes (0..7)', () => {
      const basePng = createValidPng({ width: 10, height: 10 });
      for (let byteIdx = 0; byteIdx < 8; byteIdx++) {
        for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
          const mutated = new Uint8Array(basePng);
          const currentByte = mutated[byteIdx] ?? 0;
          mutated[byteIdx] = currentByte ^ (1 << bitIdx);

          const result = validatePng(mutated);
          expect(result.valid).toBe(false);
          if (!result.valid) {
            expect(result.error).toBeInstanceOf(ImageValidationError);
            expect(result.error).toBeInstanceOf(InvalidSignatureError);
            expect(result.error.code).toBe('INVALID_SIGNATURE');
          }
        }
      }
    });

    it('gracefully handles bit flips in IHDR chunk header, fields, and CRC', () => {
      const basePng = createValidPng({ width: 10, height: 10 });
      // IHDR chunk spans from offset 8 to offset 33 (length: 4, type: 4, data: 13, crc: 4 = 25 bytes)
      for (let offset = 8; offset < 33; offset++) {
        const mutated = new Uint8Array(basePng);
        const currentByte = mutated[offset] ?? 0;
        mutated[offset] = currentByte ^ 0xff; // Flip all bits

        const result = validatePng(mutated);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBeInstanceOf(ImageValidationError);
        }

        expect(() => validatePngOrThrow(mutated)).toThrow(ImageValidationError);
      }
    });

    it('gracefully handles bit flips in IDAT chunk header, payload, and CRC', () => {
      const basePng = createValidPng({ width: 10, height: 10 });
      // IDAT chunk begins after IHDR (offset 33)
      const idatStart = 33;
      const idatEnd = basePng.length - 12; // before IEND

      for (let offset = idatStart; offset < idatEnd; offset++) {
        const mutated = new Uint8Array(basePng);
        const currentByte = mutated[offset] ?? 0;
        mutated[offset] = currentByte ^ 0xaa;

        const result = validatePng(mutated);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBeInstanceOf(ImageValidationError);
        }
        expect(() => validatePngOrThrow(mutated)).toThrow(ImageValidationError);
      }
    });

    it('gracefully handles bit flips in IEND chunk header and CRC', () => {
      const basePng = createValidPng({ width: 10, height: 10 });
      const iendStart = basePng.length - 12;

      for (let offset = iendStart; offset < basePng.length; offset++) {
        const mutated = new Uint8Array(basePng);
        const currentByte = mutated[offset] ?? 0;
        mutated[offset] = currentByte ^ 0x55;

        const result = validatePng(mutated);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBeInstanceOf(ImageValidationError);
        }
        expect(() => validatePngOrThrow(mutated)).toThrow(ImageValidationError);
      }
    });

    it('exhaustive mutation fuzzing: 500 pseudo-random multi-bit flips produce zero unhandled crashes', () => {
      const basePng = createValidPng({
        width: 16,
        height: 16,
        colorType: 6,
        bitDepth: 8,
      });

      // Pseudo-random deterministic LCG generator for reproducible fuzzing
      let seed = 0x1337c0de;
      function nextRand(): number {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0x100000000;
      }

      const totalMutations = 500;
      let handledErrorsCount = 0;

      for (let i = 0; i < totalMutations; i++) {
        const mutated = new Uint8Array(basePng);
        // Apply 1 to 5 random bit flips
        const flips = 1 + Math.floor(nextRand() * 5);
        for (let f = 0; f < flips; f++) {
          const targetByte = Math.floor(nextRand() * mutated.length);
          const targetBit = Math.floor(nextRand() * 8);
          const currentByte = mutated[targetByte] ?? 0;
          mutated[targetByte] = currentByte ^ (1 << targetBit);
        }

        let result: ReturnType<typeof validatePng>;
        try {
          result = validatePng(mutated);
        } catch (unhandled) {
          throw new Error(
            `validatePng CRASHED with unhandled exception on mutation ${i}: ${String(unhandled)}`,
          );
        }

        expect(typeof result.valid).toBe('boolean');
        if (!result.valid) {
          expect(result.error).toBeInstanceOf(ImageValidationError);
          expect(typeof result.error.code).toBe('string');
          handledErrorsCount++;
        } else {
          console.log(`Mutation ${i} resulted in valid: true!`);
        }
      }

      console.log(
        `Fuzzing result: ${totalMutations} mutations tested, ${handledErrorsCount} caught cleanly by validatePng.`,
      );
      expect(handledErrorsCount).toBeGreaterThan(0);
    });

    it('handles truncated buffers of every possible length from 0 to N without crashing', () => {
      const basePng = createValidPng({ width: 8, height: 8 });
      for (let len = 0; len < basePng.length; len++) {
        const slice = basePng.subarray(0, len);
        let result: ReturnType<typeof validatePng>;
        try {
          result = validatePng(slice);
        } catch (unhandled) {
          throw new Error(
            `validatePng CRASHED on truncation at length ${len}: ${String(unhandled)}`,
          );
        }

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBeInstanceOf(ImageValidationError);
        }
      }
    });

    it('handles adversarial chunk lengths: 0, 0x7fffffff, 0x80000000, 0xffffffff', () => {
      // Chunk length 0x80000000 (> 2^31 - 1)
      const chunkOverflow = buildPngFromChunks([
        { type: 'IHDR', data: makeIhdrData() },
        { type: 'IDAT', data: makeMinimalDeflateIdat() },
        { type: 'IEND', data: new Uint8Array(0) },
      ]);
      const view = new DataView(chunkOverflow.buffer);
      view.setUint32(33, 0x80000000, false); // Mutate IDAT length

      const resOverflow = validatePng(chunkOverflow);
      expect(resOverflow.valid).toBe(false);
      if (!resOverflow.valid) {
        expect(resOverflow.error).toBeInstanceOf(MalformedChunkError);
      }

      // Chunk length 0xffffffff
      view.setUint32(33, 0xffffffff, false);
      const resMax = validatePng(chunkOverflow);
      expect(resMax.valid).toBe(false);
      if (!resMax.valid) {
        expect(resMax.error).toBeInstanceOf(MalformedChunkError);
      }

      // Chunk length 0x7fffffff (claims huge length within signed 32-bit, exceeding buffer)
      view.setUint32(33, 0x7fffffff, false);
      const resHuge = validatePng(chunkOverflow);
      expect(resHuge.valid).toBe(false);
      if (!resHuge.valid) {
        expect(resHuge.error).toBeInstanceOf(TruncatedFileError);
      }
    });
  });

  describe('Steganographic Carrier Leakage: Trailing Data Verification', () => {
    it('EMPIRICAL VULNERABILITY: trailing data after IEND is silently ignored instead of throwing TrailingDataError', () => {
      const validPng = createValidPng({ width: 10, height: 10 });
      const hiddenPayload = new TextEncoder().encode('LEAKED_STEGO_PAYLOAD_AFTER_IEND');
      const carrierWithLeak = new Uint8Array(validPng.length + hiddenPayload.length);
      carrierWithLeak.set(validPng, 0);
      carrierWithLeak.set(hiddenPayload, validPng.length);

      const result = validatePng(carrierWithLeak);

      // TrailingDataError is defined in errors.ts and exported in index.ts.
      // But in png.ts, the parser breaks out on IEND and never checks if offset < buffer.length.
      // As a result, carrierWithLeak is reported as valid: true!
      console.log('Trailing data test result (valid?):', result.valid);
      // We empirically record that trailing data is NOT rejected:
      expect(result.valid).toBe(true);
    });
  });
});
