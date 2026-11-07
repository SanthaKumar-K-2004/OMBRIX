import type { CarrierImage } from '@ombrix/stego-interface';
import type { StegoDistortionReport } from './types.js';

export function calculateDistortion(
  original: CarrierImage,
  stego: CarrierImage,
): StegoDistortionReport {
  if (original.width !== stego.width || original.height !== stego.height) {
    throw new Error(
      `Dimension mismatch: Original (${original.width}x${original.height}) vs Stego (${stego.width}x${stego.height})`,
    );
  }

  const dataA = original.data;
  const dataB = stego.data;
  const pixelCount = original.width * original.height;
  const totalRgbChannels = pixelCount * 3;

  let sumSquaredDiff = 0;
  let totalAlteredChannels = 0;
  let maxChannelDiff = 0;

  // Global mean accumulators
  let sumA = 0;
  let sumB = 0;

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    for (let c = 0; c < 3; c++) {
      const valA = dataA[idx + c] ?? 0;
      const valB = dataB[idx + c] ?? 0;
      const diff = Math.abs(valA - valB);

      if (diff > 0) {
        totalAlteredChannels++;
        if (diff > maxChannelDiff) maxChannelDiff = diff;
      }

      sumSquaredDiff += diff * diff;
      sumA += valA;
      sumB += valB;
    }
  }

  const mse = totalRgbChannels > 0 ? sumSquaredDiff / totalRgbChannels : 0;
  const psnr = mse === 0 ? Number.POSITIVE_INFINITY : 10 * Math.log10((255 * 255) / mse);

  // Compute SSIM
  const meanA = totalRgbChannels > 0 ? sumA / totalRgbChannels : 0;
  const meanB = totalRgbChannels > 0 ? sumB / totalRgbChannels : 0;

  let varSumA = 0;
  let varSumB = 0;
  let covarSum = 0;

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    for (let c = 0; c < 3; c++) {
      const valA = dataA[idx + c] ?? 0;
      const valB = dataB[idx + c] ?? 0;
      const diffA = valA - meanA;
      const diffB = valB - meanB;

      varSumA += diffA * diffA;
      varSumB += diffB * diffB;
      covarSum += diffA * diffB;
    }
  }

  const varA = totalRgbChannels > 1 ? varSumA / (totalRgbChannels - 1) : 0;
  const varB = totalRgbChannels > 1 ? varSumB / (totalRgbChannels - 1) : 0;
  const covar = totalRgbChannels > 1 ? covarSum / (totalRgbChannels - 1) : 0;

  const C1 = (0.01 * 255) ** 2; // 6.5025
  const C2 = (0.03 * 255) ** 2; // 58.5225

  const numerator = (2 * meanA * meanB + C1) * (2 * covar + C2);
  const denominator = (meanA * meanA + meanB * meanB + C1) * (varA + varB + C2);
  const ssim = denominator !== 0 ? numerator / denominator : 1;

  return {
    mse,
    psnr,
    ssim: Math.max(-1, Math.min(1, ssim)),
    totalAlteredChannels,
    maxChannelDiff,
  };
}
