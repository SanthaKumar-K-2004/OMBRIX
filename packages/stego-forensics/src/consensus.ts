import type { CarrierImage } from '@ombrix/stego-interface';
import { analyzeChiSquare } from '@ombrix/transit-trace';
import { computeNoiseResidual } from './noiseResidual.js';
import { analyzeRsSteganalysis } from './rsSteganalysis.js';
import { analyzeSamplePairs } from './samplePairAnalysis.js';
import type { ConsensusVerdict, ForensicsConsensusReport } from './types.js';

export function analyzeConsensus(carrier: CarrierImage): ForensicsConsensusReport {
  const rs = analyzeRsSteganalysis(carrier);
  const spa = analyzeSamplePairs(carrier);
  const noise = computeNoiseResidual(carrier);
  const chi = analyzeChiSquare(carrier);

  // Compute normalized anomaly scores per detector [0 - 100]
  const rsScore = Math.min(100, Math.max(0, rs.estimatedPayloadRatio * 100));
  const spaScore = Math.min(100, Math.max(0, spa.estimatedPayloadRatio * 100));
  // Chi-Square: High p-value (near 1.0) indicates natural/clean distribution.
  // Low p-value (p < 0.05) indicates anomaly/tampering.
  const chiScore = chi.anomalyDetected ? Math.min(100, Math.max(0, (1 - chi.pValue) * 100)) : 0;
  // HFPI benchmark: baseline noise is ~10-25; values > 40 indicate high frequency elevation
  const noiseScore = Math.min(100, Math.max(0, (noise.highFrequencyPerturbationIndex - 15) * 2));

  // Weighted multi-detector consensus
  // RS (35%), SPA (35%), Chi-square (20%), Noise Residual (10%)
  const overallAnomalyScore = Math.round(
    rsScore * 0.35 + spaScore * 0.35 + chiScore * 0.2 + noiseScore * 0.1,
  );

  let verdict: ConsensusVerdict = 'CLEAN_BENIGN';
  let confidence = 0.85;

  const stegoVotes =
    (rs.classification === 'stego_detected' ? 1 : 0) +
    (spa.classification === 'stego_detected' ? 1 : 0) +
    (chi.anomalyDetected ? 1 : 0);

  const suspectVotes =
    (rs.classification === 'suspect' ? 1 : 0) +
    (spa.classification === 'suspect' ? 1 : 0) +
    (chi.confidence === 'LOW' || chi.confidence === 'MEDIUM' ? 1 : 0);

  if (stegoVotes >= 2 || overallAnomalyScore >= 35) {
    verdict = 'STEGANOGRAPHY_DETECTED';
    confidence = Math.min(0.98, 0.7 + (overallAnomalyScore / 100) * 0.28);
  } else if (stegoVotes === 1 || suspectVotes >= 2 || overallAnomalyScore >= 18) {
    verdict = 'SUSPICIOUS_ANOMALY';
    confidence = 0.75;
  } else if (suspectVotes === 1 || overallAnomalyScore >= 8) {
    verdict = 'INCONCLUSIVE';
    confidence = 0.6;
  } else {
    verdict = 'CLEAN_BENIGN';
    confidence = 0.9;
  }

  const caveats: string[] = [
    'First-order statistical detectors (RS, SPA, Chi-square) assume continuous natural image spatial correlation.',
    'Synthetic textures, computer-generated artwork, flat gradients, or extreme high-ISO camera sensor noise can produce false positive deviations.',
    'Advanced steganography engines (such as spread-spectrum, Haar DWT detail-band modulation, or syndrome coding) may show lower first-order spatial detection rates.',
    'Detection evidence should be corroborated with visual bitplane inspection and carrier provenance analysis before drawing forensic conclusions.',
  ];

  let summary = '';
  switch (verdict) {
    case 'STEGANOGRAPHY_DETECTED':
      summary = `Multi-detector consensus indicates a high probability of embedded steganographic payload (anomaly score: ${overallAnomalyScore}%, RS ratio: ${Math.round(rs.estimatedPayloadRatio * 100)}%, SPA ratio: ${Math.round(spa.estimatedPayloadRatio * 100)}%).`;
      break;
    case 'SUSPICIOUS_ANOMALY':
      summary = `Moderate statistical irregularities detected across carrier channels (anomaly score: ${overallAnomalyScore}%). Further bitplane and metadata inspection recommended.`;
      break;
    case 'INCONCLUSIVE':
      summary = `Statistical metrics exhibit ambiguous variance across detectors (anomaly score: ${overallAnomalyScore}%). Unable to definitively confirm or rule out steganographic modifications.`;
      break;
    case 'CLEAN_BENIGN':
      summary = `Carrier exhibits natural statistical distributions and symmetry consistent with an unmodified image (anomaly score: ${overallAnomalyScore}%).`;
      break;
  }

  return {
    verdict,
    overallAnomalyScore,
    confidence: Math.round(confidence * 100) / 100,
    detectors: {
      rs,
      spa,
      chiSquare: {
        pValue: chi.pValue,
        tamperingDetected: chi.anomalyDetected,
        degreesOfFreedom: chi.degreesOfFreedom,
      },
      noiseResidual: {
        variance: noise.variance,
        hfpi: noise.highFrequencyPerturbationIndex,
      },
    },
    summary,
    caveats,
  };
}
