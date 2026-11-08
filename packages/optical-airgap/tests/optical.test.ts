import { describe, expect, it } from 'vitest';
import {
  OpticalFrameAssembler,
  chunkIntoOpticalFrames,
  parseOpticalFrame,
  serializeOpticalFrame,
} from '../src/index.js';

describe('@ombrix/optical-airgap - Physical Optical Frame Protocol', () => {
  it('chunks a payload into sequence of optical frames and reassembles in order', () => {
    const original = new Uint8Array(1500);
    for (let i = 0; i < original.length; i++) {
      original[i] = (i * 17) % 256;
    }

    const frames = chunkIntoOpticalFrames(original, 400);
    expect(frames.length).toBe(4); // 400 + 400 + 400 + 300 = 1500

    const assembler = new OpticalFrameAssembler();
    let result = assembler.addFrame(frames[0]!);
    expect(result.complete).toBe(false);
    expect(result.receivedFrames).toBe(1);

    result = assembler.addFrame(frames[1]!);
    expect(result.complete).toBe(false);

    result = assembler.addFrame(frames[2]!);
    expect(result.complete).toBe(false);

    result = assembler.addFrame(frames[3]!);
    expect(result.complete).toBe(true);
    expect(result.data).toEqual(original);
  });

  it('reassembles out-of-order and handles duplicate frames cleanly', () => {
    const original = new TextEncoder().encode(
      'Air-Gapped Optical Steganography Stream between Isolated Workstations',
    );

    const frames = chunkIntoOpticalFrames(original, 16);
    expect(frames.length).toBeGreaterThan(1);

    const assembler = new OpticalFrameAssembler();

    // Send in reverse order
    for (let i = frames.length - 1; i >= 0; i--) {
      assembler.addFrame(frames[i]!);
    }

    expect(assembler.isComplete()).toBe(true);

    // Duplicate frame send should be idempotent
    const dupRes = assembler.addFrame(frames[0]!);
    expect(dupRes.complete).toBe(true);
    expect(dupRes.data).toEqual(original);
  });

  it('serializes and parses frame strings losslessly', () => {
    const original = new Uint8Array([10, 20, 30, 40]);
    const frames = chunkIntoOpticalFrames(original, 100);
    const frame = frames[0]!;

    const serialized = serializeOpticalFrame(frame);
    expect(typeof serialized).toBe('string');

    const parsed = parseOpticalFrame(serialized);
    expect(parsed.magic).toBe('OMB_OPT_V1');
    expect(parsed.sequenceId).toBe(frame.sequenceId);
    expect(parsed.chunkCrc32).toBe(frame.chunkCrc32);
  });

  it('rejects tampered optical frame chunk with CRC32 mismatch', () => {
    const original = new Uint8Array([1, 2, 3, 4, 5]);
    const frames = chunkIntoOpticalFrames(original, 100);
    const frame = frames[0]!;

    // Tamper with chunkCrc32
    const tampered = { ...frame, chunkCrc32: frame.chunkCrc32 ^ 0xff };
    const serialized = serializeOpticalFrame(tampered);

    expect(() => parseOpticalFrame(serialized)).toThrow(/CRC32 mismatch/);
  });
});
