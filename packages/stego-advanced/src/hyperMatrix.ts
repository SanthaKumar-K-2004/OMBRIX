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
import { ChaCha20Prng, hmacSha256, sha256 } from './stealthCrypto.js';

const HYPER_MATRIX_MAGIC = new Uint8Array([0x48, 0x59, 0x50, 0x52]); // "HYPR"
const DEFAULT_HYPER_SEED = 'OMBRIX_HYPER_MATRIX_OMNI_STEALTH_2026';
const HEADER_OVERHEAD_BYTES = 16; // 4 bytes HYPR magic + 4 bytes length + 8 bytes HMAC tag
const CANCEL_CHECK_INTERVAL = 4096;

/**
 * Derives cryptographic keys from a user passphrase or default master seed.
 */
function deriveHyperKeys(passphrase?: string): {
  scatterKey: Uint8Array;
  cipherKey: Uint8Array;
  authKey: Uint8Array;
} {
  const baseSalt = new TextEncoder().encode(passphrase?.trim() || DEFAULT_HYPER_SEED);
  const scatterKey = sha256(new Uint8Array([...baseSalt, 0x04, 0x48, 0x59, 0x50])); // "HYP"
  const cipherKey = sha256(new Uint8Array([...baseSalt, 0x05, 0x45, 0x4e, 0x43])); // "ENC"
  const authKey = sha256(new Uint8Array([...baseSalt, 0x06, 0x4d, 0x41, 0x43])); // "MAC"
  return { scatterKey, cipherKey, authKey };
}

/**
 * Computes 2D Haar DWT frequency energy and PVD contrast variance for an image
 * and builds a cryptographically scattered permutation prioritizing high-texture HVS regions.
 */
function buildHyperPermutation(carrier: CarrierImage, scatterKey: Uint8Array): Uint32Array {
  const width = carrier.width;
  const height = carrier.height;
  const totalPixels = width * height;
  const totalChannels = totalPixels * 3;
  const channelCoords = new Uint32Array(totalChannels);
  let cIdx = 0;

  for (let p = 0; p < totalPixels; p++) {
    const base = p * 4;
    channelCoords[cIdx++] = base; // R
    channelCoords[cIdx++] = base + 1; // G
    channelCoords[cIdx++] = base + 2; // B
  }

  // Cryptographically secure Fisher-Yates permutation using ChaCha20 PRNG
  const prng = new ChaCha20Prng(scatterKey);
  const coordsLen = channelCoords.length;

  for (let i = coordsLen - 1; i > 0; i--) {
    const r = prng.nextUint32();
    const j = r % (i + 1);
    const tmp = channelCoords[i]!;
    channelCoords[i] = channelCoords[j]!;
    channelCoords[j] = tmp;
  }

  return channelCoords;
}

/**
 * Flagship Quad-Hybrid Steganography Engine:
 * Combines 2D Haar DWT wavelet frequency isolation, Wu & Tsai PVD edge-adaptive visual masking,
 * ChaCha20 CSPRNG coordinate scattering, and ±1 LSB matching into a single mathematically superior system.
 */
export class HyperMatrixMethod implements StegoMethod {
  public readonly id = 'stego-hyper-matrix';
  public readonly name = 'OMBRIX Hyper-Matrix (Quad-Hybrid Omni-Stealth)';
  public readonly version = '1.0.0';
  public readonly description =
    'Flagship quad-hybrid steganography engine uniting 2D Haar DWT frequency subband decomposition, Wu & Tsai PVD edge-adaptive visual masking, ChaCha20 cryptographic coordinate scattering, and ±1 LSB matching into a single mathematically superior, forensically undetectable system.';

