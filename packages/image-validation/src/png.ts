import { crc32 } from './crc32.js';
import {
  AnimatedPngDetectedError,
  DecompressionBombDetectedError,
  DimensionOutOfBoundsError,
  FileSizeLimitExceededError,
  ImageValidationError,
  InvalidSignatureError,
  MalformedChunkError,
  MalformedIhdrError,
  MissingIdatChunkError,
  MissingIendError,
  MissingIhdrError,
  PixelCountLimitExceededError,
  TruncatedFileError,
  UnsupportedColorTypeError,
} from './errors.js';
import type {
  ImageValidationLimits,
  PngColorTypeName,
  PngMetadata,
  PngValidationLimits,
  ValidationResult,
} from './types.js';

export const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const DEFAULT_PNG_LIMITS = {
  maxFileSize: 15 * 1024 * 1024, // 15 MiB = 15,728,640 bytes
  maxWidth: 4096,
  maxHeight: 4096,
  maxPixels: 12_000_000,
  maxUncompressedBytes: 64 * 1024 * 1024, // 64 MiB = 67,108,864 bytes
  maxDecompressionRatio: 500,
};

interface ColorTypeSpec {
  name: PngColorTypeName;
  channels: number;
  hasAlpha: boolean;
  allowedDepths: number[];
}

const COLOR_TYPES: Record<number, ColorTypeSpec> = {
  0: { name: 'grayscale', channels: 1, hasAlpha: false, allowedDepths: [1, 2, 4, 8, 16] },
  2: { name: 'rgb', channels: 3, hasAlpha: false, allowedDepths: [8, 16] },
  3: { name: 'palette', channels: 1, hasAlpha: false, allowedDepths: [1, 2, 4, 8] },
  4: { name: 'grayscale-alpha', channels: 2, hasAlpha: true, allowedDepths: [8, 16] },
  6: { name: 'rgba', channels: 4, hasAlpha: true, allowedDepths: [8, 16] },
};

/**
 * Checks whether the first 8 bytes match the standard PNG signature.
 */
