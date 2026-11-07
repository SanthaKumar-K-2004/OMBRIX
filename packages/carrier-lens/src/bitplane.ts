import type { CarrierImage } from '@ombrix/stego-interface';
import type { BitplaneOptions, BitplaneResult } from './types.js';

export function extractBitplane(carrier: CarrierImage, options: BitplaneOptions): BitplaneResult {
  const { channel, bitIndex, invert = false } = options;
  if (bitIndex < 0 || bitIndex > 7) {
    throw new RangeError(`bitIndex must be between 0 and 7, received ${bitIndex}`);
  }

  const channelOffset = channel === 'r' ? 0 : channel === 'g' ? 1 : channel === 'b' ? 2 : 3;

  const width = carrier.width;
  const height = carrier.height;
  const pixelCount = width * height;
  const src = carrier.data;
  const out = new Uint8ClampedArray(pixelCount * 4);

  const mask = 1 << bitIndex;
  const highVal = invert ? 0 : 255;
  const lowVal = invert ? 255 : 0;

  for (let i = 0; i < pixelCount; i++) {
    const srcIdx = i * 4 + channelOffset;
    const channelVal = src[srcIdx] ?? 0;
    const bit = (channelVal & mask) !== 0;
    const val = bit ? highVal : lowVal;

    const outIdx = i * 4;
    out[outIdx] = val; // R
    out[outIdx + 1] = val; // G
    out[outIdx + 2] = val; // B
    out[outIdx + 3] = 255; // Alpha
  }

  return {
    width,
    height,
    data: out,
  };
}
