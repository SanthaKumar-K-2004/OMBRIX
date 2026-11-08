import { crc32 } from '@ombrix/image-validation';
import { parseOpticalFrame } from './frame.js';
import type { OpticalAssemblyResult, OpticalFrame } from './types.js';

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class OpticalFrameAssembler {
  private sequenceId: string | null = null;
  private totalFrames = 0;
  private totalPayloadBytes = 0;
  private overallCrc32 = 0;
  private readonly frames = new Map<number, Uint8Array>();

  addFrame(input: OpticalFrame | string): OpticalAssemblyResult {
    const frame: OpticalFrame = typeof input === 'string' ? parseOpticalFrame(input) : input;

    if (this.sequenceId === null) {
      this.sequenceId = frame.sequenceId;
      this.totalFrames = frame.totalFrames;
      this.totalPayloadBytes = frame.totalPayloadBytes;
      this.overallCrc32 = frame.overallCrc32;
    } else if (this.sequenceId !== frame.sequenceId) {
      throw new Error(
        `Sequence mismatch: active ${this.sequenceId} vs received ${frame.sequenceId}. Call reset() first.`,
      );
    }

    if (!this.frames.has(frame.frameIndex)) {
      const chunkBytes = base64ToUint8(frame.chunkBase64);
      this.frames.set(frame.frameIndex, chunkBytes);
    }

    const missingFrames: number[] = [];
    for (let i = 0; i < this.totalFrames; i++) {
      if (!this.frames.has(i)) {
        missingFrames.push(i);
      }
    }

    const receivedFrames = this.frames.size;
    const progressPercent =
      this.totalFrames > 0 ? Math.round((receivedFrames / this.totalFrames) * 100) : 0;

    if (missingFrames.length === 0) {
      // Reassemble full payload
      const combined = new Uint8Array(this.totalPayloadBytes);
      let offset = 0;
      for (let i = 0; i < this.totalFrames; i++) {
        const chunk = this.frames.get(i);
        if (!chunk) throw new Error(`Missing frame ${i} during reassembly`);
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const verifiedCrc = crc32(combined);
      if (verifiedCrc !== this.overallCrc32) {
        throw new Error(
          `Overall sequence CRC32 mismatch: expected ${this.overallCrc32}, calculated ${verifiedCrc}`,
        );
      }

      return {
        complete: true,
        data: combined,
        receivedFrames,
        totalFrames: this.totalFrames,
        missingFrames: [],
        progressPercent: 100,
      };
    }

    return {
      complete: false,
      receivedFrames,
      totalFrames: this.totalFrames,
      missingFrames,
      progressPercent,
    };
  }

  isComplete(): boolean {
    return this.sequenceId !== null && this.frames.size === this.totalFrames;
  }

  reset(): void {
    this.sequenceId = null;
    this.totalFrames = 0;
    this.totalPayloadBytes = 0;
    this.overallCrc32 = 0;
    this.frames.clear();
  }
}
