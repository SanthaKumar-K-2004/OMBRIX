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

export interface Haar2x2Block {
  ll: number;
  lh: number;
  hl: number;
  hh: number;
  l0: number;
  l1: number;
}

export function forwardHaar2x2(p00: number, p01: number, p10: number, p11: number): Haar2x2Block {
  // Row transform
  const l0 = Math.floor((p00 + p01) / 2);
  const h0 = p00 - p01;
  const l1 = Math.floor((p10 + p11) / 2);
  const h1 = p10 - p11;

  // Column transform
  const ll = Math.floor((l0 + l1) / 2);
  const lh = l0 - l1;
  const hl = Math.floor((h0 + h1) / 2);
  const hh = h0 - h1;

  return { ll, lh, hl, hh, l0, l1 };
}

export function inverseHaar2x2(
  ll: number,
  lh: number,
  hl: number,
  hh: number,
): [number, number, number, number] {
  // Inverse column
  const l0 = ll + Math.floor((lh + 1) / 2);
  const l1 = l0 - lh;
  const h0 = hl + Math.floor((hh + 1) / 2);
  const h1 = h0 - hh;

  // Inverse rows
  const p00 = l0 + Math.floor((h0 + 1) / 2);
  const p01 = p00 - h0;
  const p10 = l1 + Math.floor((h1 + 1) / 2);
  const p11 = p10 - h1;

  return [p00, p01, p10, p11];
}

export class HaarDwtStegoMethod implements StegoMethod {
  public readonly id = 'stego-dwt';
  public readonly name = '2D Haar Integer Wavelet Transform';
  public readonly version = '1.0.0';
  public readonly description =
    'Multi-resolution frequency wavelet domain steganography embedding payload bits into integer high-frequency diagonal subband (HH) coefficients.';

  public calculateCapacity(carrier: CarrierImage, _options?: StegoOptions): CapacityReport {
    // 2x2 blocks
    const blockRows = Math.floor(carrier.height / 2);
    const blockCols = Math.floor(carrier.width / 2);
    const totalBlocks = blockRows * blockCols;
    // 1 bit per 2x2 block per RGB channel
    const totalBits = totalBlocks * 3;
    const theoreticalBytes = Math.floor(totalBits / 8);
    const usableBytes = Math.max(0, theoreticalBytes - 4); // 4-byte header

    return {
      theoreticalBytes,
      usableBytes,
      overheadBytes: 4,
      totalPixels: carrier.width * carrier.height,
      bitsPerPixel: Math.round((totalBits / (carrier.width * carrier.height)) * 100) / 100,
      channelsUsed: ['R', 'G', 'B'],
    };
  }

