import {
  type CapacityReport,
  type CarrierAnalysis,
  type CarrierImage,
  ExtractionError,
  InsufficientCapacityError,
  InvalidCarrierError,
  type StegoMethod,
  type StegoOptions,
  type StegoProgressCallback,
} from '@ombrix/stego-interface';
import type { PvdRange } from './types.js';

export const PVD_RANGES: readonly PvdRange[] = [
  { lower: 0, upper: 7, bits: 3 },
  { lower: 8, upper: 15, bits: 3 },
  { lower: 16, upper: 31, bits: 4 },
  { lower: 32, upper: 63, bits: 5 },
  { lower: 64, upper: 127, bits: 6 },
  { lower: 128, upper: 255, bits: 7 },
];

function findRange(diff: number): PvdRange {
  const d = Math.max(0, Math.min(255, Math.abs(diff)));
  for (const r of PVD_RANGES) {
    if (d >= r.lower && d <= r.upper) {
      return r;
    }
  }
  return PVD_RANGES[PVD_RANGES.length - 1]!;
}

export class PvdStegoMethod implements StegoMethod {
  public readonly id = 'stego-pvd';
  public readonly name = 'Pixel Value Differencing (Wu & Tsai 2003)';
  public readonly version = '1.0.0';
  public readonly description =
    'Spatial domain adaptive steganography partitioning adjacent pixel pairs and embedding variable bitrates according to human visual system edge masking.';

  public calculateCapacity(carrier: CarrierImage, _options?: StegoOptions): CapacityReport {
    const totalPixels = carrier.width * carrier.height;
    // Each pair is 2 adjacent pixels in each color channel (R, G, B)
    // Conservative lower bound: 3 bits per pair
    const pairsPerChannel = Math.floor(totalPixels / 2);
    const totalPairs = pairsPerChannel * 3;
    const minBits = totalPairs * 3;
    const theoreticalBytes = Math.floor(minBits / 8);
    const usableBytes = Math.max(0, theoreticalBytes - 4); // 4-byte header

    return {
      theoreticalBytes,
      usableBytes,
      overheadBytes: 4,
      totalPixels,
      bitsPerPixel: Math.round((minBits / totalPixels) * 10) / 10,
      channelsUsed: ['R', 'G', 'B'],
    };
  }

  public async analyze(
    carrier: CarrierImage,
    options?: StegoOptions,
    _signal?: AbortSignal,
  ): Promise<CarrierAnalysis> {
    const capacity = this.calculateCapacity(carrier, options);
    const totalPixels = carrier.width * carrier.height;

    return {
      width: carrier.width,
      height: carrier.height,
      totalPixels,
      capacity,
    };
  }

  public async embed(
    carrier: CarrierImage,
    payload: Uint8Array,
    options?: StegoOptions,
    signal?: AbortSignal,
    onProgress?: StegoProgressCallback,
  ): Promise<CarrierImage> {
    if (signal?.aborted) throw new Error('Embedding operation was cancelled.');
    if (carrier.data.length !== carrier.width * carrier.height * 4) {
      throw new InvalidCarrierError('Invalid carrier image buffer dimensions.');
    }

    const capacity = this.calculateCapacity(carrier, options);
    if (payload.length > capacity.usableBytes) {
      throw new InsufficientCapacityError(
        `Payload size (${payload.length} bytes) exceeds usable PVD capacity (${capacity.usableBytes} bytes).`,
      );
    }

    const outData = new Uint8ClampedArray(carrier.data);
    const totalPayloadBits = (4 + payload.length) * 8;

    // Buffer with 4-byte big-endian length prefix + payload
    const bitBuffer = new Uint8Array(4 + payload.length);
    new DataView(bitBuffer.buffer).setUint32(0, payload.length, false);
    bitBuffer.set(payload, 4);

    let bitCursor = 0;
    const totalPixels = carrier.width * carrier.height;
    const totalPairs = Math.floor(totalPixels / 2);

    for (let c = 0; c < 3 && bitCursor < totalPayloadBits; c++) {
      for (let pairIdx = 0; pairIdx < totalPairs && bitCursor < totalPayloadBits; pairIdx++) {
        const p0Idx = pairIdx * 2 * 4 + c;
        const p1Idx = (pairIdx * 2 + 1) * 4 + c;

        const p0 = outData[p0Idx] ?? 0;
        const p1 = outData[p1Idx] ?? 0;

        const diff = p1 - p0;
        const absDiff = Math.abs(diff);
        const range = findRange(absDiff);
        const bitsToEmbed = Math.min(range.bits, totalPayloadBits - bitCursor);

        // Read bitsToEmbed from bitBuffer
        let valueToEmbed = 0;
        for (let b = 0; b < bitsToEmbed; b++) {
          const overallBit = bitCursor + b;
          const byteIdx = Math.floor(overallBit / 8);
          const bitOffset = 7 - (overallBit % 8);
          const bitVal = ((bitBuffer[byteIdx] ?? 0) >> bitOffset) & 1;
          valueToEmbed = (valueToEmbed << 1) | bitVal;
        }

        // If remaining bits are fewer than range.bits (at the very end), pad with 0s
        if (bitsToEmbed < range.bits) {
          valueToEmbed <<= range.bits - bitsToEmbed;
        }

        const newAbsDiff = range.lower + valueToEmbed;
        const kDiff = newAbsDiff - absDiff;

        let newP0: number;
        let newP1: number;

        if (p1 >= p0) {
          newP0 = p0 - Math.ceil(kDiff / 2);
          newP1 = p1 + Math.floor(kDiff / 2);
        } else {
          newP0 = p0 + Math.ceil(kDiff / 2);
          newP1 = p1 - Math.floor(kDiff / 2);
        }

        // Handle overflow/underflow to keep within [0, 255] while strictly preserving difference
        if (newP0 < 0) {
          const shift = -newP0;
          newP0 += shift;
          newP1 += shift;
        } else if (newP0 > 255) {
          const shift = newP0 - 255;
          newP0 -= shift;
          newP1 -= shift;
        }

        if (newP1 < 0) {
          const shift = -newP1;
          newP0 += shift;
          newP1 += shift;
        } else if (newP1 > 255) {
          const shift = newP1 - 255;
          newP0 -= shift;
          newP1 -= shift;
        }

        outData[p0Idx] = newP0;
        outData[p1Idx] = newP1;

        bitCursor += bitsToEmbed;

        if (onProgress && bitCursor % 1000 === 0) {
          onProgress(bitCursor / totalPayloadBits);
        }
      }
    }

    onProgress?.(1.0);
    return {
      width: carrier.width,
      height: carrier.height,
      data: outData,
    };
  }

