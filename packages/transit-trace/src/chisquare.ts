import type { CarrierImage } from '@ombrix/stego-interface';
import type { ChiSquareReport, PairOfValuesDistribution } from './types.js';

/**
 * Computes upper regularized incomplete gamma function Q(s, x) via series expansion and Lanczos approximation.
 */
function regularizedGammaQ(s: number, x: number): number {
  if (x < 0 || s <= 0) return 0;
  if (x === 0) return 1;

  // For large degrees of freedom, use Wilson-Hilferty normal approximation
  if (s > 30) {
    const z = ((x / (2 * s)) ** (1 / 3) - (1 - 2 / (9 * (2 * s)))) / Math.sqrt(2 / (9 * (2 * s)));
    return 0.5 * erfc(z / Math.SQRT2);
  }

  // Continued fraction representation for Q(s, x)
  const maxIterations = 200;
  const epsilon = 1e-12;
  let b = x + 1 - s;
  let c = 1 / 1e-30;
  let d = 1 / b;
  let h = d;

  for (let i = 1; i <= maxIterations; i++) {
    const an = -i * (i - s);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < epsilon) break;
  }

  // ln(Gamma(s)) via Stirling / Lanczos
  const lnGamma = logGamma(s);
  const factor = Math.exp(-x + s * Math.log(x) - lnGamma);
  return Math.max(0, Math.min(1, factor * h));
}

function erfc(x: number): number {
  // Abramowitz & Stegun approximation
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

function logGamma(z: number): number {
  const c = [
    57.15623566586292, -59.59796035547549, 14.13609797474175, -0.49191381609762,
    0.33994649984812e-4, 0.46523628927049e-4, -0.9837447530488e-4, 0.15808870322438e-3,
    -0.2102644417241e-3, 0.21743961811521e-3, -0.16431810653676e-3, 0.84418223983853e-4,
    -0.26190838401581e-4, 0.36899182659532e-5,
  ];
  let sum = 0.9999999999999971;
  for (let i = 0; i < c.length; i++) {
    sum += (c[i] ?? 0) / (z + i + 1);
  }
  const t = z + c.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

/**
 * Calculates Chi-Square statistic and degrees of freedom for a sample histogram across 128 Pairs of Values {2k, 2k+1}.
 */
function computePoVChiSquare(hist: Uint32Array): {
  chiSquare: number;
  degreesOfFreedom: number;
  pValue: number;
  pairs: PairOfValuesDistribution[];
} {
  let chiSquareTotal = 0;
  let activePairs = 0;
  const pairs: PairOfValuesDistribution[] = [];

  for (let k = 0; k < 128; k++) {
    const countEven = hist[2 * k] ?? 0;
    const countOdd = hist[2 * k + 1] ?? 0;
    const pairSum = countEven + countOdd;

    if (pairSum > 4) {
      activePairs++;
      const expected = pairSum / 2;
      const diff = countEven - expected;
      const chiContribution = (diff * diff) / expected;
      chiSquareTotal += chiContribution;

      pairs.push({
        pairIndex: k,
        countEven,
        countOdd,
        expected,
        chiSquareContribution: Math.round(chiContribution * 100) / 100,
      });
    }
  }

  const degreesOfFreedom = Math.max(1, activePairs - 1);
  const pValue = Math.max(
    0,
    Math.min(1, regularizedGammaQ(degreesOfFreedom / 2, chiSquareTotal / 2)),
  );

  return {
    chiSquare: Math.round(chiSquareTotal * 100) / 100,
    degreesOfFreedom,
    pValue: Math.round(pValue * 1000) / 1000,
    pairs,
  };
}

/**
 * Performs Westfeld & Pfitzmann (1999) Chi-Square attack across Pairs of Values (PoVs).
 * Evaluates both whole-image histogram and localized sliding blocks to detect partial/sequential LSB embeds.
 */
export function analyzeChiSquare(carrier: CarrierImage): ChiSquareReport {
  const data = carrier.data;
  const pixelCount = carrier.width * carrier.height;
  const totalSamples = pixelCount * 3;

  // Extract all RGB samples
  const samples = new Uint8Array(totalSamples);
  let sampleIdx = 0;
  for (let i = 0; i < pixelCount; i++) {
    const base = i * 4;
    samples[sampleIdx++] = data[base] ?? 0;
    samples[sampleIdx++] = data[base + 1] ?? 0;
    samples[sampleIdx++] = data[base + 2] ?? 0;
  }

  // 1. Global histogram across full image
  const globalHist = new Uint32Array(256);
  for (let i = 0; i < totalSamples; i++) {
    globalHist[samples[i]!] = (globalHist[samples[i]!] ?? 0) + 1;
  }
  const globalResult = computePoVChiSquare(globalHist);

  // 2. Localized sliding block scan (Westfeld PoV block analysis)
  // Essential for catching payloads that only occupy the first rows/fraction of an image
  const blockSize = Math.min(2048, Math.max(512, Math.floor(totalSamples / 16)));
  let peakLocalPValue = 0;
  let anomalousBlocksCount = 0;
  const totalBlocks = Math.max(1, Math.floor(totalSamples / blockSize));

  for (let b = 0; b < totalBlocks; b++) {
    const start = b * blockSize;
    const end = Math.min(start + blockSize, totalSamples);
    const blockHist = new Uint32Array(256);
    for (let i = start; i < end; i++) {
      blockHist[samples[i]!] = (blockHist[samples[i]!] ?? 0) + 1;
    }
    const blockResult = computePoVChiSquare(blockHist);
    if (blockResult.degreesOfFreedom >= 8) {
      if (blockResult.pValue > peakLocalPValue) {
        peakLocalPValue = blockResult.pValue;
      }
      if (blockResult.pValue >= 0.7) {
        anomalousBlocksCount++;
      }
    }
  }

  // Final effective pValue is the maximum of global and localized block detections
  const effectivePValue = Math.max(globalResult.pValue, peakLocalPValue);

  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN' = 'CLEAN';
  let anomalyDetected = false;

  if (effectivePValue >= 0.85 || anomalousBlocksCount >= 2) {
    anomalyDetected = true;
    confidence = 'HIGH';
  } else if (effectivePValue >= 0.65 || anomalousBlocksCount >= 1) {
    anomalyDetected = true;
    confidence = 'MEDIUM';
  } else if (effectivePValue >= 0.45) {
    anomalyDetected = true;
    confidence = 'LOW';
  }

  // Sort pairs by chiSquareContribution descending
  globalResult.pairs.sort((a, b) => b.chiSquareContribution - a.chiSquareContribution);

  return {
    chiSquare: globalResult.chiSquare,
    degreesOfFreedom: globalResult.degreesOfFreedom,
    pValue: effectivePValue,
    anomalyDetected,
    confidence,
    sampleCount: totalSamples,
    topDeviatingPairs: globalResult.pairs.slice(0, 10),
  };
}
