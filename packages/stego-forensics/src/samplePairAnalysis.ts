import type { CarrierImage } from '@ombrix/stego-interface';
import type { SpaAnalysisResult } from './types.js';

export function analyzeSamplePairs(carrier: CarrierImage): SpaAnalysisResult {
  const data = carrier.data;
  const width = carrier.width;
  const height = carrier.height;

  // In Dumitrescu, Wu, Wang (2003):
  // X: adjacent pairs with |u - v| = 1 inside the same 2-bucket (2k, 2k+1)
  // Y: adjacent pairs with |u - v| = 1 across 2-bucket boundaries (2k-1, 2k)
  // Z: adjacent pairs with u == v (identical values)
  // P: total pairs with difference <= 1
  let countX = 0;
  let countY = 0;
  let countZ = 0;
  let totalPairs = 0;

  // Scan adjacent horizontal and vertical pairs across R, G, B channels
  for (let c = 0; c < 3; c++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx0 = (y * width + x) * 4 + c;
        const u = data[idx0] ?? 0;

        // Horizontal neighbor (x + 1)
        if (x + 1 < width) {
          const idx1 = (y * width + (x + 1)) * 4 + c;
          const v = data[idx1] ?? 0;
          const diff = Math.abs(u - v);

          if (diff === 0) {
            countZ++;
          } else if (diff === 1) {
            const qu = Math.floor(u / 2);
            const qv = Math.floor(v / 2);
            if (qu === qv) {
              countX++;
            } else {
              countY++;
            }
          }
          totalPairs++;
        }

        // Vertical neighbor (y + 1)
        if (y + 1 < height) {
          const idx1 = ((y + 1) * width + x) * 4 + c;
          const v = data[idx1] ?? 0;
          const diff = Math.abs(u - v);

          if (diff === 0) {
            countZ++;
          } else if (diff === 1) {
            const qu = Math.floor(u / 2);
            const qv = Math.floor(v / 2);
            if (qu === qv) {
              countX++;
            } else {
              countY++;
            }
          }
          totalPairs++;
        }
      }
    }
  }

  if (totalPairs === 0) {
    return {
      estimatedPayloadRatio: 0,
      primarySetCounts: { p: 0, x: 0, y: 0, z: 0 },
      confidence: 0,
      classification: 'clean',
    };
  }

  // In natural images with zero steganography, differences of 1 within 2k/2k+1 (X)
  // occur with equal probability to differences of 1 across 2k-1/2k (Y), so X ≈ Y.
  // When LSB replacement is embedded, pairs with u == v (Z) are converted into (2k, 2k+1) pairs in X,
  // causing X to dramatically exceed Y.
  const diffXY = countX - countY;
  const basePairs = countX + countY + Math.floor(countZ * 0.5);

  let rawP = 0;
  if (basePairs > 0 && diffXY > 0) {
    rawP = (2 * diffXY) / basePairs;
  }

  if (!Number.isFinite(rawP) || Number.isNaN(rawP)) {
    rawP = 0;
  }
  const estimatedPayloadRatio = Math.max(0, Math.min(1, rawP));

  let confidence = estimatedPayloadRatio * 0.8 + 0.1;
  if (!Number.isFinite(confidence) || Number.isNaN(confidence)) {
    confidence = 0;
  }
  confidence = Math.max(0, Math.min(1, confidence));

  let classification: 'clean' | 'suspect' | 'stego_detected' = 'clean';
  if (estimatedPayloadRatio > 0.2) {
    classification = 'stego_detected';
  } else if (estimatedPayloadRatio > 0.06) {
    classification = 'suspect';
  }

  return {
    estimatedPayloadRatio: Math.round(estimatedPayloadRatio * 1000) / 1000,
    primarySetCounts: {
      p: countX + countY + countZ,
      x: countX,
      y: countY,
      z: countZ,
    },
    confidence: Math.round(confidence * 100) / 100,
    classification,
  };
}
