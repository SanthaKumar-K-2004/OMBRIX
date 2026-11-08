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

// 8x8 Standard JPEG Luminance Quantization Matrix Q50
export const JPEG_Q50: readonly number[] = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56,
  14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113,
  92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];

// Precompute 8x8 DCT transform matrix T (orthogonal)
export const DCT_MATRIX: number[][] = Array.from({ length: 8 }, (_, i) =>
  Array.from({ length: 8 }, (_, j) => {
    if (i === 0) {
      return 1 / Math.sqrt(8);
    }
    return 0.5 * Math.cos(((2 * j + 1) * i * Math.PI) / 16);
  }),
);

// Standard Zigzag scan coordinates (u, v) skipping DC (0,0)
export const ZIGZAG_COORDS: readonly [number, number][] = [
  [0, 1],
  [1, 0],
  [2, 0],
  [1, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [2, 1],
  [3, 0],
  [4, 0],
  [3, 1],
  [2, 2],
  [1, 3],
  [0, 4],
  [0, 5],
  [1, 4],
  [2, 3],
  [3, 2],
  [4, 1],
  [5, 0],
  [6, 0],
  [5, 1],
  [4, 2],
  [3, 3],
  [2, 4],
  [1, 5],
  [0, 6],
  [0, 7],
  [1, 6],
  [2, 5],
  [3, 4],
  [4, 3],
  [5, 2],
  [6, 1],
  [7, 0],
  [7, 1],
  [6, 2],
  [5, 3],
  [4, 4],
  [3, 5],
  [2, 6],
  [1, 7],
  [2, 7],
  [3, 6],
  [4, 5],
  [5, 4],
  [6, 3],
  [7, 2],
  [7, 3],
  [6, 4],
  [5, 5],
  [4, 6],
  [3, 7],
  [4, 7],
  [5, 6],
  [6, 5],
  [7, 4],
  [7, 5],
  [6, 6],
  [5, 7],
  [6, 7],
  [7, 6],
  [7, 7],
];

// Forward 8x8 2D DCT: F = T * (f - 128) * T^T
export function forwardDct8x8(block: number[][]): number[][] {
  const shifted: number[][] = Array.from({ length: 8 }, (_, r) =>
    Array.from({ length: 8 }, (_, c) => (block[r]?.[c] ?? 0) - 128),
  );

  // temp = T * shifted
  const temp: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0));
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      let sum = 0;
      for (let k = 0; k < 8; k++) {
        sum += (DCT_MATRIX[i]?.[k] ?? 0) * (shifted[k]?.[j] ?? 0);
      }
      temp[i]![j] = sum;
    }
  }

  // F = temp * T^T
  const F: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0));
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      let sum = 0;
      for (let k = 0; k < 8; k++) {
        sum += (temp[i]?.[k] ?? 0) * (DCT_MATRIX[j]?.[k] ?? 0);
      }
      F[i]![j] = sum;
    }
  }

  return F;
}

// Inverse 8x8 2D DCT: f = 128 + T^T * F * T
export function inverseDct8x8(F: number[][]): number[][] {
  // temp = T^T * F
  const temp: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0));
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      let sum = 0;
      for (let k = 0; k < 8; k++) {
        sum += (DCT_MATRIX[k]?.[i] ?? 0) * (F[k]?.[j] ?? 0);
      }
      temp[i]![j] = sum;
    }
  }

  // f = 128 + temp * T
  const f: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0));
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      let sum = 0;
      for (let k = 0; k < 8; k++) {
        sum += (temp[i]?.[k] ?? 0) * (DCT_MATRIX[k]?.[j] ?? 0);
      }
      f[i]![j] = 128 + sum;
    }
  }

  return f;
}

export class JpegDctStegoMethod implements StegoMethod {
  public readonly id = 'stego-dct';
  public readonly name = 'JPEG 8x8 Block DCT Coefficient';
  public readonly version = '1.0.0';
  public readonly description =
    'Codec-domain steganography operating on quantized 8x8 JPEG discrete cosine transform AC coefficients using standard Q50 luminance quantization.';

  public calculateCapacity(carrier: CarrierImage, _options?: StegoOptions): CapacityReport {
    const blockRows = Math.floor(carrier.height / 8);
    const blockCols = Math.floor(carrier.width / 8);
    const totalBlocks = blockRows * blockCols;
    // Embed 4 bits per 8x8 block across 3 channels (12 bits per 8x8 block total)
    const bitsPerBlock = 4;
    const totalBits = totalBlocks * bitsPerBlock * 3;
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
      throw new InvalidCarrierError('Invalid carrier image buffer dimensions.');
    }