  public async extract(
    carrier: CarrierImage,
    _options?: StegoOptions,
    signal?: AbortSignal,
    onProgress?: StegoProgressCallback,
  ): Promise<Uint8Array> {
    if (signal?.aborted) throw new Error('Extraction operation was cancelled.');
    if (carrier.data.length !== carrier.width * carrier.height * 4) {
      throw new InvalidCarrierError('Invalid carrier image buffer dimensions.');
    }

    const data = carrier.data;
    const totalPixels = carrier.width * carrier.height;
    const totalPairs = Math.floor(totalPixels / 2);

    const extractedBits: number[] = [];
    let payloadLength: number | null = null;
    let targetTotalBits = 32;

    for (let c = 0; c < 3; c++) {
      for (let pairIdx = 0; pairIdx < totalPairs; pairIdx++) {
        if (payloadLength !== null && extractedBits.length >= targetTotalBits) {
          break;
        }

        const p0Idx = pairIdx * 2 * 4 + c;
        const p1Idx = (pairIdx * 2 + 1) * 4 + c;

        const p0 = data[p0Idx] ?? 0;
        const p1 = data[p1Idx] ?? 0;

        const absDiff = Math.abs(p1 - p0);
        const range = findRange(absDiff);
        const diffOffset = absDiff - range.lower;

        // Extract range.bits bits from diffOffset
        for (let b = range.bits - 1; b >= 0; b--) {
          const bit = (diffOffset >> b) & 1;
          extractedBits.push(bit);

          if (extractedBits.length === 32 && payloadLength === null) {
            let len = 0;
            for (let i = 0; i < 32; i++) {
              len = (len << 1) | (extractedBits[i] ?? 0);
            }
            if (len < 0 || len > 100 * 1024 * 1024) {
              throw new ExtractionError(`Invalid PVD steganographic header payload length: ${len}`);
            }
            payloadLength = len;
            targetTotalBits = (4 + payloadLength) * 8;
          }

          if (payloadLength !== null && extractedBits.length >= targetTotalBits) {
            break;
          }
        }
      }
      if (payloadLength !== null && extractedBits.length >= targetTotalBits) {
        break;
      }
    }

    if (payloadLength === null || extractedBits.length < targetTotalBits) {
      throw new ExtractionError('Carrier does not contain a complete valid PVD payload.');
    }

    onProgress?.(1.0);

    const payload = new Uint8Array(payloadLength);
    for (let i = 0; i < payloadLength; i++) {
      let byteVal = 0;
      for (let b = 0; b < 8; b++) {
        const bit = extractedBits[32 + i * 8 + b] ?? 0;
        byteVal = (byteVal << 1) | bit;
      }
      payload[i] = byteVal;
    }

    return payload;
  }
}

export const pvdStego = new PvdStegoMethod();
