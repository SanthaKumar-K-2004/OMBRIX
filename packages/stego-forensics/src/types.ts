export interface RsAnalysisResult {
  rm: number;
  sm: number;
  rMinusM: number;
  sMinusM: number;
  estimatedPayloadRatio: number; // [0, 1]
  confidence: number; // [0, 1]
  classification: 'clean' | 'suspect' | 'stego_detected';
  details: {
    totalGroups: number;
    differenceRmSm: number;
    differenceRnegSneg: number;
  };
}

export interface SpaAnalysisResult {
  estimatedPayloadRatio: number; // [0, 1]
  primarySetCounts: {
    p: number;
    x: number;
    y: number;
    z: number;
  };
  confidence: number;
  classification: 'clean' | 'suspect' | 'stego_detected';
}

export interface NoiseResidualResult {
  variance: number;
  standardDeviation: number;
  meanAbsoluteResidual: number;
  highFrequencyPerturbationIndex: number;
  heatmapData: Uint8ClampedArray; // RGBA visualization buffer
  width: number;
  height: number;
}

export type ConsensusVerdict =
  | 'CLEAN_BENIGN'
  | 'INCONCLUSIVE'
  | 'SUSPICIOUS_ANOMALY'
  | 'STEGANOGRAPHY_DETECTED';

export interface ForensicsConsensusReport {
  verdict: ConsensusVerdict;
  overallAnomalyScore: number; // [0, 100]%
  confidence: number; // [0, 1]
  detectors: {
    rs: RsAnalysisResult;
    spa: SpaAnalysisResult;
    chiSquare: {
      pValue: number;
      tamperingDetected: boolean;
      degreesOfFreedom: number;
    };
    noiseResidual: {
      variance: number;
      hfpi: number;
    };
  };
  summary: string;
  caveats: string[];
}