  public async analyze(
    carrier: CarrierImage,
    options?: StegoOptions,
    _signal?: AbortSignal,
  ): Promise<CarrierAnalysis> {
    const capacity = this.calculateCapacity(carrier, options);
    return {
      width: carrier.width,
      height: carrier.height,
      totalPixels: carrier.width * carrier.height,
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
      throw new InvalidCarrierError('Invalid carrier image buffer length.');
    }

    const capacity = this.calculateCapacity(carrier, options);
    const blockRows = Math.floor(carrier.height / 2);
    const blockCols = Math.floor(carrier.width / 2);
    if (blockRows * blockCols * 3 < 32 || capacity.usableBytes === 0) {
      throw new InsufficientCapacityError(
        'Carrier image is too small for Haar DWT embedding (minimum 11 2x2 blocks / 32 bits required for length header).',
      );
    }
    if (payload.length > capacity.usableBytes) {
      throw new InsufficientCapacityError(
        `Payload size (${payload.length} bytes) exceeds usable Haar DWT capacity (${capacity.usableBytes} bytes).`,
      );
    }

    const outData = new Uint8ClampedArray(carrier.data);
    const totalPayloadBits = (4 + payload.length) * 8;

    const bitBuffer = new Uint8Array(4 + payload.length);
    new DataView(bitBuffer.buffer).setUint32(0, payload.length, false);
    bitBuffer.set(payload, 4);

    let bitCursor = 0;
    const width = carrier.width;

    for (let c = 0; c < 3 && bitCursor < totalPayloadBits; c++) {
      for (let by = 0; by < blockRows && bitCursor < totalPayloadBits; by++) {
        for (let bx = 0; bx < blockCols && bitCursor < totalPayloadBits; bx++) {
          const y0 = by * 2;
          const y1 = y0 + 1;
          const x0 = bx * 2;
          const x1 = x0 + 1;

          const idx00 = (y0 * width + x0) * 4 + c;
          const idx01 = (y0 * width + x1) * 4 + c;
          const idx10 = (y1 * width + x0) * 4 + c;
          const idx11 = (y1 * width + x1) * 4 + c;

          const p00 = outData[idx00] ?? 0;
          const p01 = outData[idx01] ?? 0;
          const p10 = outData[idx10] ?? 0;
          const p11 = outData[idx11] ?? 0;

          const block = forwardHaar2x2(p00, p01, p10, p11);

          const byteIdx = Math.floor(bitCursor / 8);
          const bitOffset = 7 - (bitCursor % 8);
          const targetBit = ((bitBuffer[byteIdx] ?? 0) >> bitOffset) & 1;

          const currentParity = ((block.hh % 2) + 2) % 2;
          let newHh = block.hh;

          if (currentParity !== targetBit) {
            // Test HH + 1 vs HH - 1 to see which satisfies [0, 255] boundary best
            const candPlus = block.hh + 1;
            const candMinus = block.hh - 1;

            const recPlus = inverseHaar2x2(block.ll, block.lh, block.hl, candPlus);
            const plusMin = Math.min(...recPlus);
            const plusMax = Math.max(...recPlus);

            const recMinus = inverseHaar2x2(block.ll, block.lh, block.hl, candMinus);
            const minusMin = Math.min(...recMinus);
            const minusMax = Math.max(...recMinus);

            if (plusMin >= 0 && plusMax <= 255) {
              newHh = candPlus;
            } else if (minusMin >= 0 && minusMax <= 255) {
              newHh = candMinus;
            } else {
              // Pick candidate with less violation and adjust LL
              const plusViol = Math.max(0, -plusMin) + Math.max(0, plusMax - 255);
              const minusViol = Math.max(0, -minusMin) + Math.max(0, minusMax - 255);
              newHh = plusViol <= minusViol ? candPlus : candMinus;
            }
          }

          let [nP00, nP01, nP10, nP11] = inverseHaar2x2(block.ll, block.lh, block.hl, newHh);

          // Boundary correction if needed
          const minVal = Math.min(nP00, nP01, nP10, nP11);
          const maxVal = Math.max(nP00, nP01, nP10, nP11);
          let adjLl = block.ll;

          if (minVal < 0) {
            adjLl += -minVal;
            [nP00, nP01, nP10, nP11] = inverseHaar2x2(adjLl, block.lh, block.hl, newHh);
          } else if (maxVal > 255) {
            adjLl -= maxVal - 255;
            [nP00, nP01, nP10, nP11] = inverseHaar2x2(adjLl, block.lh, block.hl, newHh);
          }

          outData[idx00] = Math.max(0, Math.min(255, nP00));
          outData[idx01] = Math.max(0, Math.min(255, nP01));
          outData[idx10] = Math.max(0, Math.min(255, nP10));
          outData[idx11] = Math.max(0, Math.min(255, nP11));

          bitCursor++;

          if (onProgress && bitCursor % 1000 === 0) {
            onProgress(bitCursor / totalPayloadBits);
          }
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
    const blockRows = Math.floor(carrier.height / 2);
    const blockCols = Math.floor(carrier.width / 2);
    const width = carrier.width;

    const extractedBits: number[] = [];
    let payloadLength: number | null = null;
    let targetTotalBits = 32;

    for (let c = 0; c < 3; c++) {
      for (let by = 0; by < blockRows; by++) {
        for (let bx = 0; bx < blockCols; bx++) {
          if (payloadLength !== null && extractedBits.length >= targetTotalBits) {
            break;
          }

          const y0 = by * 2;
          const y1 = y0 + 1;
          const x0 = bx * 2;
          const x1 = x0 + 1;

          const idx00 = (y0 * width + x0) * 4 + c;
          const idx01 = (y0 * width + x1) * 4 + c;
          const idx10 = (y1 * width + x0) * 4 + c;
          const idx11 = (y1 * width + x1) * 4 + c;

          const p00 = data[idx00] ?? 0;
          const p01 = data[idx01] ?? 0;
          const p10 = data[idx10] ?? 0;
          const p11 = data[idx11] ?? 0;

          const block = forwardHaar2x2(p00, p01, p10, p11);
          const bit = ((block.hh % 2) + 2) % 2;
          extractedBits.push(bit);

          if (extractedBits.length === 32 && payloadLength === null) {
            let len = 0;
            for (let i = 0; i < 32; i++) {
              len = (len << 1) | (extractedBits[i] ?? 0);
            }
            if (len < 0 || len > 100 * 1024 * 1024) {
              throw new ExtractionError(`Invalid Haar DWT header payload length: ${len}`);
            }
            payloadLength = len;
            targetTotalBits = (4 + payloadLength) * 8;
          }

          if (payloadLength !== null && extractedBits.length >= targetTotalBits) {
            break;
          }
        }
        if (payloadLength !== null && extractedBits.length >= targetTotalBits) {
          break;
        }
      }
      if (payloadLength !== null && extractedBits.length >= targetTotalBits) {
        break;
      }
    }

    if (payloadLength === null || extractedBits.length < targetTotalBits) {
      throw new ExtractionError('Carrier does not contain a complete valid Haar DWT payload.');
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

export const haarDwtStego = new HaarDwtStegoMethod();
