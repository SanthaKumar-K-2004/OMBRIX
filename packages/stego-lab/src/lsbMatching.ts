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

const HEADER_BIT_LENGTH = 32;

export class PngLsbMatchingMethod implements StegoMethod {
  public readonly id = 'png-lsb-matching';
  public readonly name = 'PNG Sequential RGB LSB Matching (±1)';
  public readonly version = '1.0.0';
  public readonly description =
    'Sequential raster steganography using ±1 embedding (LSB matching) to eliminate asymmetric pairing artifacts in sample pair distributions.';

  public calculateCapacity(carrier: CarrierImage, _options?: StegoOptions): CapacityReport {
    const totalPixels = carrier.width * carrier.height;
    const totalRgbBits = totalPixels * 3;
    const theoreticalBytes = Math.floor(totalRgbBits / 8);
    const usableBits = Math.max(0, totalRgbBits - HEADER_BIT_LENGTH);
    const usableBytes = Math.floor(usableBits / 8);

    return {
      theoreticalBytes,
      usableBytes,
      overheadBytes: 4,
      totalPixels,
      bitsPerPixel: 3,
      channelsUsed: ['R', 'G', 'B'],
    };
  }

  public async analyze(
    carrier: CarrierImage,
    options?: StegoOptions,
    _signal?: AbortSignal,
  ): Promise<CarrierAnalysis> {
    const capacity = this.calculateCapacity(carrier, options);
    const data = carrier.data;
    const totalPixels = carrier.width * carrier.height;

    let lsbOnesCount = 0;
    const sampleLimit = Math.min(totalPixels, 50000);

    for (let p = 0; p < sampleLimit; p++) {
      const idx = p * 4;
      lsbOnesCount += (data[idx] ?? 0) & 1;
      lsbOnesCount += (data[idx + 1] ?? 0) & 1;
      lsbOnesCount += (data[idx + 2] ?? 0) & 1;
    }

    const totalSampledBits = sampleLimit * 3;
    const p1 = totalSampledBits > 0 ? lsbOnesCount / totalSampledBits : 0.5;
    const p0 = 1 - p1;
    const entropy = p0 > 0 && p1 > 0 ? -(p0 * Math.log2(p0) + p1 * Math.log2(p1)) : 0;

    return {
      width: carrier.width,
      height: carrier.height,
      totalPixels,
      capacity,
      estimatedNoiseEntropy: Math.round(entropy * 1000) / 1000,
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
      throw new InvalidCarrierError('Invalid carrier image data buffer length.');
    }

    const capacity = this.calculateCapacity(carrier, options);
    if (payload.length > capacity.usableBytes) {
      throw new InsufficientCapacityError(
        `Payload size (${payload.length} bytes) exceeds usable carrier capacity (${capacity.usableBytes} bytes).`,
      );
    }

    const outData = new Uint8ClampedArray(carrier.data);
    const totalBits = (4 + payload.length) * 8;

    // Construct 4-byte big-endian length prefix + payload
    const buffer = new Uint8Array(4 + payload.length);
    new DataView(buffer.buffer).setUint32(0, payload.length, false);
    buffer.set(payload, 4);

    let bitIdx = 0;
    const totalChannels = carrier.width * carrier.height * 4;

    // Deterministic PRNG seed for ±1 tie-breaking (LCG)
    let prngState = 0x12345678;

    for (let i = 0; i < totalChannels && bitIdx < totalBits; i++) {
      // Skip Alpha channel (every 4th byte: indices 3, 7, 11, etc.)
      if (i % 4 === 3) continue;

      const bytePos = Math.floor(bitIdx / 8);
      const bitPos = 7 - (bitIdx % 8);
      const targetBit = ((buffer[bytePos] ?? 0) >> bitPos) & 1;

      const currentVal = outData[i] ?? 0;
      const currentBit = currentVal & 1;

      if (currentBit !== targetBit) {
        // LSB Matching decision
        if (currentVal === 0) {
          outData[i] = 1;
        } else if (currentVal === 255) {
          outData[i] = 254;
        } else {
          // LCG pseudo-random tie-break
          prngState = (1664525 * prngState + 1013904223) >>> 0;
          const delta = (prngState & 1) === 1 ? 1 : -1;
          outData[i] = currentVal + delta;
        }
      }

      bitIdx++;

      if (onProgress && bitIdx % 10000 === 0) {
        onProgress(bitIdx / totalBits);
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
      throw new InvalidCarrierError('Invalid carrier image data buffer length.');
    }

    const totalChannels = carrier.width * carrier.height * 4;
    const data = carrier.data;

    // Step 1: Read 32-bit length prefix
    let lengthPrefix = 0;
    let headerBitsRead = 0;
    let channelIdx = 0;

    while (channelIdx < totalChannels && headerBitsRead < HEADER_BIT_LENGTH) {
      if (channelIdx % 4 !== 3) {
        const bit = (data[channelIdx] ?? 0) & 1;
        lengthPrefix = (lengthPrefix << 1) | bit;
        headerBitsRead++;
      }
      channelIdx++;
    }

    if (headerBitsRead < HEADER_BIT_LENGTH) {
      throw new ExtractionError('Carrier buffer too small to read 32-bit header.');
    }

    const theoreticalMax = Math.floor((carrier.width * carrier.height * 3) / 8) - 4;
    if (lengthPrefix < 0 || lengthPrefix > theoreticalMax) {
      throw new ExtractionError(
        `Extracted payload length (${lengthPrefix} bytes) exceeds carrier capacity (${theoreticalMax} bytes).`,
      );
    }

    // Step 2: Read payload bytes
    const payload = new Uint8Array(lengthPrefix);
    const totalPayloadBits = lengthPrefix * 8;
    let payloadBitsRead = 0;

    while (channelIdx < totalChannels && payloadBitsRead < totalPayloadBits) {
      if (channelIdx % 4 !== 3) {
        const bit = (data[channelIdx] ?? 0) & 1;
        const bytePos = Math.floor(payloadBitsRead / 8);
        const bitPos = 7 - (payloadBitsRead % 8);
        payload[bytePos] = (payload[bytePos] ?? 0) | (bit << bitPos);
        payloadBitsRead++;
      }
      channelIdx++;
    }

    if (payloadBitsRead < totalPayloadBits) {
      throw new ExtractionError('Unexpected end of carrier data while extracting payload.');
    }

    onProgress?.(1.0);
    return payload;
  }
}

export const pngLsbMatching = new PngLsbMatchingMethod();
