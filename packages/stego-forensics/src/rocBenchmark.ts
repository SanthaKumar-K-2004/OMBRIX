export interface RocPoint {
  threshold: number;
  fpr: number; // False Positive Rate = FP / (FP + TN)
  tpr: number; // True Positive Rate = TP / (TP + FN) (Recall)
  precision: number; // Precision = TP / (TP + FP)
  accuracy: number; // (TP + TN) / (Total)
  youdenIndex: number; // J = TPR - FPR
}

export interface RocCurveResult {
  detectorName: string;
  auc: number; // Area Under Curve in [0, 1]
  points: RocPoint[];
  optimalThreshold: number;
  optimalAccuracy: number;
  totalSamples: number;
  positiveCount: number;
  negativeCount: number;
}

export interface RocEvaluationOptions {
  detectorName?: string;
  steps?: number;
}

/**
 * Computes trapezoidal numerical area under the ROC curve (AUC).
 */
export function computeTrapezoidalAuc(points: readonly RocPoint[]): number {
  if (points.length < 2) return 0.5;

  // Sort ascending by FPR, then TPR
  const sorted = [...points].sort((a, b) => {
    if (a.fpr !== b.fpr) return a.fpr - b.fpr;
    return a.tpr - b.tpr;
  });

  // Ensure anchor at (0, 0) and (1, 1)
  const curve: Array<{ fpr: number; tpr: number }> = [{ fpr: 0, tpr: 0 }];
  for (const pt of sorted) {
    curve.push({ fpr: pt.fpr, tpr: pt.tpr });
  }
  curve.push({ fpr: 1, tpr: 1 });

  let auc = 0;
  for (let i = 0; i < curve.length - 1; i++) {
    const p1 = curve[i]!;
    const p2 = curve[i + 1]!;
    const dx = p2.fpr - p1.fpr;
    if (dx > 0) {
      auc += (dx * (p1.tpr + p2.tpr)) / 2;
    }
  }

  return Math.min(1, Math.max(0, Math.round(auc * 10000) / 10000));
}

/**
 * Evaluates a steganographic detector across positive (stego) and negative (clean) score distributions.
 * Higher score indicates higher suspicion / probability of steganography.
 */
export function evaluateRocCurve(
  negativeScores: readonly number[], // Clean carriers
  positiveScores: readonly number[], // Stego carriers
  options: RocEvaluationOptions = {},
): RocCurveResult {
  const detectorName = options.detectorName ?? 'Steganalysis Detector';
  const steps = options.steps ?? 50;

  const N_neg = negativeScores.length;
  const N_pos = positiveScores.length;

  if (N_neg === 0 || N_pos === 0) {
    throw new Error('Both clean (negative) and stego (positive) score sets must be non-empty');
  }

  const allScores = [...negativeScores, ...positiveScores];
  const minScore = Math.min(...allScores);
  const maxScore = Math.max(...allScores);

  const range = maxScore - minScore;
  const stepSize = range > 0 ? range / steps : 1;

  const points: RocPoint[] = [];
  let bestThreshold = minScore;
  let maxYouden = -1;
  let bestAccuracy = 0;

  for (let s = 0; s <= steps + 1; s++) {
    const threshold = minScore + (s - 0.5) * stepSize;

    let tp = 0;
    let fn = 0;
    for (const score of positiveScores) {
      if (score >= threshold) tp++;
      else fn++;
    }

    let fp = 0;
    let tn = 0;
    for (const score of negativeScores) {
      if (score >= threshold) fp++;
      else tn++;
    }

    const tpr = tp / (tp + fn || 1);
    const fpr = fp / (fp + tn || 1);
    const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
    const accuracy = (tp + tn) / (N_pos + N_neg);
    const youdenIndex = tpr - fpr;

    if (youdenIndex > maxYouden) {
      maxYouden = youdenIndex;
      bestThreshold = threshold;
      bestAccuracy = accuracy;
    }

    points.push({
      threshold: Math.round(threshold * 10000) / 10000,
      fpr: Math.round(fpr * 10000) / 10000,
      tpr: Math.round(tpr * 10000) / 10000,
      precision: Math.round(precision * 10000) / 10000,
      accuracy: Math.round(accuracy * 10000) / 10000,
      youdenIndex: Math.round(youdenIndex * 10000) / 10000,
    });
  }

  const auc = computeTrapezoidalAuc(points);

  return {
    detectorName,
    auc,
    points,
    optimalThreshold: Math.round(bestThreshold * 10000) / 10000,
    optimalAccuracy: Math.round(bestAccuracy * 10000) / 10000,
    totalSamples: N_pos + N_neg,
    positiveCount: N_pos,
    negativeCount: N_neg,
  };
}
