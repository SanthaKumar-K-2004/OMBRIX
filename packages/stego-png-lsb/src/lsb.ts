import {
  type CapacityReport,
  type CarrierAnalysis,
  type CarrierImage,
  ExtractionError,
  InsufficientCapacityError,
  InvalidCarrierError,
  StegoAbortError,
  type StegoMethod,
  type StegoOptions,
  type StegoProgressCallback,
} from '@ombrix/stego-interface';

const HEADER_BIT_COUNT = 32; // 32 bits = 4 bytes uint32 big-endian payload length
const CANCEL_CHECK_INTERVAL = 4096;

export class PngLsbSequentialMethod implements StegoMethod {
  public readonly id = 'png-lsb-sequential';
  public readonly name = 'PNG Sequential RGB LSB';
  public readonly version = '1.0.0';
  public readonly description =
    'Deterministic sequential RGB LSB embedding and extraction for static PNG carriers.';

  /**
   * Calculates maximum payload capacity for the carrier raster.
   */
  public calculateCapacity(carrier: CarrierImage, _options?: StegoOptions): CapacityReport {
    validateCarrierBuffer(carrier);
    const totalPixels = carrier.width * carrier.height;
    const totalRgbBits = totalPixels * 3;
    const theoreticalBytes = Math.floor(totalRgbBits / 8);
    const usableBits = Math.max(0, totalRgbBits - HEADER_BIT_COUNT);
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

  /**
   * Performs carrier analysis and noise estimation.
   */
  public async analyze(
    carrier: CarrierImage,
    options?: StegoOptions,
    _signal?: AbortSignal,
  ): Promise<CarrierAnalysis> {
    const capacity = this.calculateCapacity(carrier, options);
    const data = carrier.data;
    const totalPixels = carrier.width * carrier.height;

    // Estimate entropy of the least significant bits across RGB channels
    let lsbOnesCount = 0;
    const sampleLimit = Math.min(totalPixels, 50000);

    for (let p = 0; p < sampleLimit; p++) {
      const idx = p * 4;
      lsbOnesCount += data[idx]! & 1; // R
      lsbOnesCount += data[idx + 1]! & 1; // G
      lsbOnesCount += data[idx + 2]! & 1; // B
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

  /**
   * Embeds payload bytes into carrier RGB channels sequentially.
   */
  public async embed(
    carrier: CarrierImage,
    payload: Uint8Array,
    options?: StegoOptions,
    signal?: AbortSignal,
    onProgress?: StegoProgressCallback,
  ): Promise<CarrierImage> {
    validateCarrierBuffer(carrier);
    if (signal?.aborted) throw new StegoAbortError();

    const capacity = this.calculateCapacity(carrier, options);
    if (payload.length > capacity.usableBytes) {
      throw new InsufficientCapacityError(
        `Payload size (${payload.length} bytes) exceeds carrier usable capacity (${capacity.usableBytes} bytes).`,
      );
    }

    const outputData = new Uint8ClampedArray(carrier.data);
    const totalBits = HEADER_BIT_COUNT + payload.length * 8;

    let bitIndex = 0;
    let pixelIndex = 0;
    let channelOffset = 0; // 0=R, 1=G, 2=B

    // Helper to get bit value (0 or 1) at bitIndex
    const getBit = (index: number): number => {
      if (index < HEADER_BIT_COUNT) {
        // Read from 32-bit payload length (MSB first)
        const shift = 31 - index;
        return (payload.length >>> shift) & 1;
      }
      const payloadBitIndex = index - HEADER_BIT_COUNT;
      const byteIndex = payloadBitIndex >>> 3;
      const bitInByte = 7 - (payloadBitIndex & 7);
      return (payload[byteIndex]! >>> bitInByte) & 1;
    };

    while (bitIndex < totalBits) {
      if (bitIndex % CANCEL_CHECK_INTERVAL === 0) {
        if (signal?.aborted) throw new StegoAbortError();
        if (onProgress) onProgress(bitIndex / totalBits);
        // Cooperative yield
        await yieldMicrotask();
      }

      const byteIdx = pixelIndex * 4 + channelOffset;
      const bit = getBit(bitIndex);
      outputData[byteIdx] = (outputData[byteIdx]! & 0xfe) | bit;

      bitIndex++;
      channelOffset++;
      if (channelOffset === 3) {
        channelOffset = 0;
        pixelIndex++;
      }
    }

    if (onProgress) onProgress(1.0);

    return {
      width: carrier.width,
      height: carrier.height,
      data: outputData,
    };
  }

  /**
   * Extracts embedded payload bytes from carrier RGB channels.
   */
  public async extract(
    carrier: CarrierImage,
    options?: StegoOptions,
    signal?: AbortSignal,
    onProgress?: StegoProgressCallback,
  ): Promise<Uint8Array> {
    validateCarrierBuffer(carrier);
    if (signal?.aborted) throw new StegoAbortError();

    const totalPixels = carrier.width * carrier.height;
    if (totalPixels < 11) {
      throw new ExtractionError(
        'Carrier image is too small to contain a valid 32-bit steganographic length header (minimum 11 pixels required).',
      );
    }

    const capacity = this.calculateCapacity(carrier, options);
    const data = carrier.data;

    let bitIndex = 0;
    let pixelIndex = 0;
    let channelOffset = 0;

    // 1. Read first 32 bits to recover payload length
    let payloadLength = 0;
    while (bitIndex < HEADER_BIT_COUNT) {
      const byteIdx = pixelIndex * 4 + channelOffset;
      const bit = data[byteIdx]! & 1;
      payloadLength = (payloadLength << 1) | bit;

      bitIndex++;
      channelOffset++;
      if (channelOffset === 3) {
        channelOffset = 0;
        pixelIndex++;
      }
    }

    // Ensure payloadLength is treated as unsigned 32-bit integer
    payloadLength = payloadLength >>> 0;

    if (payloadLength > capacity.usableBytes) {
      throw new ExtractionError(
        `Corrupted or invalid payload length header (extracted ${payloadLength.toLocaleString()} bytes, but carrier capacity is only ${capacity.usableBytes.toLocaleString()} bytes).`,
      );
    }

    const payload = new Uint8Array(payloadLength);
    const totalBits = HEADER_BIT_COUNT + payloadLength * 8;

    while (bitIndex < totalBits) {
      if (bitIndex % CANCEL_CHECK_INTERVAL === 0) {
        if (signal?.aborted) throw new StegoAbortError();
        if (onProgress) onProgress((bitIndex - HEADER_BIT_COUNT) / (payloadLength * 8));
        await yieldMicrotask();
      }

      const byteIdx = pixelIndex * 4 + channelOffset;
      const bit = data[byteIdx]! & 1;

      const payloadBitIndex = bitIndex - HEADER_BIT_COUNT;
      const byteIndex = payloadBitIndex >>> 3;
      const bitInByte = 7 - (payloadBitIndex & 7);

      payload[byteIndex] = payload[byteIndex]! | (bit << bitInByte);

      bitIndex++;
      channelOffset++;
      if (channelOffset === 3) {
        channelOffset = 0;
        pixelIndex++;
      }
    }

    if (onProgress) onProgress(1.0);

    return payload;
  }
}

function validateCarrierBuffer(carrier: CarrierImage): void {
  if (carrier.width <= 0 || carrier.height <= 0) {
    throw new InvalidCarrierError(
      `Invalid carrier dimensions: ${carrier.width}x${carrier.height}. Width and height must be positive numbers.`,
    );
  }
  const expectedMinLength = carrier.width * carrier.height * 4;
  if (carrier.data.length < expectedMinLength) {
    throw new InvalidCarrierError(
      `Carrier buffer length (${carrier.data.length}) is smaller than required RGBA pixel buffer size (${expectedMinLength}).`,
    );
  }
}

function yieldMicrotask(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}
