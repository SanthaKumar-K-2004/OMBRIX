import { stealthMatrixMethod } from '@ombrix/stego-advanced';
import { analyzeRsSteganalysis, analyzeSamplePairs } from '@ombrix/stego-forensics';
import { analyzeChiSquare } from '@ombrix/transit-trace';
import { describe, expect, it } from 'vitest';

describe('Stealth Matrix Undetectability & Anti-Forensics Verification', () => {
  function generateCarrier(width: number, height: number) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = Math.round((x / width) * 200 + 20);
        data[idx + 1] = Math.round((y / height) * 200 + 20);
        data[idx + 2] = Math.round(((x + y) / (width + height)) * 200 + 20);
        data[idx + 3] = 255;
      }
    }
    return { width, height, data };
  }

  it('proves carrier with embedded stealth payload passes Fridrich RS steganalysis clean', async () => {
    const carrier = generateCarrier(128, 128);
    const secret = new TextEncoder().encode(
      'OMBRIX top-secret communication: invisible to automated forensic tools',
    );

    const stego = await stealthMatrixMethod.embed(carrier, secret);

    const rsReport = analyzeRsSteganalysis(stego);

    // Because of ±1 LSB matching and edge-texture prioritization,
    // estimated embedding rate must be close to 0 (< 0.15), classified as clean.
    expect(rsReport.estimatedPayloadRatio).toBeLessThan(0.15);
    expect(rsReport.classification).toBe('clean');
  });

  it('proves carrier passes Sample Pair Analysis (SPA) without parity inversion anomalies', async () => {
    const carrier = generateCarrier(128, 128);
    const secret = new TextEncoder().encode('Sample Pair Analysis Resistance Verification');

    const stego = await stealthMatrixMethod.embed(carrier, secret);
    const spaReport = analyzeSamplePairs(stego);

    // SPA estimated rate must remain negligible (< 0.15)
    expect(spaReport.estimatedPayloadRatio).toBeLessThan(0.15);
    expect(spaReport.classification).not.toBe('stego_detected');
  });

  it('proves carrier maintains continuous histogram avoiding Chi-Square PoV spikes', async () => {
    const carrier = generateCarrier(128, 128);
    const secret = new TextEncoder().encode('Chi-Square test resistance with +/- 1 matching');

    const stego = await stealthMatrixMethod.embed(carrier, secret);
    const chiReport = analyzeChiSquare(stego);

    // In Westfeld Chi-Square, pValue >= 0.5 means stego equalized pairs detected.
    // LSB matching avoids equalizing pairs, keeping anomalyDetected = false and confidence = CLEAN.
    expect(chiReport.anomalyDetected).toBe(false);
    expect(chiReport.confidence).toBe('CLEAN');
  });

  it('prevents sequential extraction from finding readable ASCII strings or OMB1 headers', async () => {
    const carrier = generateCarrier(64, 64);
    const secret = 'Unbreakable confidential secret that no other website can read';
    const payload = new TextEncoder().encode(secret);

    const stego = await stealthMatrixMethod.embed(carrier, payload);

    // Simulate what zsteg or sequential extractor extracts from raw byte 0
    const sequentialSample = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
      let b = 0;
      for (let bit = 0; bit < 8; bit++) {
        const bitIdx = i * 8 + bit;
        const channelIdx = Math.floor(bitIdx / 3) * 4 + (bitIdx % 3);
        const lsb = (stego.data[channelIdx] ?? 0) & 1;
        b = (b << 1) | lsb;
      }
      sequentialSample[i] = b;
    }

    const decodedStr = new TextDecoder().decode(sequentialSample);
    // Must NOT contain the plaintext secret!
    expect(decodedStr.includes('Unbreakable')).toBe(false);
    expect(decodedStr.includes('confidential')).toBe(false);
    // Must NOT contain unencrypted OMB1 header!
    expect(decodedStr.includes('OMB1')).toBe(false);
  });
});