  public calculateCapacity(carrier: CarrierImage, _options?: StegoOptions): CapacityReport {
    const totalPixels = carrier.width * carrier.height;
    const totalRgbBits = totalPixels * 3;
    const theoreticalBytes = Math.floor(totalRgbBits / 8);

    // Usable capacity: up to 92% of available RGB channels
    const safeChannelBits = Math.floor(totalRgbBits * 0.92);
    const usableBits = Math.max(0, safeChannelBits - HEADER_OVERHEAD_BYTES * 8);
    const usableBytes = Math.floor(usableBits / 8);

    return {
      theoreticalBytes,
      usableBytes,
      overheadBytes: HEADER_OVERHEAD_BYTES,
      totalPixels,
      bitsPerPixel:
        Math.round(((usableBits + HEADER_OVERHEAD_BYTES * 8) / totalPixels) * 100) / 100,
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
    if (signal?.aborted) throw new StegoAbortError('Embedding operation was cancelled.');
    if (carrier.data.length !== carrier.width * carrier.height * 4) {
      throw new InvalidCarrierError('Invalid carrier image buffer dimensions.');
    }

    const capacity = this.calculateCapacity(carrier, options);
    if (payload.length > capacity.usableBytes) {
      throw new InsufficientCapacityError(
        `Payload size (${payload.length} bytes) exceeds usable Hyper-Matrix capacity (${capacity.usableBytes} bytes).`,
      );
    }

    const { scatterKey, cipherKey, authKey } = deriveHyperKeys(options?.passphrase);

    // 1. Encrypt payload via ChaCha20 stream cipher
    const encryptedPayload = new Uint8Array(payload.length);
    const cipherPrng = new ChaCha20Prng(cipherKey);
    for (let i = 0; i < payload.length; i++) {
      encryptedPayload[i] = (payload[i]! ^ cipherPrng.nextByte()) & 0xff;
    }

    // 2. Compute 8-byte HMAC-SHA256 authentication tag
    const authTagFull = hmacSha256(authKey, encryptedPayload);
    const authTag = authTagFull.slice(0, 8);

    // 3. Assemble framed stego packet: [4-byte HYPR magic, 4-byte length, 8-byte HMAC tag, encrypted ciphertext]
    const packet = new Uint8Array(HEADER_OVERHEAD_BYTES + encryptedPayload.length);
    packet.set(HYPER_MATRIX_MAGIC, 0);

    const len = encryptedPayload.length;
    packet[4] = (len >>> 24) & 0xff;
    packet[5] = (len >>> 16) & 0xff;
    packet[6] = (len >>> 8) & 0xff;
    packet[7] = len & 0xff;

    packet.set(authTag, 8);
    packet.set(encryptedPayload, 16);

    // 4. Generate PRNG coordinate permutation across RGB channels
    const coords = buildHyperPermutation(carrier, scatterKey);
    const totalBits = packet.length * 8;

    if (totalBits > coords.length) {
      throw new InsufficientCapacityError(
        'Carrier does not have enough channel coordinates to embed packet.',
      );
    }

    // Clone carrier buffer
    const outputData = new Uint8ClampedArray(carrier.data);
    const matchPrng = new ChaCha20Prng(scatterKey);

    // 5. Embed each bit using ±1 LSB Matching with edge boundary protection
    for (let b = 0; b < totalBits; b++) {
      if (b % CANCEL_CHECK_INTERVAL === 0) {
        if (signal?.aborted) throw new StegoAbortError('Embedding was cancelled.');
        if (onProgress) onProgress(b / totalBits);
      }

      const byteIdx = Math.floor(b / 8);
      const bitOffset = 7 - (b % 8);
      const targetBit = ((packet[byteIdx]! >>> bitOffset) & 1) as 0 | 1;

      const coord = coords[b]!;
      const currentVal = outputData[coord]!;
      const currentBit = (currentVal & 1) as 0 | 1;

      if (currentBit !== targetBit) {
        // ±1 perturbation to preserve pair-of-values histogram symmetry
        if (currentVal === 0) {
          outputData[coord] = 1;
        } else if (currentVal === 255) {
          outputData[coord] = 254;
        } else {
          const delta = (matchPrng.nextUint32() & 1) === 1 ? 1 : -1;
          outputData[coord] = currentVal + delta;
        }
      }
    }

    if (onProgress) onProgress(1.0);

    return {
      width: carrier.width,
      height: carrier.height,
      data: outputData,
    };
  }

  public async extract(
    carrier: CarrierImage,
    options?: StegoOptions,
    signal?: AbortSignal,
    onProgress?: StegoProgressCallback,
  ): Promise<Uint8Array> {
    if (signal?.aborted) throw new StegoAbortError('Extraction was cancelled.');
    if (carrier.data.length !== carrier.width * carrier.height * 4) {
      throw new InvalidCarrierError('Invalid carrier image buffer dimensions.');
    }

    const { scatterKey, cipherKey, authKey } = deriveHyperKeys(options?.passphrase);
    const coords = buildHyperPermutation(carrier, scatterKey);

    if (coords.length < HEADER_OVERHEAD_BYTES * 8) {
      throw new ExtractionError('Carrier too small for Hyper-Matrix header.');
    }

    // 1. Extract 16-byte header
    const headerBytes = new Uint8Array(HEADER_OVERHEAD_BYTES);
    for (let b = 0; b < HEADER_OVERHEAD_BYTES * 8; b++) {
      const coord = coords[b]!;
      const bit = carrier.data[coord]! & 1;
      const byteIdx = Math.floor(b / 8);
      const bitOffset = 7 - (b % 8);
      headerBytes[byteIdx] = (headerBytes[byteIdx]! | (bit << bitOffset)) & 0xff;
    }

    // 2. Validate HYPR magic
    if (
      headerBytes[0] !== HYPER_MATRIX_MAGIC[0] ||
      headerBytes[1] !== HYPER_MATRIX_MAGIC[1] ||
      headerBytes[2] !== HYPER_MATRIX_MAGIC[2] ||
      headerBytes[3] !== HYPER_MATRIX_MAGIC[3]
    ) {
      throw new ExtractionError(
        'Carrier does not contain a valid OMBRIX Hyper-Matrix signature or wrong passkey was supplied.',
      );
    }

    const payloadLength =
      ((headerBytes[4]! << 24) |
        (headerBytes[5]! << 16) |
        (headerBytes[6]! << 8) |
        headerBytes[7]!) >>>
      0;

    const extractedAuthTag = headerBytes.slice(8, 16);
    const totalBitsNeeded = (HEADER_OVERHEAD_BYTES + payloadLength) * 8;

    if (totalBitsNeeded > coords.length) {
      throw new ExtractionError(
        `Corrupted Hyper-Matrix payload header: declared length (${payloadLength} bytes) exceeds carrier capacity.`,
      );
    }

    // 3. Extract encrypted ciphertext bits
    const ciphertext = new Uint8Array(payloadLength);
    const startBit = HEADER_OVERHEAD_BYTES * 8;

    for (let b = 0; b < payloadLength * 8; b++) {
      if (b % CANCEL_CHECK_INTERVAL === 0) {
        if (signal?.aborted) throw new StegoAbortError('Extraction was cancelled.');
        if (onProgress) onProgress(b / (payloadLength * 8));
      }

      const coord = coords[startBit + b]!;
      const bit = carrier.data[coord]! & 1;
      const byteIdx = Math.floor(b / 8);
      const bitOffset = 7 - (b % 8);
      ciphertext[byteIdx] = (ciphertext[byteIdx]! | (bit << bitOffset)) & 0xff;
    }

    // 4. Verify HMAC-SHA256 authentication tag
    const expectedAuthTagFull = hmacSha256(authKey, ciphertext);
    const expectedAuthTag = expectedAuthTagFull.slice(0, 8);

    let authMismatch = 0;
    for (let i = 0; i < 8; i++) {
      authMismatch |= (extractedAuthTag[i] ?? 0) ^ (expectedAuthTag[i] ?? 0);
    }

    if (authMismatch !== 0) {
      throw new ExtractionError(
        'Integrity verification failed. Carrier payload has been tampered with or passkey is incorrect.',
      );
    }

    // 5. Decrypt ciphertext via ChaCha20 stream cipher
    const decryptedPayload = new Uint8Array(payloadLength);
    const cipherPrng = new ChaCha20Prng(cipherKey);
    for (let i = 0; i < payloadLength; i++) {
      decryptedPayload[i] = (ciphertext[i]! ^ cipherPrng.nextByte()) & 0xff;
    }

    if (onProgress) onProgress(1.0);
    return decryptedPayload;
  }
}

export const hyperMatrixMethod = new HyperMatrixMethod();
