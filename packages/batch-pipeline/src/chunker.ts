import { ChunkReassemblyError, InsufficientBatchCapacityError } from './errors.js';
import type { BatchEmbedTask, CarrierBatchItem } from './types.js';

const CHUNK_MAGIC = new Uint8Array([0x4f, 0x4d, 0x42, 0x5f]); // "OMB_"
const CHUNK_HEADER_SIZE = 12; // 4 magic + 2 index + 2 total + 4 length

export function createChunkEnvelope(
  chunkIndex: number,
  totalChunks: number,
  data: Uint8Array,
): Uint8Array {
  const result = new Uint8Array(CHUNK_HEADER_SIZE + data.length);
  // Magic bytes
  result.set(CHUNK_MAGIC, 0);

  // Big-endian uint16 chunkIndex
  result[4] = (chunkIndex >> 8) & 0xff;
  result[5] = chunkIndex & 0xff;

  // Big-endian uint16 totalChunks
  result[6] = (totalChunks >> 8) & 0xff;
  result[7] = totalChunks & 0xff;

  // Big-endian uint32 payloadLength
  result[8] = (data.length >> 24) & 0xff;
  result[9] = (data.length >> 16) & 0xff;
  result[10] = (data.length >> 8) & 0xff;
  result[11] = data.length & 0xff;

  // Data
  result.set(data, CHUNK_HEADER_SIZE);
  return result;
}

export function parseChunkEnvelope(chunkBytes: Uint8Array): {
  readonly chunkIndex: number;
  readonly totalChunks: number;
  readonly data: Uint8Array;
} {
  if (chunkBytes.length < CHUNK_HEADER_SIZE) {
    throw new ChunkReassemblyError(
      `Chunk buffer too short: ${chunkBytes.length} bytes (minimum ${CHUNK_HEADER_SIZE}).`,
    );
  }

  // Check magic "OMB_"
  for (let i = 0; i < 4; i++) {
    if (chunkBytes[i] !== CHUNK_MAGIC[i]) {
      throw new ChunkReassemblyError('Invalid chunk magic signature (expected "OMB_").');
    }
  }

  const chunkIndex = ((chunkBytes[4] ?? 0) << 8) | (chunkBytes[5] ?? 0);
  const totalChunks = ((chunkBytes[6] ?? 0) << 8) | (chunkBytes[7] ?? 0);
  const payloadLength =
    (((chunkBytes[8] ?? 0) << 24) |
      ((chunkBytes[9] ?? 0) << 16) |
      ((chunkBytes[10] ?? 0) << 8) |
      (chunkBytes[11] ?? 0)) >>>
    0;

  if (chunkBytes.length < CHUNK_HEADER_SIZE + payloadLength) {
    throw new ChunkReassemblyError(
      `Truncated chunk payload: declared ${payloadLength} bytes, but only ${chunkBytes.length - CHUNK_HEADER_SIZE} available.`,
    );
  }

  const data = chunkBytes.slice(CHUNK_HEADER_SIZE, CHUNK_HEADER_SIZE + payloadLength);
  return {
    chunkIndex,
    totalChunks,
    data,
  };
}

export function splitPayloadAcrossCarriers(
  payload: Uint8Array,
  carriers: readonly CarrierBatchItem[],
): BatchEmbedTask[] {
  const validCarriers = carriers.filter(
    (c) => c.isValid && c.carrierImage && c.capacityBytes > CHUNK_HEADER_SIZE,
  );

  if (validCarriers.length === 0) {
    throw new InsufficientBatchCapacityError(payload.length, 0);
  }

  const maxUsableCapacities = validCarriers.map((c) => c.capacityBytes - CHUNK_HEADER_SIZE);
  const totalNetCapacity = maxUsableCapacities.reduce((a, b) => a + b, 0);

  if (totalNetCapacity < payload.length) {
    throw new InsufficientBatchCapacityError(payload.length, totalNetCapacity);
  }

  // Determine how many carriers are needed
  const selectedCarriers: CarrierBatchItem[] = [];
  const chunkSizes: number[] = [];
  let remainingBytes = payload.length;

  for (let i = 0; i < validCarriers.length; i++) {
    const carrier = validCarriers[i];
    if (!carrier) continue;
    const maxCapacity = carrier.capacityBytes - CHUNK_HEADER_SIZE;
    const alloc = Math.min(remainingBytes, maxCapacity);
    selectedCarriers.push(carrier);
    chunkSizes.push(alloc);
    remainingBytes -= alloc;
    if (remainingBytes <= 0) break;
  }

  const totalChunks = selectedCarriers.length;
  const tasks: BatchEmbedTask[] = [];
  let offset = 0;

  for (let i = 0; i < totalChunks; i++) {
    const carrier = selectedCarriers[i];
    const size = chunkSizes[i] ?? 0;
    if (!carrier || !carrier.carrierImage) continue;

    const slice = payload.slice(offset, offset + size);
    offset += size;

    const chunkPayload = createChunkEnvelope(i, totalChunks, slice);
    tasks.push({
      id: `task-chunk-${i + 1}`,
      carrierName: carrier.name,
      carrierImage: carrier.carrierImage,
      payloadBytes: chunkPayload,
    });
  }

  return tasks;
}

export function reassembleChunkedPayload(chunkBuffers: readonly Uint8Array[]): Uint8Array {
  if (chunkBuffers.length === 0) {
    throw new ChunkReassemblyError('No chunk buffers provided for reassembly.');
  }

  const parsedChunks: Array<{
    chunkIndex: number;
    totalChunks: number;
    data: Uint8Array;
  }> = [];

  let expectedTotal = 0;

  for (let i = 0; i < chunkBuffers.length; i++) {
    const buf = chunkBuffers[i];
    if (!buf) continue;
    const parsed = parseChunkEnvelope(buf);
    if (i === 0) {
      expectedTotal = parsed.totalChunks;
    } else if (parsed.totalChunks !== expectedTotal) {
      throw new ChunkReassemblyError(
        `Mismatched totalChunks in batch: expected ${expectedTotal}, but chunk had ${parsed.totalChunks}.`,
      );
    }
    parsedChunks.push(parsed);
  }

  if (parsedChunks.length !== expectedTotal) {
    throw new ChunkReassemblyError(
      `Incomplete chunk set: received ${parsedChunks.length} chunks, but expected ${expectedTotal}.`,
    );
  }

  // Sort by chunkIndex
  parsedChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

  // Validate contiguous 0 .. totalChunks - 1
  let totalDataLength = 0;
  for (let i = 0; i < expectedTotal; i++) {
    const chunk = parsedChunks[i];
    if (!chunk || chunk.chunkIndex !== i) {
      throw new ChunkReassemblyError(`Missing chunk index ${i} in reconstructed stream.`);
    }
    totalDataLength += chunk.data.length;
  }

  // Concatenate
  const combined = new Uint8Array(totalDataLength);
  let writeOffset = 0;
  for (let i = 0; i < expectedTotal; i++) {
    const chunk = parsedChunks[i];
    if (!chunk) continue;
    combined.set(chunk.data, writeOffset);
    writeOffset += chunk.data.length;
  }

  return combined;
}
