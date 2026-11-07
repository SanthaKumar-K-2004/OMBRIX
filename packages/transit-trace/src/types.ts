import type { CarrierImage } from '@ombrix/stego-interface';

export type TransitTransformType = 'JPEG' | 'RESIZE' | 'NOISE' | 'SOCIAL_MEDIA';

export interface TransitOptions {
  readonly jpegQuality?: number; // 1 to 100, default: 80
  readonly scaleFactor?: number; // 0.1 to 0.99, default: 0.5
  readonly errorRate?: number; // 0.0001 to 0.1, default: 0.01
}

export interface TransitSimulationResult {
  readonly transformType: TransitTransformType;
  readonly parameters: Record<string, number | string>;
  readonly transformedCarrier: CarrierImage;
  readonly payloadRecovered: boolean;
  readonly recoveredByteCount?: number;
  readonly errorSummary?: string;
}

export interface PairOfValuesDistribution {
  readonly pairIndex: number; // 0 to 127
  readonly countEven: number; // h(2k)
  readonly countOdd: number; // h(2k+1)
  readonly expected: number; // (h(2k) + h(2k+1)) / 2
  readonly chiSquareContribution: number;
}

export interface ChiSquareReport {
  readonly chiSquare: number;
  readonly degreesOfFreedom: number;
  readonly pValue: number; // Probability in [0, 1] of artificial LSB equalization
  readonly anomalyDetected: boolean;
  readonly confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN';
  readonly sampleCount: number;
  readonly topDeviatingPairs: PairOfValuesDistribution[];
}
