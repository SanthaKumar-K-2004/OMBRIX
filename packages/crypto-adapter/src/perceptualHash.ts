import { sha256Pure } from './passkey.js';
import { getSodium } from './sodium.js';

/**
 * Computes a 256-bit (32-byte) Perceptual Visual Key from an image's RGBA pixel raster.
 *
 * Divides the carrier image into an 8x8 superblock array (each superblock averaging
 * hundreds to thousands of pixels, eliminating local JPEG quantization noise).
 *
 * Computes inter-block horizontal and vertical luminance gradients and block-vs-global
 * threshold bits to form an invariant 256-bit feature vector.
 */
export function computePerceptualHashFromRgba(
  width: number,
  height: number,
  rgba: Uint8Array | Uint8ClampedArray,
): Uint8Array {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) {
    throw new Error('Invalid image dimensions or RGBA buffer length for perceptual hashing.');
  }

  const GRID_SIZE = 8; // 8x8 = 64 superblocks
  const cellW = width / GRID_SIZE;
  const cellH = height / GRID_SIZE;
  const blockMeans = new Float32Array(GRID_SIZE * GRID_SIZE);
  let totalLum = 0;

  for (let by = 0; by < GRID_SIZE; by++) {
    const y0 = Math.floor(by * cellH);
    const y1 = Math.min(height, Math.floor((by + 1) * cellH));
    for (let bx = 0; bx < GRID_SIZE; bx++) {
      const x0 = Math.floor(bx * cellW);
      const x1 = Math.min(width, Math.floor((bx + 1) * cellW));

      let sum = 0;
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * width + x) * 4;
          const r = rgba[idx] ?? 0;
          const g = rgba[idx + 1] ?? 0;
          const b = rgba[idx + 2] ?? 0;
          sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
          count++;
        }
      }
      const mean = count > 0 ? sum / count : 0;
      blockMeans[by * GRID_SIZE + bx] = mean;
      totalLum += mean;
    }
  }

  const globalMean = totalLum / (GRID_SIZE * GRID_SIZE);

  // Bit vector 1: 64 bits (8 bytes) comparing each block to global mean
  const meanBits = new Uint8Array(8);
  for (let i = 0; i < 64; i++) {
    const bit = (blockMeans[i] ?? 0) >= globalMean ? 1 : 0;
    const byteIdx = Math.floor(i / 8);
    const bitOffset = 7 - (i % 8);
    meanBits[byteIdx] = (meanBits[byteIdx] ?? 0) | (bit << bitOffset);
  }

  // Bit vector 2: 56 bits (7 bytes) horizontal differential gradients
  const horizBits = new Uint8Array(8);
  let hCursor = 0;
  for (let by = 0; by < GRID_SIZE; by++) {
    for (let bx = 0; bx < GRID_SIZE - 1; bx++) {
      const left = blockMeans[by * GRID_SIZE + bx] ?? 0;
      const right = blockMeans[by * GRID_SIZE + (bx + 1)] ?? 0;
      const bit = right >= left ? 1 : 0;
      const byteIdx = Math.floor(hCursor / 8);
      const bitOffset = 7 - (hCursor % 8);
      horizBits[byteIdx] = (horizBits[byteIdx] ?? 0) | (bit << bitOffset);
      hCursor++;
    }
  }

  // Bit vector 3: 56 bits (7 bytes) vertical differential gradients
  const vertBits = new Uint8Array(8);
  let vCursor = 0;
  for (let by = 0; by < GRID_SIZE - 1; by++) {
    for (let bx = 0; bx < GRID_SIZE; bx++) {
      const top = blockMeans[by * GRID_SIZE + bx] ?? 0;
      const bottom = blockMeans[(by + 1) * GRID_SIZE + bx] ?? 0;
      const bit = bottom >= top ? 1 : 0;
      const byteIdx = Math.floor(vCursor / 8);
      const bitOffset = 7 - (vCursor % 8);
      vertBits[byteIdx] = (vertBits[byteIdx] ?? 0) | (bit << bitOffset);
      vCursor++;
    }
  }

  // Assemble full feature vector
  const salt = new TextEncoder().encode('OMBRIX_PERCEPTUAL_VISUAL_KEY_V2');
  const combined = new Uint8Array(salt.length + 24);
  combined.set(salt, 0);
  combined.set(meanBits, salt.length);
  combined.set(horizBits, salt.length + 8);
  combined.set(vertBits, salt.length + 16);

  try {
    const sodium = getSodium();
    return sodium.crypto_generichash(32, combined, null);
  } catch {
    return sha256Pure(combined);
  }
}