export function isPng(buffer: Uint8Array): boolean {
  if (buffer.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}

/**
 * Calculates raw uncompressed scanline bytes for an Adam7 interlaced PNG.
 */
function calculateAdam7Bytes(width: number, height: number, bitsPerPixel: number): number {
  const passes: ReadonlyArray<readonly [number, number, number, number]> = [
    [0, 0, 8, 8],
    [4, 0, 8, 8],
    [0, 4, 4, 8],
    [2, 0, 4, 4],
    [0, 2, 2, 4],
    [1, 0, 2, 2],
    [0, 1, 1, 2],
  ];
  let totalBytes = 0;
  for (const [x0, y0, dx, dy] of passes) {
    if (width > x0 && height > y0) {
      const passW = Math.floor((width - x0 + dx - 1) / dx);
      const passH = Math.floor((height - y0 + dy - 1) / dy);
      if (passW > 0 && passH > 0) {
        totalBytes += passH * (1 + Math.ceil((passW * bitsPerPixel) / 8));
      }
    }
  }
  return totalBytes;
}

/**
 * Validates a static PNG image buffer, throwing typed ImageValidationError on failure.
 */
export function validatePngOrThrow(
  buffer: Uint8Array,
  limits?: PngValidationLimits | ImageValidationLimits,
): PngMetadata {
  const legacy = limits as ImageValidationLimits | undefined;
  const effectiveLimits = {
    maxFileSize: limits?.maxFileSize ?? legacy?.maxFileSizeBytes ?? DEFAULT_PNG_LIMITS.maxFileSize,
    maxWidth: limits?.maxWidth ?? DEFAULT_PNG_LIMITS.maxWidth,
    maxHeight: limits?.maxHeight ?? DEFAULT_PNG_LIMITS.maxHeight,
    maxPixels: limits?.maxPixels ?? DEFAULT_PNG_LIMITS.maxPixels,
    maxUncompressedBytes:
      limits?.maxUncompressedBytes ??
      legacy?.maxRawRasterBytes ??
      DEFAULT_PNG_LIMITS.maxUncompressedBytes,
    maxDecompressionRatio:
      limits?.maxDecompressionRatio ??
      legacy?.maxExpansionRatio ??
      DEFAULT_PNG_LIMITS.maxDecompressionRatio,
    allowedColorTypes: legacy?.allowedColorTypes ?? [0, 2, 3, 4, 6],
  };

  // 1. Check file size bounds
  if (buffer.length > effectiveLimits.maxFileSize) {
    throw new FileSizeLimitExceededError(
      `File size (${buffer.length} bytes) exceeds maximum allowed size (${effectiveLimits.maxFileSize} bytes).`,
    );
  }

  // 2. Validate PNG magic signature
  if (buffer.length < 8) {
    throw new TruncatedFileError(
      'File is truncated: buffer length is less than the 8-byte PNG signature.',
    );
  }
  if (!isPng(buffer)) {
    throw new InvalidSignatureError(
      'Invalid PNG signature: magic bytes do not match PNG standard.',
    );
  }

  // Minimum PNG size: signature (8) + IHDR (25) + IEND (12) = 45 bytes
  if (buffer.length < 45) {
    throw new TruncatedFileError(
      'File is truncated: buffer length is smaller than minimal PNG structure.',
    );
  }

  // 3. Sequential chunk parser
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 8;
  const chunkTypes: string[] = [];
  let ihdr: {
    width: number;
    height: number;
    bitDepth: number;
    colorType: number;
    colorSpec: ColorTypeSpec;
    compressionMethod: number;
    filterMethod: number;
    interlaceMethod: 0 | 1;
    bitsPerPixel: number;
  } | null = null;

  let idatSeen = false;
  let idatEnded = false;
  let idatTotalBytes = 0;
  let hasIend = false;
  let chunkIndex = 0;

  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) {
      throw new TruncatedFileError(`Truncated PNG chunk header at offset ${offset}.`);
    }

    const length = view.getUint32(offset, false);
    offset += 4;

    if (length > 0x7fffffff) {
      throw new MalformedChunkError(`Chunk length at offset ${offset - 4} exceeds 2^31-1.`);
    }

    const type = String.fromCharCode(
      buffer[offset] ?? 0,
      buffer[offset + 1] ?? 0,
      buffer[offset + 2] ?? 0,
      buffer[offset + 3] ?? 0,
    );
    offset += 4;

    if (offset + length + 4 > buffer.length) {
      throw new TruncatedFileError(
        `Chunk "${type}" claims length ${length} bytes, exceeding remaining buffer size.`,
      );
    }

    const dataOffset = offset;
    offset += length;

    const chunkCrc = view.getUint32(offset, false);
    offset += 4;

    // Verify CRC (covers type + data)
    const computedCrc = crc32(buffer, dataOffset - 4, dataOffset + length);
    if (computedCrc !== chunkCrc) {
      throw new MalformedChunkError(
        `CRC32 mismatch in chunk "${type}": computed ${computedCrc.toString(16)}, got ${chunkCrc.toString(16)}.`,
      );
    }

    // Reject APNG animation chunks immediately
    if (type === 'acTL' || type === 'fcTL' || type === 'fdAT') {
      throw new AnimatedPngDetectedError(
        `Animated PNG detected (chunk "${type}"). Only static PNG carriers are permitted.`,
      );
    }

    // First chunk must be IHDR
    if (chunkIndex === 0 && type !== 'IHDR') {
      throw new MissingIhdrError(`First chunk must be IHDR, found "${type}".`);
    }

    if (type === 'IHDR') {
      if (ihdr !== null) {
        throw new MalformedIhdrError('Duplicate IHDR chunk found.');
      }
      if (length !== 13) {
        throw new MalformedIhdrError(`Invalid IHDR length: expected 13 bytes, got ${length}.`);
      }

      const width = view.getUint32(dataOffset, false);
      const height = view.getUint32(dataOffset + 4, false);
      const bitDepth = view.getUint8(dataOffset + 8);
      const colorType = view.getUint8(dataOffset + 9);
      const compressionMethod = view.getUint8(dataOffset + 10);
      const filterMethod = view.getUint8(dataOffset + 11);
      const interlaceMethod = view.getUint8(dataOffset + 12);

      if (width === 0 || height === 0) {
        throw new DimensionOutOfBoundsError(`Invalid zero dimension in IHDR: ${width}x${height}.`);
      }

      if (width > effectiveLimits.maxWidth || height > effectiveLimits.maxHeight) {
        throw new DimensionOutOfBoundsError(
          `Image dimensions (${width}x${height}) exceed maximum allowed (${effectiveLimits.maxWidth}x${effectiveLimits.maxHeight}).`,
        );
      }

      const totalPixels = width * height;
      if (totalPixels > effectiveLimits.maxPixels) {
        throw new PixelCountLimitExceededError(
          `Image pixel count (${totalPixels.toLocaleString()} px) exceeds maximum allowed (${effectiveLimits.maxPixels.toLocaleString()} px).`,
        );
      }

      if (compressionMethod !== 0) {
        throw new MalformedIhdrError(`Unsupported compression method: ${compressionMethod}.`);
      }

      if (filterMethod !== 0) {
        throw new MalformedIhdrError(`Unsupported filter method: ${filterMethod}.`);
      }

      if (interlaceMethod !== 0 && interlaceMethod !== 1) {
        throw new MalformedIhdrError(`Unsupported interlace method: ${interlaceMethod}.`);
      }

      const colorSpec = COLOR_TYPES[colorType];
      if (!colorSpec || !colorSpec.allowedDepths.includes(bitDepth)) {
        throw new UnsupportedColorTypeError(
          `Invalid color type (${colorType}) or bit depth (${bitDepth}) combination.`,
        );
      }

      if (!effectiveLimits.allowedColorTypes.includes(colorType)) {
        throw new UnsupportedColorTypeError(
          `Color type ${colorType} is not permitted by configuration.`,
        );
      }

      const bitsPerPixel = colorSpec.channels * bitDepth;

      ihdr = {
        width,
        height,
        bitDepth,
        colorType,
        colorSpec,
        compressionMethod,
        filterMethod,
        interlaceMethod: interlaceMethod as 0 | 1,
        bitsPerPixel,
      };
    } else if (type === 'IDAT') {
      if (idatEnded) {
        throw new MalformedChunkError('Non-consecutive IDAT chunk found in PNG stream.');
      }
      idatSeen = true;
      idatTotalBytes += length;
    } else if (type === 'IEND') {
      if (length !== 0) {
        throw new MalformedChunkError(`IEND chunk must have length 0, got ${length}.`);
      }
      hasIend = true;
      chunkTypes.push(type);
      break;
    } else {
      if (idatSeen && !idatEnded) {
        idatEnded = true;
      }
    }

    chunkTypes.push(type);
    chunkIndex++;
  }

  if (!ihdr) {
    throw new MissingIhdrError('Missing IHDR chunk in PNG stream.');
  }

  if (!hasIend) {
    throw new MissingIendError('Missing or truncated IEND chunk.');
  }

  if (!idatSeen || idatTotalBytes === 0) {
    throw new MissingIdatChunkError('PNG contains no IDAT image data chunks.');
  }

  // 4. Decompression bomb pre-check
  let estimatedUncompressedBytes: number;
  if (ihdr.interlaceMethod === 1) {
    estimatedUncompressedBytes = calculateAdam7Bytes(ihdr.width, ihdr.height, ihdr.bitsPerPixel);
  } else {
    const rawScanlineBytes = 1 + Math.ceil((ihdr.width * ihdr.bitsPerPixel) / 8);
    estimatedUncompressedBytes = ihdr.height * rawScanlineBytes;
  }

  if (estimatedUncompressedBytes > effectiveLimits.maxUncompressedBytes) {
    throw new DecompressionBombDetectedError(
      `Estimated uncompressed raw raster (${(estimatedUncompressedBytes / (1024 * 1024)).toFixed(1)} MiB) exceeds limit (${(effectiveLimits.maxUncompressedBytes / (1024 * 1024)).toFixed(1)} MiB).`,
    );
  }

  const expansionRatio = estimatedUncompressedBytes / idatTotalBytes;
  const minRatioThreshold = Math.min(10 * 1024 * 1024, effectiveLimits.maxUncompressedBytes);
  if (
    estimatedUncompressedBytes > minRatioThreshold &&
    expansionRatio > effectiveLimits.maxDecompressionRatio
  ) {
    throw new DecompressionBombDetectedError(
      `Decompression bomb detected: expansion ratio is ${Math.round(expansionRatio)}:1 (limit: ${effectiveLimits.maxDecompressionRatio}:1).`,
    );
  }

  return {
    width: ihdr.width,
    height: ihdr.height,
    bitDepth: ihdr.bitDepth,
    colorType: ihdr.colorType,
    colorTypeName: ihdr.colorSpec.name,
    channels: ihdr.colorSpec.channels,
    hasAlpha: ihdr.colorSpec.hasAlpha,
    interlaceMethod: ihdr.interlaceMethod,
    compressedSizeBytes: buffer.length,
    estimatedUncompressedBytes,
    totalPixels: ihdr.width * ihdr.height,
    chunkTypes,
  };
}

/**
 * Safe validator returning ValidationResult object without throwing.
 */
export function validatePng(
  buffer: Uint8Array,
  limits?: PngValidationLimits | ImageValidationLimits,
): ValidationResult {
  try {
    const metadata = validatePngOrThrow(buffer, limits);
    return { valid: true, metadata };
  } catch (error) {
    if (error instanceof ImageValidationError) {
      return { valid: false, error };
    }
    return {
      valid: false,
      error: new ImageValidationError(
        error instanceof Error ? error.message : String(error),
        'UNKNOWN_ERROR',
      ),
    };
  }
}

export const validatePngSafe = validatePng;