    const capacity = this.calculateCapacity(carrier, options);
    const blockRows = Math.floor(carrier.height / 8);
    const blockCols = Math.floor(carrier.width / 8);
    if (blockRows * blockCols * 12 < 32 || capacity.usableBytes === 0) {
      throw new InsufficientCapacityError(
        'Carrier image is too small for JPEG DCT embedding (minimum 3 8x8 blocks / 32 bits required for length header).',
      );
    }
    if (payload.length > capacity.usableBytes) {
      throw new InsufficientCapacityError(
        `Payload size (${payload.length} bytes) exceeds usable JPEG DCT capacity (${capacity.usableBytes} bytes).`,
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
          const originY = by * 8;
          const originX = bx * 8;

          // Extract 8x8 spatial block
          const spatialBlock: number[][] = Array.from({ length: 8 }, (_, r) =>
            Array.from({ length: 8 }, (_, col) => {
              const idx = ((originY + r) * width + (originX + col)) * 4 + c;
              return outData[idx] ?? 0;
            }),
          );

          // Compute Forward DCT
          const F = forwardDct8x8(spatialBlock);

          // Embed up to 4 bits in selected AC zigzag coefficients
          const embeddedTargets: Array<{ u: number; v: number; targetQ: number; qVal: number }> =
            [];

          for (let coeffIdx = 0; coeffIdx < 4 && bitCursor < totalPayloadBits; coeffIdx++) {
            const [u, v] = ZIGZAG_COORDS[coeffIdx]!;
            const qTableIdx = u * 8 + v;
            const qVal = JPEG_Q50[qTableIdx] ?? 16;
            const originalVal = F[u]![v]!;
            let quantVal = Math.round(originalVal / qVal);

            const byteIdx = Math.floor(bitCursor / 8);
            const bitOffset = 7 - (bitCursor % 8);
            const targetBit = ((bitBuffer[byteIdx] ?? 0) >> bitOffset) & 1;

            const currentParity = ((quantVal % 2) + 2) % 2;
            if (currentParity !== targetBit) {
              if (quantVal > 0) {
                quantVal -= 1;
              } else {
                quantVal += 1;
              }
            }

            F[u]![v] = quantVal * qVal;
            embeddedTargets.push({ u, v, targetQ: quantVal, qVal });
            bitCursor++;
          }

          // Compute Inverse DCT to get reconstructed spatial pixels
          const reconSpatial = inverseDct8x8(F);

          // Discretize to [0, 255]
          const intBlock: number[][] = Array.from({ length: 8 }, (_, r) =>
            Array.from({ length: 8 }, (_, col) =>
              Math.max(0, Math.min(255, Math.round(reconSpatial[r]![col]!))),
            ),
          );

          // Precision alignment: verify that extracted quantized DCT matches targetQ
          for (let iter = 0; iter < 5; iter++) {
            const checkF = forwardDct8x8(intBlock);
            let hasMismatch = false;

            for (const { u, v, targetQ, qVal } of embeddedTargets) {
              const checkQ = Math.round(checkF[u]![v]! / qVal);
              const diffQ = targetQ - checkQ;

              if (diffQ !== 0) {
                hasMismatch = true;
                const deltaF = diffQ * qVal;
                // Distribute deltaF orthogonally across 8x8 block using basis function T(u, r) * T(v, col)
                for (let r = 0; r < 8; r++) {
                  for (let col = 0; col < 8; col++) {
                    const basis = (DCT_MATRIX[u]?.[r] ?? 0) * (DCT_MATRIX[v]?.[col] ?? 0);
                    intBlock[r]![col] = Math.max(
                      0,
                      Math.min(255, Math.round(intBlock[r]![col]! + deltaF * basis)),
                    );
                  }
                }
              }
            }

            if (!hasMismatch) break;
          }

          // Write adjusted pixels back to outData
          for (let r = 0; r < 8; r++) {
            for (let col = 0; col < 8; col++) {
              const idx = ((originY + r) * width + (originX + col)) * 4 + c;
              outData[idx] = intBlock[r]![col]!;
            }
          }

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
    const blockRows = Math.floor(carrier.height / 8);
    const blockCols = Math.floor(carrier.width / 8);
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

          const originY = by * 8;
          const originX = bx * 8;

          // Extract 8x8 spatial block
          const spatialBlock: number[][] = Array.from({ length: 8 }, (_, r) =>
            Array.from({ length: 8 }, (_, col) => {
              const idx = ((originY + r) * width + (originX + col)) * 4 + c;
              return data[idx] ?? 0;
            }),
          );

          // Compute Forward DCT
          const F = forwardDct8x8(spatialBlock);

          // Extract up to 4 bits from selected AC zigzag coefficients
          for (let coeffIdx = 0; coeffIdx < 4; coeffIdx++) {
            const [u, v] = ZIGZAG_COORDS[coeffIdx]!;
            const qTableIdx = u * 8 + v;
            const qVal = JPEG_Q50[qTableIdx] ?? 16;
            const quantVal = Math.round(F[u]![v]! / qVal);

            const bit = ((quantVal % 2) + 2) % 2;
            extractedBits.push(bit);

            if (extractedBits.length === 32 && payloadLength === null) {
              let len = 0;
              for (let i = 0; i < 32; i++) {
                len = (len << 1) | (extractedBits[i] ?? 0);
              }
              if (len < 0 || len > 100 * 1024 * 1024) {
                throw new ExtractionError(`Invalid JPEG DCT header payload length: ${len}`);
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
      if (payloadLength !== null && extractedBits.length >= targetTotalBits) {
        break;
      }
    }

    if (payloadLength === null || extractedBits.length < targetTotalBits) {
      throw new ExtractionError('Carrier does not contain a complete valid JPEG DCT payload.');
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

export const jpegDctStego = new JpegDctStegoMethod();
