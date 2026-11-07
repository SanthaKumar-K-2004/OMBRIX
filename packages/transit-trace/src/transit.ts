import type { CarrierImage, StegoMethod } from '@ombrix/stego-interface';
import type { TransitOptions, TransitSimulationResult, TransitTransformType } from './types.js';

/**
 * Simulates 8x8 block discrete cosine transform (DCT) quantization typical of lossy JPEG encoders.
 */
export function simulateJpegCompression(carrier: CarrierImage, quality = 80): CarrierImage {
  const q = Math.max(1, Math.min(100, quality));
  const scale = q < 50 ? Math.floor(5000 / q) : 200 - q * 2;
  const quantStep = Math.max(1, Math.round((scale * 16) / 100));

  const width = carrier.width;
  const height = carrier.height;
  const src = carrier.data;
  const out = new Uint8ClampedArray(src.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Apply 8x8 block-based quantization perturbation
      const blockX = x % 8;
      const blockY = y % 8;
      const freqWeight = 1 + (blockX + blockY) * 0.15;
      const step = Math.max(1, Math.round(quantStep * freqWeight));

      for (let c = 0; c < 3; c++) {
        const val = src[idx + c] ?? 0;
        // Quantize and reconstruct
        const quantized = Math.round(val / step) * step;
        out[idx + c] = Math.max(0, Math.min(255, quantized));
      }

      // Preserve Alpha
      out[idx + 3] = src[idx + 3] ?? 255;
    }
  }

  return { width, height, data: out };
}

/**
 * Simulates downsampling by scaleFactor followed by bilinear upsampling back to original size.
 */
export function simulateResize(carrier: CarrierImage, scaleFactor = 0.5): CarrierImage {
  const factor = Math.max(0.1, Math.min(0.99, scaleFactor));
  const origW = carrier.width;
  const origH = carrier.height;
  const src = carrier.data;

  const smallW = Math.max(1, Math.round(origW * factor));
  const smallH = Math.max(1, Math.round(origH * factor));

  // Step 1: Downsample into intermediate buffer
  const smallData = new Float32Array(smallW * smallH * 4);
  for (let sy = 0; sy < smallH; sy++) {
    for (let sx = 0; sx < smallW; sx++) {
      const srcX = Math.min(origW - 1, Math.floor(sx / factor));
      const srcY = Math.min(origH - 1, Math.floor(sy / factor));
      const srcIdx = (srcY * origW + srcX) * 4;
      const smallIdx = (sy * smallW + sx) * 4;

      smallData[smallIdx] = src[srcIdx] ?? 0;
      smallData[smallIdx + 1] = src[srcIdx + 1] ?? 0;
      smallData[smallIdx + 2] = src[srcIdx + 2] ?? 0;
      smallData[smallIdx + 3] = src[srcIdx + 3] ?? 255;
    }
  }

  // Step 2: Bilinear upsample back to original dimensions
  const out = new Uint8ClampedArray(origW * origH * 4);
  for (let dy = 0; dy < origH; dy++) {
    for (let dx = 0; dx < origW; dx++) {
      const gx = dx * factor;
      const gy = dy * factor;

      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const x1 = Math.min(smallW - 1, x0 + 1);
      const y1 = Math.min(smallH - 1, y0 + 1);

      const xWeight = gx - x0;
      const yWeight = gy - y0;

      const idx00 = (y0 * smallW + x0) * 4;
      const idx10 = (y0 * smallW + x1) * 4;
      const idx01 = (y1 * smallW + x0) * 4;
      const idx11 = (y1 * smallW + x1) * 4;

      const outIdx = (dy * origW + dx) * 4;

      for (let c = 0; c < 3; c++) {
        const val00 = smallData[idx00 + c] ?? 0;
        const val10 = smallData[idx10 + c] ?? 0;
        const val01 = smallData[idx01 + c] ?? 0;
        const val11 = smallData[idx11 + c] ?? 0;

        const top = val00 * (1 - xWeight) + val10 * xWeight;
        const bottom = val01 * (1 - xWeight) + val11 * xWeight;
        const val = top * (1 - yWeight) + bottom * yWeight;

        out[outIdx + c] = Math.max(0, Math.min(255, Math.round(val)));
      }

      out[outIdx + 3] = src[outIdx + 3] ?? 255;
    }
  }

  return { width: origW, height: origH, data: out };
}

/**
 * Simulates transmission channel noise by randomly corrupting bits.
 */
export function simulateNoise(carrier: CarrierImage, errorRate = 0.01): CarrierImage {
  const rate = Math.max(0.0001, Math.min(0.5, errorRate));
  const src = carrier.data;
  const out = new Uint8ClampedArray(src.length);
  out.set(src);

  // Deterministic LCG
  let rng = 0xabcdef12;

  for (let i = 0; i < out.length; i++) {
    if (i % 4 === 3) continue; // Keep Alpha intact

    rng = (1664525 * rng + 1013904223) >>> 0;
    const randFrac = (rng & 0xffff) / 0xffff;

    if (randFrac < rate) {
      // Flip random bit in byte
      const bitPos = (rng >> 16) % 8;
      out[i] = (out[i] ?? 0) ^ (1 << bitPos);
    }
  }

  return { width: carrier.width, height: carrier.height, data: out };
}

/**
 * Executes an end-to-end transit transformation and tests steganographic payload survival.
 */
export async function runTransitSimulation(
  stegoCarrier: CarrierImage,
  stegoMethod: StegoMethod,
  transformType: TransitTransformType,
  options: TransitOptions = {},
  expectedPayload?: Uint8Array,
): Promise<TransitSimulationResult> {
  let transformed: CarrierImage;
  const params: Record<string, number | string> = {};

  switch (transformType) {
    case 'JPEG': {
      const quality = options.jpegQuality ?? 80;
      params.quality = quality;
      transformed = simulateJpegCompression(stegoCarrier, quality);
      break;
    }
    case 'RESIZE': {
      const scale = options.scaleFactor ?? 0.5;
      params.scaleFactor = scale;
      transformed = simulateResize(stegoCarrier, scale);
      break;
    }
    case 'NOISE': {
      const rate = options.errorRate ?? 0.01;
      params.errorRate = rate;
      transformed = simulateNoise(stegoCarrier, rate);
      break;
    }
    case 'SOCIAL_MEDIA': {
      // Social media pipeline: scale 75% + JPEG 75%
      params.pipeline = 'Resize 75% + JPEG 75%';
      const resized = simulateResize(stegoCarrier, 0.75);
      transformed = simulateJpegCompression(resized, 75);
      break;
    }
  }

  try {
    const recovered = await stegoMethod.extract(transformed);

    let match = true;
    if (expectedPayload) {
      if (recovered.length !== expectedPayload.length) {
        match = false;
      } else {
        for (let i = 0; i < expectedPayload.length; i++) {
          if (recovered[i] !== expectedPayload[i]) {
            match = false;
            break;
          }
        }
      }
    }

    return {
      transformType,
      parameters: params,
      transformedCarrier: transformed,
      payloadRecovered: match,
      recoveredByteCount: recovered.length,
      errorSummary: match
        ? undefined
        : 'Recovered bytes did not match expected payload due to transmission bit corruptions.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      transformType,
      parameters: params,
      transformedCarrier: transformed,
      payloadRecovered: false,
      errorSummary: `Steganographic extraction failed: ${msg}`,
    };
  }
}
