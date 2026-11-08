import type { CarrierImage } from '@ombrix/stego-interface';
import type { RsAnalysisResult } from './types.js';

function f1(x: number): number {
  return x ^ 1;
}

function fNeg1(x: number): number {
  if ((x & 1) === 0) {
    return x > 0 ? x - 1 : 0;
  }
  return x < 255 ? x + 1 : 255;
}

function variation(g: readonly [number, number, number, number]): number {
  return (
    Math.abs((g[1] ?? 0) - (g[0] ?? 0)) +
    Math.abs((g[2] ?? 0) - (g[1] ?? 0)) +
    Math.abs((g[3] ?? 0) - (g[2] ?? 0))
  );
}

export function analyzeRsSteganalysis(carrier: CarrierImage): RsAnalysisResult {
  const data = carrier.data;
  const width = carrier.width;
  const height = carrier.height;

  let regularM = 0;
  let singularM = 0;
  let regularNegM = 0;
  let singularNegM = 0;

  let regularM1 = 0;
  let singularM1 = 0;
  let regularNegM1 = 0;
  let singularNegM1 = 0;

  let totalGroups = 0;

  // Scan across R, G, B channels in groups of 4 horizontal adjacent pixels
  for (let c = 0; c < 3; c++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x + 3 < width; x += 4) {
        const idx0 = (y * width + x) * 4 + c;
        const idx1 = (y * width + (x + 1)) * 4 + c;
        const idx2 = (y * width + (x + 2)) * 4 + c;
        const idx3 = (y * width + (x + 3)) * 4 + c;

        const g0 = data[idx0] ?? 0;
        const g1 = data[idx1] ?? 0;
        const g2 = data[idx2] ?? 0;
        const g3 = data[idx3] ?? 0;
        const g: [number, number, number, number] = [g0, g1, g2, g3];

        const baseVar = variation(g);

        // Apply Mask M: [0, 1, 1, 0] -> [g0, f1(g1), f1(g2), g3]
        const gm: [number, number, number, number] = [g0, f1(g1), f1(g2), g3];
        const varM = variation(gm);
        if (varM > baseVar) regularM++;
        else if (varM < baseVar) singularM++;

        // Apply Mask -M: [0, -1, -1, 0] -> [g0, fNeg1(g1), fNeg1(g2), g3]
        const gNegM: [number, number, number, number] = [g0, fNeg1(g1), fNeg1(g2), g3];
        const varNegM = variation(gNegM);
        if (varNegM > baseVar) regularNegM++;
        else if (varNegM < baseVar) singularNegM++;

        // Apply 100% LSB flip to all pixels for curve calibration: G_inv
        const gInv: [number, number, number, number] = [f1(g0), f1(g1), f1(g2), f1(g3)];
        const baseVarInv = variation(gInv);

        const gInvM: [number, number, number, number] = [f1(g0), f1(f1(g1)), f1(f1(g2)), f1(g3)];
        const varInvM = variation(gInvM);
        if (varInvM > baseVarInv) regularM1++;
        else if (varInvM < baseVarInv) singularM1++;

        const gInvNegM: [number, number, number, number] = [
          f1(g0),
          fNeg1(f1(g1)),
          fNeg1(f1(g2)),
          f1(g3),
        ];
        const varInvNegM = variation(gInvNegM);
        if (varInvNegM > baseVarInv) regularNegM1++;
        else if (varInvNegM < baseVarInv) singularNegM1++;

        totalGroups++;
      }
    }
  }

  if (totalGroups === 0) {
    return {
      rm: 0,
      sm: 0,
      rMinusM: 0,
      sMinusM: 0,
      estimatedPayloadRatio: 0,
      confidence: 0,
      classification: 'clean',
      details: { totalGroups: 0, differenceRmSm: 0, differenceRnegSneg: 0 },
    };
  }

  const rm = regularM / totalGroups;
  const sm = singularM / totalGroups;
  const rMinusM = regularNegM / totalGroups;
  const sMinusM = singularNegM / totalGroups;

  const rm1 = regularM1 / totalGroups;
  const sm1 = singularM1 / totalGroups;
  const rMinusM1 = regularNegM1 / totalGroups;
  const sMinusM1 = singularNegM1 / totalGroups;

  const d0 = rm - sm;
  const d1 = rm1 - sm1;
  const dNeg0 = rMinusM - sMinusM;
  const dNeg1 = rMinusM1 - sMinusM1;

  // Asymmetry metric: in clean images |rm - rMinusM| and |sm - sMinusM| are very small (< 0.03)
  const asymmetry = Math.abs(rm - rMinusM) + Math.abs(sm - sMinusM);

  // Quadratic curve fitting: 2(d1 + d0) x^2 + (dNeg0 - dNeg1 - d1 - 3*d0) x + (d0 - dNeg0) = 0
  const A = 2 * (d1 + d0);
  const B = dNeg0 - dNeg1 - d1 - 3 * d0;
  const C = d0 - dNeg0;

  let estimatedPayloadRatio = 0;

  if (Math.abs(A) < 1e-9) {
    if (Math.abs(B) > 1e-9) {
      const x = -C / B;
      if (Math.abs(x - 0.5) > 1e-6) {
        estimatedPayloadRatio = Math.abs(x / (x - 0.5));
      }
    }
  } else {
    const discriminant = B * B - 4 * A * C;
    if (discriminant >= 0) {
      const sqrtDisc = Math.sqrt(discriminant);
      const root1 = (-B + sqrtDisc) / (2 * A);
      const root2 = (-B - sqrtDisc) / (2 * A);

      // Select root closest to 0
      const x = Math.abs(root1) <= Math.abs(root2) ? root1 : root2;
      if (Math.abs(x - 0.5) > 1e-6) {
        estimatedPayloadRatio = Math.abs(x / (x - 0.5));
      }
    } else {
      // At heavy embedding rates near 100%, small statistical noise can make discriminant < 0
      // Parabola vertex x = -B / (2A) or asymmetry ratio provides the optimal estimate
      const vertexX = -B / (2 * A);
      const ratioFromAsymmetry = Math.min(1, asymmetry / (Math.max(rMinusM, rm) || 1));
      const ratioFromVertex =
        Math.abs(vertexX - 0.5) > 1e-6 ? Math.abs(vertexX / (vertexX - 0.5)) : 1;
      estimatedPayloadRatio = Math.max(ratioFromAsymmetry, Math.min(1, ratioFromVertex));
    }
  }

  if (!Number.isFinite(estimatedPayloadRatio) || Number.isNaN(estimatedPayloadRatio)) {
    estimatedPayloadRatio = 0;
  }
  estimatedPayloadRatio = Math.max(0, Math.min(1, estimatedPayloadRatio));

  let confidence = estimatedPayloadRatio * 0.7 + asymmetry * 1.5;
  if (!Number.isFinite(confidence) || Number.isNaN(confidence)) {
    confidence = 0;
  }
  confidence = Math.max(0, Math.min(1, confidence));

  let classification: 'clean' | 'suspect' | 'stego_detected' = 'clean';
  if (estimatedPayloadRatio > 0.2 || asymmetry > 0.1) {
    classification = 'stego_detected';
  } else if (estimatedPayloadRatio > 0.05 || asymmetry > 0.04) {
    classification = 'suspect';
  }

  return {
    rm: Math.round(rm * 1000) / 1000,
    sm: Math.round(sm * 1000) / 1000,
    rMinusM: Math.round(rMinusM * 1000) / 1000,
    sMinusM: Math.round(sMinusM * 1000) / 1000,
    estimatedPayloadRatio: Math.round(estimatedPayloadRatio * 1000) / 1000,
    confidence: Math.round(confidence * 100) / 100,
    classification,
    details: {
      totalGroups,
      differenceRmSm: Math.round(d0 * 1000) / 1000,
      differenceRnegSneg: Math.round(dNeg0 * 1000) / 1000,
    },
  };
}
