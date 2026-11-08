import { haarDwtStego, jpegDctStego, pvdStego } from '@ombrix/stego-advanced';
import {
  analyzeConsensus,
  analyzeRsSteganalysis,
  analyzeSamplePairs,
  computeNoiseResidual,
} from '@ombrix/stego-forensics';
import type { CarrierImage } from '@ombrix/stego-interface';
import { pngLsbMatching, runStegoBenchmark } from '@ombrix/stego-lab';
import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import { describe, expect, it } from 'vitest';

function createSyntheticCarrier(width: number, height: number): CarrierImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = Math.round((x / width) * 200 + 25);
      data[idx + 1] = Math.round((y / height) * 200 + 25);
      data[idx + 2] = Math.round(((x + y) / (width + height)) * 200 + 25);
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('Phase 6 Research Integration: Advanced Steganography & Steganalysis', () => {
  it('Milestone 16: verifies end-to-end PVD (Pixel Value Differencing) roundtrip', async () => {
    const carrier = createSyntheticCarrier(64, 64);
    const secret = new TextEncoder().encode('OMBRIX Phase 6 Wu & Tsai PVD Payload Verification');

    const stego = await pvdStego.embed(carrier, secret);
    expect(stego.width).toBe(carrier.width);
    expect(stego.height).toBe(carrier.height);

    const extracted = await pvdStego.extract(stego);
    expect(extracted).toEqual(secret);
    expect(new TextDecoder().decode(extracted)).toBe(
      'OMBRIX Phase 6 Wu & Tsai PVD Payload Verification',
    );
  });

  it('Milestone 16: verifies end-to-end 2D Haar DWT integer wavelet roundtrip', async () => {
    const carrier = createSyntheticCarrier(64, 64);
    const secret = new TextEncoder().encode('OMBRIX Phase 6 Integer Wavelet DWT Payload');

    const stego = await haarDwtStego.embed(carrier, secret);
    expect(stego.width).toBe(carrier.width);
    expect(stego.height).toBe(carrier.height);

    const extracted = await haarDwtStego.extract(stego);
    expect(extracted).toEqual(secret);
    expect(new TextDecoder().decode(extracted)).toBe('OMBRIX Phase 6 Integer Wavelet DWT Payload');
  });

  it('Milestone 16: verifies end-to-end JPEG 8x8 DCT AC coefficient domain roundtrip', async () => {
    const carrier = createSyntheticCarrier(64, 64);
    const secret = new TextEncoder().encode('OMBRIX JPEG DCT AC');

    const stego = await jpegDctStego.embed(carrier, secret);
    expect(stego.width).toBe(carrier.width);
    expect(stego.height).toBe(carrier.height);

    const extracted = await jpegDctStego.extract(stego);
    expect(extracted).toEqual(secret);
    expect(new TextDecoder().decode(extracted)).toBe('OMBRIX JPEG DCT AC');
  });

  it('Milestone 17: detects clean vs stego carriers via RS Steganalysis (Fridrich 2001)', async () => {
    const cleanCarrier = createSyntheticCarrier(64, 64);
    const rsClean = analyzeRsSteganalysis(cleanCarrier);
    expect(rsClean.classification).toBe('clean');
    expect(rsClean.estimatedPayloadRatio).toBeLessThan(0.15);

    // Embed LSB payload
    const payload = new Uint8Array(1000);
    for (let i = 0; i < payload.length; i++) payload[i] = (i * 37 + 13) & 0xff;
    const stegoCarrier = await pngLsbSequential.embed(cleanCarrier, payload);

    const rsStego = analyzeRsSteganalysis(stegoCarrier);
    expect(rsStego.classification).toBe('stego_detected');
    expect(rsStego.estimatedPayloadRatio).toBeGreaterThan(0.25);
  });

  it('Milestone 17: detects sample pair anomalies via SPA (Dumitrescu 2003)', async () => {
    const cleanCarrier = createSyntheticCarrier(64, 64);
    const spaClean = analyzeSamplePairs(cleanCarrier);
    expect(spaClean.classification).toBe('clean');

    // Embed LSB payload
    const payload = new Uint8Array(800);
    for (let i = 0; i < payload.length; i++) payload[i] = (i * 59 + 7) & 0xff;
    const stegoCarrier = await pngLsbSequential.embed(cleanCarrier, payload);

    const spaStego = analyzeSamplePairs(stegoCarrier);
    expect(spaStego.estimatedPayloadRatio).toBeGreaterThan(0.15);
  });

  it('Milestone 17: computes high-frequency noise residual and elevates variance under perturbation', () => {
    const cleanCarrier = createSyntheticCarrier(32, 32);
    const resClean = computeNoiseResidual(cleanCarrier);
    expect(resClean.variance).toBeLessThan(2.0);

    // Perturb carrier with noise
    const perturbedData = new Uint8ClampedArray(cleanCarrier.data);
    for (let i = 0; i < perturbedData.length; i += 4) {
      const noise = i % 8 === 0 ? 12 : -12;
      perturbedData[i] = Math.max(0, Math.min(255, (perturbedData[i] ?? 0) + noise));
    }
    const resPerturbed = computeNoiseResidual({ ...cleanCarrier, data: perturbedData });
    expect(resPerturbed.variance).toBeGreaterThan(resClean.variance * 5);
  });

  it('Milestone 17: aggregates multi-detector consensus report with scientific caveats', async () => {
    const cleanCarrier = createSyntheticCarrier(64, 64);
    const cleanReport = analyzeConsensus(cleanCarrier);
    expect(cleanReport.verdict).toBe('CLEAN_BENIGN');
    expect(cleanReport.overallAnomalyScore).toBeLessThan(20);
    expect(cleanReport.caveats.length).toBeGreaterThan(2);

    const payload = new Uint8Array(1000);
    for (let i = 0; i < payload.length; i++) payload[i] = (i * 71 + 3) & 0xff;
    const stegoCarrier = await pngLsbSequential.embed(cleanCarrier, payload);

    const stegoReport = analyzeConsensus(stegoCarrier);
    expect(stegoReport.verdict).toBe('STEGANOGRAPHY_DETECTED');
    expect(stegoReport.overallAnomalyScore).toBeGreaterThan(25);
  });

  it('Milestone 18: benchmarks all 5 algorithms side-by-side in comparative laboratory', async () => {
    const carrier = createSyntheticCarrier(64, 64);
    const payload = new TextEncoder().encode('OMBRIX Multi-Algorithm Benchmark Payload');

    const results = await runStegoBenchmark(carrier, payload, [
      pngLsbSequential,
      pngLsbMatching,
      pvdStego,
      haarDwtStego,
      jpegDctStego,
    ]);

    expect(results).toHaveLength(5);
    for (const res of results) {
      expect(res.success).toBe(true);
      expect(res.distortion.psnr).toBeGreaterThan(30);
      expect(res.distortion.ssim).toBeGreaterThan(0.9);
      expect(res.embedDurationMs).toBeGreaterThanOrEqual(0);
      expect(res.extractDurationMs).toBeGreaterThanOrEqual(0);
    }
  });
});
