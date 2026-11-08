import type { CarrierImage } from '@ombrix/stego-interface';
import type { NoiseResidualResult } from './types.js';

export function computeNoiseResidual(carrier: CarrierImage): NoiseResidualResult {
  const width = carrier.width;
  const height = carrier.height;
  const data = carrier.data;

  const totalPixels = width * height;
  const residuals = new Float32Array(totalPixels);
  const heatmapData = new Uint8ClampedArray(totalPixels * 4);

  let sumResidual = 0;
  let count = 0;

  // 2nd-derivative 4-neighbor Laplacian: 4*I(x,y) - I(x-1,y) - I(x+1,y) - I(x,y-1) - I(x,y+1)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idxCenter = (y * width + x) * 4;
      const idxLeft = (y * width + (x - 1)) * 4;
      const idxRight = (y * width + (x + 1)) * 4;
      const idxTop = ((y - 1) * width + x) * 4;
      const idxBottom = ((y + 1) * width + x) * 4;

      // Average across R, G, B channels
      let resSum = 0;
      for (let c = 0; c < 3; c++) {
        const cCenter = data[idxCenter + c] ?? 0;
        const cLeft = data[idxLeft + c] ?? 0;
        const cRight = data[idxRight + c] ?? 0;
        const cTop = data[idxTop + c] ?? 0;
        const cBottom = data[idxBottom + c] ?? 0;

        const laplacian = 4 * cCenter - cLeft - cRight - cTop - cBottom;
        resSum += laplacian;
      }

      const meanLaplacian = resSum / 3;
      const pixelIdx = y * width + x;
      residuals[pixelIdx] = meanLaplacian;
      sumResidual += meanLaplacian;
      count++;
    }
  }

  const mean = count > 0 ? sumResidual / count : 0;
  let sumSqDiff = 0;
  let sumAbs = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const pixelIdx = y * width + x;
      const res = residuals[pixelIdx] ?? 0;
      const diff = res - mean;
      sumSqDiff += diff * diff;
      sumAbs += Math.abs(res);

      // Generate Heatmap representation:
      // Map absolute residual to Cyan/Purple/Red forensic intensity
      const intensity = Math.min(255, Math.round(Math.abs(res) * 4));
      const heatIdx = pixelIdx * 4;
      // RGBA color map (cooler blue-purple for low noise, vibrant red-orange for high noise)
      if (intensity < 64) {
        heatmapData[heatIdx] = 15; // R
        heatmapData[heatIdx + 1] = 23 + intensity * 2; // G
        heatmapData[heatIdx + 2] = 42 + intensity * 3; // B
        heatmapData[heatIdx + 3] = 255;
      } else if (intensity < 160) {
        heatmapData[heatIdx] = 20; // R
        heatmapData[heatIdx + 1] = Math.min(255, 184 + intensity); // G
        heatmapData[heatIdx + 2] = 166; // B
        heatmapData[heatIdx + 3] = 255;
      } else {
        heatmapData[heatIdx] = 244; // R (high anomaly)
        heatmapData[heatIdx + 1] = 63; // G
        heatmapData[heatIdx + 2] = 94; // B
        heatmapData[heatIdx + 3] = 255;
      }
    }
  }

  const variance = count > 0 ? sumSqDiff / count : 0;
  const standardDeviation = Math.sqrt(variance);
  const meanAbsoluteResidual = count > 0 ? sumAbs / count : 0;

  // Normalized HFPI (High Frequency Perturbation Index, typically 0 - 100)
  const hfpi = Math.min(100, Math.round(standardDeviation * 2.5 * 10) / 10);

  return {
    variance: Math.round(variance * 100) / 100,
    standardDeviation: Math.round(standardDeviation * 100) / 100,
    meanAbsoluteResidual: Math.round(meanAbsoluteResidual * 100) / 100,
    highFrequencyPerturbationIndex: hfpi,
    heatmapData,
    width,
    height,
  };
}
