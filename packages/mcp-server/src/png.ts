import { deflateSync, inflateSync } from 'node:zlib';
import { crc32, isPng } from '@ombrix/image-validation';
import type { CarrierImage } from '@ombrix/stego-interface';

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function writeUint32BE(target: Uint8Array, offset: number, value: number): void {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function readUint32BE(source: Uint8Array, offset: number): number {
  return (
    (((source[offset] ?? 0) << 24) |
      ((source[offset + 1] ?? 0) << 16) |
      ((source[offset + 2] ?? 0) << 8) |
      (source[offset + 3] ?? 0)) >>>
    0
  );
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Encodes a CarrierImage (RGBA) into standard PNG format.
 */
export function encodePng(carrier: CarrierImage): Uint8Array {
  const { width, height, data } = carrier;
  const bytesPerPixel = 4;
  const rowBytes = width * bytesPerPixel;
  const uncompressed = new Uint8Array(height * (1 + rowBytes));

  let inIdx = 0;
  let outIdx = 0;
  for (let y = 0; y < height; y++) {
    uncompressed[outIdx++] = 0; // Filter: None
    for (let x = 0; x < rowBytes; x++) {
      uncompressed[outIdx++] = data[inIdx++] ?? 0;
    }
  }

  const deflated = deflateSync(uncompressed);
  const totalLength = 8 + 25 + (12 + deflated.length) + 12;
  const png = new Uint8Array(totalLength);

  png.set(PNG_SIGNATURE, 0);

  // IHDR Chunk
  let pos = 8;
  writeUint32BE(png, pos, 13);
  pos += 4;
  png.set([0x49, 0x48, 0x44, 0x52], pos); // 'IHDR'
  pos += 4;
  writeUint32BE(png, pos, width);
  pos += 4;
  writeUint32BE(png, pos, height);
  pos += 4;
  png[pos++] = 8; // Bit depth: 8
  png[pos++] = 6; // Color type: 6 (RGBA)
  png[pos++] = 0; // Compression: Deflate
  png[pos++] = 0; // Filter: Adaptive
  png[pos++] = 0; // Interlace: None
  const ihdrCrc = crc32(png.subarray(12, 12 + 4 + 13));
  writeUint32BE(png, pos, ihdrCrc);
  pos += 4;

  // IDAT Chunk
  writeUint32BE(png, pos, deflated.length);
  pos += 4;
  const idatStart = pos;
  png.set([0x49, 0x44, 0x41, 0x54], pos); // 'IDAT'
  pos += 4;
  png.set(deflated, pos);
  pos += deflated.length;
  const idatCrc = crc32(png.subarray(idatStart, pos));
  writeUint32BE(png, pos, idatCrc);
  pos += 4;

  // IEND Chunk
  writeUint32BE(png, pos, 0);
  pos += 4;
  const iendStart = pos;
  png.set([0x49, 0x45, 0x4e, 0x44], pos); // 'IEND'
  pos += 4;
  const iendCrc = crc32(png.subarray(iendStart, pos));
  writeUint32BE(png, pos, iendCrc);

  return png;
}

/**
 * Decodes a standard PNG buffer into an uncompressed CarrierImage (RGBA).
 */
export function decodePng(buffer: Uint8Array): CarrierImage {
  if (!isPng(buffer)) {
    throw new Error('Invalid PNG: file header signature mismatch');
  }

  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatParts: Uint8Array[] = [];

  while (pos < buffer.length) {
    const length = readUint32BE(buffer, pos);
    pos += 4;
    const type = String.fromCharCode(
      buffer[pos] ?? 0,
      buffer[pos + 1] ?? 0,
      buffer[pos + 2] ?? 0,
      buffer[pos + 3] ?? 0,
    );
    pos += 4;

    const data = buffer.subarray(pos, pos + length);
    pos += length;
    pos += 4; // skip CRC

    if (type === 'IHDR') {
      width = readUint32BE(data, 0);
      height = readUint32BE(data, 4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;

      if (bitDepth !== 8) {
        throw new Error(`Unsupported PNG bit depth: ${bitDepth}. OMBRIX requires 8-bit channels.`);
      }
      if (colorType !== 6 && colorType !== 2) {
        throw new Error(
          `Unsupported PNG color type: ${colorType}. OMBRIX requires RGB (2) or RGBA (6).`,
        );
      }
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  const totalIdatLength = idatParts.reduce((acc, part) => acc + part.length, 0);
  const concatenatedIdat = new Uint8Array(totalIdatLength);
  let idatOffset = 0;
  for (const part of idatParts) {
    concatenatedIdat.set(part, idatOffset);
    idatOffset += part.length;
  }

  const decompressed = inflateSync(concatenatedIdat);
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const rowBytes = width * bytesPerPixel;
  const rgbaData = new Uint8ClampedArray(width * height * 4);

  let inOffset = 0;
  let prevRow: Uint8Array | null = null;
  const currentRow = new Uint8Array(rowBytes);

  for (let y = 0; y < height; y++) {
    const filterType = decompressed[inOffset++];

    for (let x = 0; x < rowBytes; x++) {
      const raw = decompressed[inOffset++] ?? 0;
      const a = x >= bytesPerPixel ? (currentRow[x - bytesPerPixel] ?? 0) : 0;
      const b = prevRow ? (prevRow[x] ?? 0) : 0;
      const c = prevRow && x >= bytesPerPixel ? (prevRow[x - bytesPerPixel] ?? 0) : 0;

      let val = raw;
      if (filterType === 1) {
        val = (raw + a) & 0xff;
      } else if (filterType === 2) {
        val = (raw + b) & 0xff;
      } else if (filterType === 3) {
        val = (raw + Math.floor((a + b) / 2)) & 0xff;
      } else if (filterType === 4) {
        val = (raw + paethPredictor(a, b, c)) & 0xff;
      }
      currentRow[x] = val;
    }

    let rowIdx = 0;
    const destRowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const pixelOffset = destRowOffset + x * 4;
      rgbaData[pixelOffset] = currentRow[rowIdx++] ?? 0;
      rgbaData[pixelOffset + 1] = currentRow[rowIdx++] ?? 0;
      rgbaData[pixelOffset + 2] = currentRow[rowIdx++] ?? 0;
      rgbaData[pixelOffset + 3] = colorType === 6 ? (currentRow[rowIdx++] ?? 255) : 255;
    }

    if (!prevRow) {
      prevRow = new Uint8Array(rowBytes);
    }
    prevRow.set(currentRow);
  }

  return {
    width,
    height,
    data: rgbaData,
  };
}
