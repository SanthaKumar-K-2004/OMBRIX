import { describe, expect, it } from 'vitest';
import { auditCarrierItem } from '../src/audit.js';
import {
  createChunkEnvelope,
  parseChunkEnvelope,
  reassembleChunkedPayload,
  splitPayloadAcrossCarriers,
} from '../src/chunker.js';
import { ChunkReassemblyError, InsufficientBatchCapacityError } from '../src/errors.js';

describe('@ombrix/batch-pipeline - Chunker & Multi-Carrier Reassembly', () => {
  it('envelopes and parses a single chunk with header', () => {
    const data = new TextEncoder().encode('Hello Chunk');
    const enveloped = createChunkEnvelope(1, 5, data);

    const parsed = parseChunkEnvelope(enveloped);
    expect(parsed.chunkIndex).toBe(1);
    expect(parsed.totalChunks).toBe(5);
    expect(new TextDecoder().decode(parsed.data)).toBe('Hello Chunk');
  });

  it('splits large payload across multiple carriers and reassembles perfectly', () => {
    // 3 small carriers: 20x20 = 400 pixels = 1200 bits = 146 bytes capacity each
    const c1 = auditCarrierItem(
      'c1.png',
      {
        width: 20,
        height: 20,
        data: new Uint8ClampedArray(20 * 20 * 4),
      },
      '1',
    );
    const c2 = auditCarrierItem(
      'c2.png',
      {
        width: 20,
        height: 20,
        data: new Uint8ClampedArray(20 * 20 * 4),
      },
      '2',
    );
    const c3 = auditCarrierItem(
      'c3.png',
      {
        width: 20,
        height: 20,
        data: new Uint8ClampedArray(20 * 20 * 4),
      },
      '3',
    );

    // 250 bytes of secret data (requires more than 1 carrier)
    const secretText = 'A'.repeat(250);
    const secretBytes = new TextEncoder().encode(secretText);

    const tasks = splitPayloadAcrossCarriers(secretBytes, [c1, c2, c3]);
    expect(tasks.length).toBeGreaterThanOrEqual(2);

    // Extract chunks from tasks payloadBytes
    const chunkBuffers = tasks.map((t) => t.payloadBytes);
    const recovered = reassembleChunkedPayload(chunkBuffers);

    expect(new TextDecoder().decode(recovered)).toBe(secretText);
  });

  it('throws InsufficientBatchCapacityError when payload exceeds total batch capacity', () => {
    const c1 = auditCarrierItem(
      'small.png',
      {
        width: 10,
        height: 10,
        data: new Uint8ClampedArray(10 * 10 * 4),
      },
      '1',
    ); // capacity is ~33 bytes

    const giantPayload = new Uint8Array(500);

    expect(() => splitPayloadAcrossCarriers(giantPayload, [c1])).toThrow(
      InsufficientBatchCapacityError,
    );
  });

  it('throws ChunkReassemblyError on missing or corrupted chunks', () => {
    const chunk1 = createChunkEnvelope(0, 2, new Uint8Array([1, 2, 3]));
    // Missing chunk 1, passing only chunk 0
    expect(() => reassembleChunkedPayload([chunk1])).toThrow(ChunkReassemblyError);
  });
});
