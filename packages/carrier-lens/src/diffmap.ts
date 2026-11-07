import type { CarrierImage } from '@ombrix/stego-interface';
import type { DifferenceMapOptions, DifferenceMapResult } from './types.js';

export function computeDifferenceMap(
  carrierA: CarrierImage,
  carrierB: CarrierImage,
  options: DifferenceMapOptions = {},
): DifferenceMapResult {
  if (carrierA.width !== carrierB.width || carrierA.height !== carrierB.height) {
    throw new Error(
      `Dimension mismatch: Carrier A (${carrierA.width}x${carrierA.height}) does not match Carrier B (${carrierB.width}x${carrierB.height}).`,
    );
  }

  const { amplification = 100, includeAlpha = false } = options;
  const width = carrierA.width;
  const height = carrierA.height;
  const pixelCount = width * height;
  const dataA = carrierA.data;
  const dataB = carrierB.data;

  const out = new Uint8ClampedArray(pixelCount * 4);
  let totalDiffPixels = 0;
  let maxDiff = 0;
  let sumDiff = 0;

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const diffR = Math.abs((dataA[idx] ?? 0) - (dataB[idx] ?? 0));
    const diffG = Math.abs((dataA[idx + 1] ?? 0) - (dataB[idx + 1] ?? 0));
    const diffB = Math.abs((dataA[idx + 2] ?? 0) - (dataB[idx + 2] ?? 0));
    const diffA = includeAlpha ? Math.abs((dataA[idx + 3] ?? 0) - (dataB[idx + 3] ?? 0)) : 0;

    const pixelDiff = Math.max(diffR, diffG, diffB, diffA);
    if (pixelDiff > 0) {
      totalDiffPixels++;
      sumDiff += pixelDiff;
      if (pixelDiff > maxDiff) maxDiff = pixelDiff;
    }

    out[idx] = Math.min(255, diffR * amplification);
    out[idx + 1] = Math.min(255, diffG * amplification);
    out[idx + 2] = Math.min(255, diffB * amplification);
    out[idx + 3] = 255; // Always fully opaque for visualization
  }

  const averageDiff = pixelCount > 0 ? sumDiff / pixelCount : 0;

  return {
    width,
    height,
    data: out,
    maxDiff,
    totalDiffPixels,
    averageDiff,
  };
}
