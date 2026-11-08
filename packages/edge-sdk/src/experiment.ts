import { analyzeConsensus } from '@ombrix/stego-forensics';
import type { CarrierImage, StegoMethod } from '@ombrix/stego-interface';
import { calculateDistortion } from '@ombrix/stego-lab';

export interface OmbrixExperimentV1 {
  schemaVersion: 'OMBRIX_EXPERIMENT_V1';
  experimentId: string;
  timestamp: string;
  ombrixVersion: string;
  metadata: {
    title: string;
    description?: string;
    author?: string;
  };
  carrier: {
    width: number;
    height: number;
    totalPixels: number;
    format: string;
  };
  algorithm: {
    methodId: string;
    methodName: string;
    methodVersion: string;
    parameters?: Record<string, unknown>;
    seed?: number;
  };
  payload: {
    sizeBytes: number;
    embeddingRateBpp: number;
    embeddingRateCapacityPercent: number;
    contentType?: string;
  };
  transit?: {
    transformed: boolean;
    pipeline: Array<{
      transformType: string;
      parameters?: Record<string, unknown>;
    }>;
  };
  metrics: {
    embedDurationMs: number;
    extractDurationMs: number;
    roundtripSuccess: boolean;
    distortion: {
      psnr: number;
      mse: number;
      ssim: number;
      mae: number;
    };
  };
  forensics: {
    anomalyDetected: boolean;
    consensusVerdict: string;
    overallAnomalyScore: number;
    rsEstimatedPayload: number;
    spaEstimatedPayload: number;
    chiSquarePValue: number;
    noiseResidualVariance: number;
  };
}

export interface AutomatedExperimentOptions {
  title?: string;
  description?: string;
  author?: string;
  seed?: number;
  parameters?: Record<string, unknown>;
}

export async function runAutomatedExperiment(
  carrier: CarrierImage,
  payload: Uint8Array,
  method: StegoMethod,
  options: AutomatedExperimentOptions = {},
): Promise<OmbrixExperimentV1> {
  const totalPixels = carrier.width * carrier.height;
  const capacity = method.calculateCapacity(carrier);
  const embeddingRateBpp = Math.round(((payload.length * 8) / totalPixels) * 100) / 100;
  const embeddingRateCapacityPercent =
    capacity.usableBytes > 0 ? Math.round((payload.length / capacity.usableBytes) * 1000) / 10 : 0;

  // 1. Embed & measure duration
  const t0Embed = performance.now();
  const stegoCarrier = await method.embed(carrier, payload);
  const embedDurationMs = Math.round((performance.now() - t0Embed) * 100) / 100;

  // 2. Measure distortion metrics
  const distortion = calculateDistortion(carrier, stegoCarrier);
  let sumAbsDiff = 0;
  for (let i = 0; i < carrier.data.length; i += 4) {
    sumAbsDiff +=
      Math.abs((carrier.data[i] ?? 0) - (stegoCarrier.data[i] ?? 0)) +
      Math.abs((carrier.data[i + 1] ?? 0) - (stegoCarrier.data[i + 1] ?? 0)) +
      Math.abs((carrier.data[i + 2] ?? 0) - (stegoCarrier.data[i + 2] ?? 0));
  }
  const mae = Math.round((sumAbsDiff / (totalPixels * 3)) * 10000) / 10000;

  // 3. Extract & verify exact byte-for-byte roundtrip
  const t0Extract = performance.now();
  const recovered = await method.extract(stegoCarrier);
  const extractDurationMs = Math.round((performance.now() - t0Extract) * 100) / 100;

  let roundtripSuccess = recovered.length === payload.length;
  if (roundtripSuccess) {
    for (let i = 0; i < payload.length; i++) {
      if (recovered[i] !== payload[i]) {
        roundtripSuccess = false;
        break;
      }
    }
  }

  // 4. Run multi-detector forensic steganalysis on stego output
  const forensicsReport = analyzeConsensus(stegoCarrier);

  const experimentId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return {
    schemaVersion: 'OMBRIX_EXPERIMENT_V1',
    experimentId,
    timestamp: new Date().toISOString(),
    ombrixVersion: '0.1.0',
    metadata: {
      title: options.title ?? `Benchmark: ${method.name}`,
      description: options.description,
      author: options.author ?? 'OMBRIX Research Engine',
    },
    carrier: {
      width: carrier.width,
      height: carrier.height,
      totalPixels,
      format: 'RAW_RGBA',
    },
    algorithm: {
      methodId: method.id,
      methodName: method.name,
      methodVersion: method.version,
      parameters: options.parameters,
      seed: options.seed,
    },
    payload: {
      sizeBytes: payload.length,
      embeddingRateBpp,
      embeddingRateCapacityPercent,
    },
    transit: {
      transformed: false,
      pipeline: [],
    },
    metrics: {
      embedDurationMs,
      extractDurationMs,
      roundtripSuccess,
      distortion: {
        psnr: distortion.psnr,
        mse: distortion.mse,
        ssim: distortion.ssim,
        mae,
      },
    },
    forensics: {
      anomalyDetected:
        forensicsReport.verdict === 'STEGANOGRAPHY_DETECTED' ||
        forensicsReport.verdict === 'SUSPICIOUS_ANOMALY',
      consensusVerdict: forensicsReport.verdict,
      overallAnomalyScore: forensicsReport.overallAnomalyScore,
      rsEstimatedPayload: forensicsReport.detectors.rs.estimatedPayloadRatio,
      spaEstimatedPayload: forensicsReport.detectors.spa.estimatedPayloadRatio,
      chiSquarePValue: forensicsReport.detectors.chiSquare.pValue,
      noiseResidualVariance: forensicsReport.detectors.noiseResidual.variance,
    },
  };
}

export function serializeExperiment(experiment: OmbrixExperimentV1): string {
  return JSON.stringify(experiment, null, 2);
}

export function parseExperiment(jsonString: string): OmbrixExperimentV1 {
  const parsed = JSON.parse(jsonString) as OmbrixExperimentV1;
  if (parsed.schemaVersion !== 'OMBRIX_EXPERIMENT_V1') {
    throw new Error(
      `Invalid experiment record schema version: expected OMBRIX_EXPERIMENT_V1, received ${parsed.schemaVersion}`,
    );
  }
  return parsed;
}
