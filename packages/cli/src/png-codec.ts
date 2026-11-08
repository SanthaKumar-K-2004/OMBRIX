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

  // Chunks:
  // Signature: 8 bytes
  // IHDR: 4 (len) + 4 (type) + 13 (data) + 4 (crc) = 25 bytes
  // IDAT: 4 (len) + 4 (type) + deflated.length + 4 (crc) = 12 + deflated.length bytes
  // IEND: 4 (len) + 4 (type) + 0 + 4 (crc) = 12 bytes
  const totalLength = 8 + 25 + (12 + deflated.length) + 12;
  const png = new Uint8Array(totalLength);

  // 1. Signature
  png.set(PNG_SIGNATURE, 0);
  let offset = 8;

  // 2. IHDR Chunk
  const ihdrLen = 13;
  writeUint32BE(png, offset, ihdrLen);
  offset += 4;
  const ihdrStart = offset;
  png[offset++] = 0x49; // 'I'
  png[offset++] = 0x48; // 'H'
  png[offset++] = 0x44; // 'D'
  png[offset++] = 0x52; // 'R'
  writeUint32BE(png, offset, width);
  offset += 4;
  writeUint32BE(png, offset, height);
  offset += 4;
  png[offset++] = 8; // bit depth: 8
  png[offset++] = 6; // color type: 6 (RGBA)
  png[offset++] = 0; // compression: deflate
  png[offset++] = 0; // filter: standard
  png[offset++] = 0; // interlace: none
  const ihdrCrc = crc32(png, ihdrStart, offset);
  writeUint32BE(png, offset, ihdrCrc);
  offset += 4;

  // 3. IDAT Chunk
  writeUint32BE(png, offset, deflated.length);
  offset += 4;
  const idatStart = offset;
  png[offset++] = 0x49; // 'I'
  png[offset++] = 0x44; // 'D'
  png[offset++] = 0x41; // 'A'
  png[offset++] = 0x54; // 'T'
  png.set(deflated, offset);
  offset += deflated.length;
  const idatCrc = crc32(png, idatStart, offset);
  writeUint32BE(png, offset, idatCrc);
  offset += 4;

  // 4. IEND Chunk
  writeUint32BE(png, offset, 0);
  offset += 4;
  const iendStart = offset;
  png[offset++] = 0x49; // 'I'
  png[offset++] = 0x45; // 'E'
  png[offset++] = 0x4e; // 'N'
  png[offset++] = 0x44; // 'D'
  const iendCrc = crc32(png, iendStart, offset);
  writeUint32BE(png, offset, iendCrc);
  offset += 4;

  return png;
}

/**
 * Decodes standard PNG bytes into CarrierImage (RGBA).
 */
export function decodePng(pngBytes: Uint8Array): CarrierImage {
  if (!isPng(pngBytes)) {
    throw new Error('Invalid PNG image: header signature mismatch');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
  const idatChunks: Uint8Array[] = [];

  while (offset < pngBytes.length) {
    if (offset + 8 > pngBytes.length) break;
    const length = readUint32BE(pngBytes, offset);
    offset += 4;
    const typeStr = String.fromCharCode(
      pngBytes[offset] ?? 0,
      pngBytes[offset + 1] ?? 0,
      pngBytes[offset + 2] ?? 0,
      pngBytes[offset + 3] ?? 0,
    );
    offset += 4;

    if (typeStr === 'IHDR') {
      width = readUint32BE(pngBytes, offset);
      height = readUint32BE(pngBytes, offset + 4);
      colorType = pngBytes[offset + 9] ?? 6;
      offset += length;
    } else if (typeStr === 'IDAT') {
      idatChunks.push(pngBytes.subarray(offset, offset + length));
      offset += length;
    } else if (typeStr === 'IEND') {
      offset += length + 4;
      break;
    } else {
      offset += length;
    }

    // Skip CRC
    offset += 4;
  }

  if (width === 0 || height === 0) {
    throw new Error('Malformed PNG: Missing or invalid IHDR chunk');
  }

  // Concatenate IDAT chunks
  const totalIdatLen = idatChunks.reduce((acc, c) => acc + c.length, 0);
  const combinedIdat = new Uint8Array(totalIdatLen);
  let idatOffset = 0;
  for (const chunk of idatChunks) {
    combinedIdat.set(chunk, idatOffset);
    idatOffset += chunk.length;
  }

  const inflated = inflateSync(combinedIdat);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const bpp = channels;
  const scanlineLen = width * bpp;

  const rawPixels = new Uint8Array(height * scanlineLen);
  let inflatedOffset = 0;

  // Unfilter scanlines
  for (let y = 0; y < height; y++) {
    const filter = inflated[inflatedOffset++] ?? 0;
    const rowStart = y * scanlineLen;
    const priorRowStart = (y - 1) * scanlineLen;

    for (let x = 0; x < scanlineLen; x++) {
      const filtVal = inflated[inflatedOffset++] ?? 0;
      const left = x >= bpp ? (rawPixels[rowStart + x - bpp] ?? 0) : 0;
      const up = y > 0 ? (rawPixels[priorRowStart + x] ?? 0) : 0;
      const upLeft = y > 0 && x >= bpp ? (rawPixels[priorRowStart + x - bpp] ?? 0) : 0;

      let recon = 0;
      switch (filter) {
        case 0: // None
          recon = filtVal;
          break;
        case 1: // Sub
          recon = (filtVal + left) & 0xff;
          break;
        case 2: // Up
          recon = (filtVal + up) & 0xff;
          break;
        case 3: // Average
          recon = (filtVal + Math.floor((left + up) / 2)) & 0xff;
          break;
        case 4: // Paeth
          recon = (filtVal + paethPredictor(left, up, upLeft)) & 0xff;
          break;
        default:
          recon = filtVal;
      }
      rawPixels[rowStart + x] = recon;
    }
  }

  // Convert to RGBA
  const rgbaData = new Uint8ClampedArray(width * height * 4);
  let outIdx = 0;
  let inIdx = 0;

  for (let i = 0; i < width * height; i++) {
    if (colorType === 6) {
      // RGBA
      rgbaData[outIdx++] = rawPixels[inIdx++] ?? 0;
      rgbaData[outIdx++] = rawPixels[inIdx++] ?? 0;
      rgbaData[outIdx++] = rawPixels[inIdx++] ?? 0;
      rgbaData[outIdx++] = rawPixels[inIdx++] ?? 255;
    } else if (colorType === 2) {
      // RGB
      rgbaData[outIdx++] = rawPixels[inIdx++] ?? 0;
      rgbaData[outIdx++] = rawPixels[inIdx++] ?? 0;
      rgbaData[outIdx++] = rawPixels[inIdx++] ?? 0;
      rgbaData[outIdx++] = 255;
    } else {
      // Grayscale
      const gray = rawPixels[inIdx++] ?? 0;
      rgbaData[outIdx++] = gray;
      rgbaData[outIdx++] = gray;
      rgbaData[outIdx++] = gray;
      rgbaData[outIdx++] = 255;
    }
  }

  return { width, height, data: rgbaData };
}
