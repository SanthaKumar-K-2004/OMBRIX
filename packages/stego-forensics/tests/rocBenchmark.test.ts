import { describe, expect, it } from 'vitest';
import { type RocPoint, computeTrapezoidalAuc, evaluateRocCurve } from '../src/rocBenchmark.js';

describe('Milestone 30: Empirical ROC Detection & Statistical Benchmarking', () => {
  describe('computeTrapezoidalAuc', () => {
    it('returns default 0.5 for degenerate points array (< 2)', () => {
      expect(computeTrapezoidalAuc([])).toBe(0.5);
      expect(
        computeTrapezoidalAuc([
          {
            threshold: 0.5,
            fpr: 0.2,
            tpr: 0.8,
            precision: 0.8,
            accuracy: 0.8,
            youdenIndex: 0.6,
          },
        ]),
      ).toBe(0.5);
    });

    it('computes AUC = 1.0 for a perfect discriminator curve', () => {
      const perfectPoints: RocPoint[] = [
        {
          threshold: 1.0,
          fpr: 0.0,
          tpr: 0.0,
          precision: 1.0,
          accuracy: 0.5,
          youdenIndex: 0.0,
        },
        {
          threshold: 0.5,
          fpr: 0.0,
          tpr: 1.0,
          precision: 1.0,
          accuracy: 1.0,
          youdenIndex: 1.0,
        },
        {
          threshold: 0.0,
          fpr: 1.0,
          tpr: 1.0,
          precision: 0.5,
          accuracy: 0.5,
          youdenIndex: 0.0,
        },
      ];
      const auc = computeTrapezoidalAuc(perfectPoints);
      expect(auc).toBe(1.0);
    });

    it('computes AUC = 0.5 for random guessing (diagonal line)', () => {
      const diagonalPoints: RocPoint[] = [
        { threshold: 0.8, fpr: 0.2, tpr: 0.2, precision: 0.5, accuracy: 0.5, youdenIndex: 0.0 },
        { threshold: 0.5, fpr: 0.5, tpr: 0.5, precision: 0.5, accuracy: 0.5, youdenIndex: 0.0 },
        { threshold: 0.2, fpr: 0.8, tpr: 0.8, precision: 0.5, accuracy: 0.5, youdenIndex: 0.0 },
      ];
      const auc = computeTrapezoidalAuc(diagonalPoints);
      expect(auc).toBe(0.5);
    });
  });

  describe('evaluateRocCurve', () => {
    it('throws when clean or stego distribution is empty', () => {
      expect(() => evaluateRocCurve([], [0.8, 0.9])).toThrow(
        'Both clean (negative) and stego (positive) score sets must be non-empty',
      );
      expect(() => evaluateRocCurve([0.1, 0.2], [])).toThrow(
        'Both clean (negative) and stego (positive) score sets must be non-empty',
      );
    });

    it('evaluates completely separable stego vs clean distributions (AUC = 1.0)', () => {
      const cleanScores = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07];
      const stegoScores = [0.75, 0.82, 0.88, 0.91, 0.95, 0.99];

      const result = evaluateRocCurve(cleanScores, stegoScores, {
        detectorName: 'RS-Analysis-Benchmark',
        steps: 20,
      });

      expect(result.detectorName).toBe('RS-Analysis-Benchmark');
      expect(result.totalSamples).toBe(13);
      expect(result.negativeCount).toBe(7);
      expect(result.positiveCount).toBe(6);
      expect(result.auc).toBe(1.0);
      expect(result.optimalAccuracy).toBe(1.0);
      expect(result.optimalThreshold).toBeGreaterThan(0.07);
      expect(result.optimalThreshold).toBeLessThanOrEqual(0.75);
    });

    it('evaluates partially overlapping detector scores', () => {
      // Overlapping scores around 0.4 - 0.6
      const cleanScores = [0.05, 0.1, 0.2, 0.35, 0.45, 0.55];
      const stegoScores = [0.4, 0.5, 0.65, 0.75, 0.85, 0.95];

      const result = evaluateRocCurve(cleanScores, stegoScores, {
        steps: 30,
      });

      expect(result.auc).toBeGreaterThan(0.7);
      expect(result.auc).toBeLessThan(1.0);
      expect(result.optimalAccuracy).toBeGreaterThanOrEqual(0.66);
      expect(result.points.length).toBeGreaterThanOrEqual(30);
    });
  });
});
