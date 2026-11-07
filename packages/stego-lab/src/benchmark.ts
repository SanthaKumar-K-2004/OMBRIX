import type { CarrierImage, StegoMethod } from '@ombrix/stego-interface';
import { calculateDistortion } from './metrics.js';
import type { StegoBenchmarkResult } from './types.js';

export async function runStegoBenchmark(
  carrier: CarrierImage,
  payload: Uint8Array,
  methods: StegoMethod[],
): Promise<StegoBenchmarkResult[]> {
  const results: StegoBenchmarkResult[] = [];

  for (const method of methods) {
    const t0Embed = performance.now();
    const stegoCarrier = await method.embed(carrier, payload);
    const embedDurationMs = performance.now() - t0Embed;

    const distortion = calculateDistortion(carrier, stegoCarrier);

    const t0Extract = performance.now();
    const recovered = await method.extract(stegoCarrier);
    const extractDurationMs = performance.now() - t0Extract;

    // Verify exact roundtrip recovery
    let success = recovered.length === payload.length;
    if (success) {
      for (let i = 0; i < payload.length; i++) {
        if (recovered[i] !== payload[i]) {
          success = false;
          break;
        }
      }
    }

    results.push({
      methodId: method.id,
      methodName: method.name,
      embedDurationMs: Math.round(embedDurationMs * 100) / 100,
      extractDurationMs: Math.round(extractDurationMs * 100) / 100,
      payloadBytes: payload.length,
      distortion,
      success,
    });
  }

  return results;
}
