import { crc32 } from '../../src/crc32.js';

export const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface ChunkSpec {
  type: string;
  data: Uint8Array;
  /** Explicit custom CRC override. If undefined, computed automatically. */
  crc?: number;
}

export interface IhdrOptions {
  width?: number;
  height?: number;
  bitDepth?: number;
  colorType?: number;
  compressionMethod?: number;
  filterMethod?: number;
  interlaceMethod?: number;
}

/**
 * Creates a 13-byte standard IHDR data payload.
 */
export function makeIhdrData(options: IhdrOptions = {}): Uint8Array {
  const {
    width = 1,
    height = 1,
    bitDepth = 8,
    colorType = 6, // RGBA
    compressionMethod = 0,
    filterMethod = 0,
    interlaceMethod = 0,
  } = options;

  const buffer = new Uint8Array(13);
  const view = new DataView(buffer.buffer);
  view.setUint32(0, width, false);
  view.setUint32(4, height, false);
  view.setUint8(8, bitDepth);
  view.setUint8(9, colorType);
  view.setUint8(10, compressionMethod);
  view.setUint8(11, filterMethod);
  view.setUint8(12, interlaceMethod);
  return buffer;
}

/**
 * Minimal valid Deflate stream (zlib uncompressed block) for a 1x1 RGBA pixel.
 */
export function makeMinimalDeflateIdat(): Uint8Array {
  // zlib header (0x78, 0x01), BFINAL=1 BTYPE=00 (0x01), LEN=5, NLEN=~5, filter=0 + RGBA (0,0,0,255), adler32
  return new Uint8Array([
    0x78, 0x01, 0x01, 0x05, 0x00, 0xfa, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0x01, 0x04, 0x01, 0x00,
  ]);
}

/**
 * Low-level assembler for assembling chunks into a complete PNG buffer.
 */
export function buildPngFromChunks(
  chunks: ChunkSpec[],
  customSignature: Uint8Array = PNG_SIGNATURE,
): Uint8Array {
  let totalLength = customSignature.length;
  for (const chunk of chunks) {
    totalLength += 4 + 4 + chunk.data.length + 4; // length + type + data + crc
  }

  const result = new Uint8Array(totalLength);
  result.set(customSignature, 0);

  let offset = customSignature.length;
  const view = new DataView(result.buffer);

  for (const chunk of chunks) {
    // 1. Length (4 bytes Big-Endian)
    view.setUint32(offset, chunk.data.length, false);
    offset += 4;

    // 2. Type (4 ASCII bytes)
    const typeOffset = offset;
    for (let i = 0; i < 4; i++) {
      result[offset + i] = chunk.type.charCodeAt(i);
    }
    offset += 4;

    // 3. Data
    result.set(chunk.data, offset);
    offset += chunk.data.length;

    // 4. CRC32 (computed over type + data unless overridden)
    const chunkCrc = chunk.crc !== undefined ? chunk.crc : crc32(result, typeOffset, offset);
    view.setUint32(offset, chunkCrc, false);
    offset += 4;
  }

  return result;
}

/**
 * Convenience helper to create a valid static PNG buffer of any dimension and color type.
 */
export function createValidPng(
  options: {
    width?: number;
    height?: number;
    colorType?: number;
    bitDepth?: number;
    idatPayload?: Uint8Array;
    extraChunks?: ChunkSpec[];
    interlaceMethod?: number;
  } = {},
): Uint8Array {
  const ihdrData = makeIhdrData({
    width: options.width ?? 10,
    height: options.height ?? 10,
    colorType: options.colorType ?? 6,
    bitDepth: options.bitDepth ?? 8,
    interlaceMethod: options.interlaceMethod ?? 0,
  });

  const idatData = options.idatPayload ?? makeMinimalDeflateIdat();

  const chunks: ChunkSpec[] = [
    { type: 'IHDR', data: ihdrData },
    ...(options.extraChunks ?? []),
    { type: 'IDAT', data: idatData },
    { type: 'IEND', data: new Uint8Array(0) },
  ];

  return buildPngFromChunks(chunks);
}

/**
 * Helper to generate APNG vectors injecting acTL, fcTL, or fdAT animation chunks.
 */
export function createApngVector(
  chunkType: 'acTL' | 'fcTL' | 'fdAT',
  position: 'before-idat' | 'after-idat' = 'before-idat',
): Uint8Array {
  const ihdr = { type: 'IHDR', data: makeIhdrData({ width: 50, height: 50 }) };
  const idat = { type: 'IDAT', data: makeMinimalDeflateIdat() };
  const iend = { type: 'IEND', data: new Uint8Array(0) };

  const animData =
    chunkType === 'acTL'
      ? new Uint8Array(8)
      : chunkType === 'fcTL'
        ? new Uint8Array(26)
        : new Uint8Array(8);

  const animChunk: ChunkSpec = { type: chunkType, data: animData };

  const chunks: ChunkSpec[] =
    position === 'before-idat' ? [ihdr, animChunk, idat, iend] : [ihdr, idat, animChunk, iend];

  return buildPngFromChunks(chunks);
}

/**
 * Helper to generate decompression bomb vectors.
 */
export function createDecompressionBombVector(options: {
  width?: number;
  height?: number;
  idatLength?: number;
}): Uint8Array {
  const { width = 5000, height = 5000, idatLength = 10 } = options;
  const ihdr = {
    type: 'IHDR',
    data: makeIhdrData({ width, height, colorType: 6, bitDepth: 8 }),
  };
  const idat = { type: 'IDAT', data: new Uint8Array(idatLength) };
  const iend = { type: 'IEND', data: new Uint8Array(0) };

  return buildPngFromChunks([ihdr, idat, iend]);
}

/**
 * Helper to create corrupted CRC vectors without non-null assertions.
 */
export function createCorruptedCrcVector(
  target: 'ihdr-data' | 'ihdr-crc' | 'idat-data' | 'chunk-type',
): Uint8Array {
  const png = createValidPng({ width: 10, height: 10 });

  if (target === 'ihdr-data') {
    // IHDR data starts at offset 8 (sig) + 4 (len) + 4 (type) = 16
    const b = png[16] ?? 0;
    png[16] = b ^ 0xff;
  } else if (target === 'ihdr-crc') {
    // IHDR CRC is at offset 16 + 13 = 29
    const b = png[29] ?? 0;
    png[29] = b ^ 0xff;
  } else if (target === 'idat-data') {
    // Past IHDR (33 bytes) + 8 (IDAT header: length + type) = 41
    const idatOffset = 41;
    const b = png[idatOffset] ?? 0;
    png[idatOffset] = b ^ 0xff;
  } else if (target === 'chunk-type') {
    // Byte 12 is 'I' in 'IHDR', change to 'J'
    png[12] = 'J'.charCodeAt(0);
  }

  return png;
}

/**
 * Helper to construct non-consecutive IDAT vectors (IDAT -> tEXt -> IDAT).
 */
export function createNonConsecutiveIdatVector(): Uint8Array {
  const ihdr = { type: 'IHDR', data: makeIhdrData({ width: 10, height: 10 }) };
  const idat1 = { type: 'IDAT', data: new Uint8Array(20) };
  const textChunk = {
    type: 'tEXt',
    data: new TextEncoder().encode('Comment\0OMBRIX'),
  };
  const idat2 = { type: 'IDAT', data: new Uint8Array(20) };
  const iend = { type: 'IEND', data: new Uint8Array(0) };

  return buildPngFromChunks([ihdr, idat1, textChunk, idat2, iend]);
}
