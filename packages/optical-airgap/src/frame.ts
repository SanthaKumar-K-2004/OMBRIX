import { crc32 } from '@ombrix/image-validation';
import type { OpticalFrame } from './types.js';

export const DEFAULT_FRAME_BYTES = 512; // optimal density for standard smartphone cameras

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function chunkIntoOpticalFrames(
  data: Uint8Array,
  maxBytesPerFrame: number = DEFAULT_FRAME_BYTES,
): OpticalFrame[] {
  if (data.length === 0) {
    throw new Error('Cannot chunk empty buffer into optical frames');
  }
  if (!Number.isFinite(maxBytesPerFrame) || maxBytesPerFrame <= 0) {
    throw new Error('maxBytesPerFrame must be a positive integer greater than 0');
  }

  const overallCrc = crc32(data);
  const sequenceId = `seq_${data.length}_${overallCrc.toString(16)}`;
  const totalFrames = Math.ceil(data.length / maxBytesPerFrame);

  const frames: OpticalFrame[] = [];

  for (let i = 0; i < totalFrames; i++) {
    const start = i * maxBytesPerFrame;
    const end = Math.min(data.length, start + maxBytesPerFrame);
    const chunk = data.subarray(start, end);

    const chunkCrc = crc32(chunk);
    const chunkBase64 = uint8ToBase64(chunk);

    frames.push({
      magic: 'OMB_OPT_V1',
      sequenceId,
      frameIndex: i,
      totalFrames,
      chunkBase64,
      chunkCrc32: chunkCrc,
      totalPayloadBytes: data.length,
      overallCrc32: overallCrc,
    });
  }

  return frames;
}

export function serializeOpticalFrame(frame: OpticalFrame): string {
  return JSON.stringify(frame);
}

export function parseOpticalFrame(str: string): OpticalFrame {
  const parsed = JSON.parse(str) as OpticalFrame;
  if (parsed.magic !== 'OMB_OPT_V1') {
    throw new Error(`Invalid optical frame magic: expected OMB_OPT_V1, got ${parsed.magic}`);
  }

  if (
    typeof parsed.frameIndex !== 'number' ||
    typeof parsed.totalFrames !== 'number' ||
    parsed.totalFrames <= 0 ||
    parsed.frameIndex < 0 ||
    parsed.frameIndex >= parsed.totalFrames
  ) {
    throw new Error(
      `Malformed optical frame index bounds: frameIndex=${parsed.frameIndex}, totalFrames=${parsed.totalFrames}`,
    );
  }

  // Verify chunk integrity
  const chunkBytes = base64ToUint8(parsed.chunkBase64);
  const computedCrc = crc32(chunkBytes);
  if (computedCrc !== parsed.chunkCrc32) {
    throw new Error(
      `Optical frame ${parsed.frameIndex} CRC32 mismatch: expected ${parsed.chunkCrc32}, calculated ${computedCrc}`,
    );
  }

  return parsed;
}
