import {
  generateEncryptionKeyPair,
  generateSigningKeyPair,
  toBase64,
} from '@ombrix/crypto-adapter';
import type { CarrierImage } from '@ombrix/stego-interface';
import { beforeAll, describe, expect, it } from 'vitest';
import { Ombrix } from '../src/facade.js';

function createTestCarrier(width: number, height: number): CarrierImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (i * 3) % 256;
    data[i + 1] = (i * 7) % 256;
    data[i + 2] = (i * 11) % 256;
    data[i + 3] = 255;
  }
  return { width, height, data };
}

describe('@ombrix/edge-sdk - Public Unified Facade', () => {
  beforeAll(async () => {
    await Ombrix.init();
  });

  it('performs basic embed and extract roundtrip seamlessly', async () => {
    const carrier = createTestCarrier(80, 80);
    const secret = 'Unencrypted message via OMBRIX Edge SDK';

    const stego = await Ombrix.embed(carrier, secret);
    const extracted = await Ombrix.extract(stego);

    expect(extracted.text).toBe(secret);
    expect(extracted.isEncrypted).toBe(false);
  });

  it('performs encrypted and digitally signed embed and extract roundtrip', async () => {
    const carrier = createTestCarrier(100, 100);
    const aliceSigning = generateSigningKeyPair();
    const bobEncryption = generateEncryptionKeyPair();

    const secret = 'Confidential tactical payload with Ed25519 digital signature';

    const stego = await Ombrix.embed(carrier, secret, {
      recipientPublicKey: toBase64(bobEncryption.publicKey),
      signingPrivateKey: toBase64(aliceSigning.privateKey),
    });

    const extracted = await Ombrix.extract(stego, {
      recipientPublicKey: toBase64(bobEncryption.publicKey),
      recipientPrivateKey: toBase64(bobEncryption.privateKey),
      senderSigningPublicKey: toBase64(aliceSigning.publicKey),
    });

    expect(extracted.text).toBe(secret);
    expect(extracted.isEncrypted).toBe(true);
    expect(extracted.isSigned).toBe(true);
    expect(extracted.signatureVerified).toBe(true);
  });

  it('inspects carrier visual properties and bitplanes', () => {
    const carrier = createTestCarrier(50, 50);
    const result = Ombrix.inspect(carrier);

    expect(result.bitplanes.red).toBeDefined();
    expect(result.bitplanes.green).toBeDefined();
    expect(result.bitplanes.blue).toBeDefined();
    expect(result.histogram.r).toHaveLength(256);
  });

  it('runs steganographic laboratory benchmark on algorithms', async () => {
    const carrier = createTestCarrier(40, 40);
    const payload = new Uint8Array([1, 2, 3, 4, 5]);

    const results = await Ombrix.benchmark(carrier, payload);
    expect(results).toHaveLength(2);
    expect(results[0]?.methodId).toBe('png-lsb-sequential');
    expect(results[0]?.distortion.psnr).toBeGreaterThan(40);
  });

  it('creates and opens ephemeral share link with carrier hash ring', async () => {
    const dummyCarrierBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

    const { uri, container } = await Ombrix.createShareLink({
      expiresInSeconds: 3600,
      carrierBytes: dummyCarrierBytes,
      payloadBytes: new TextEncoder().encode('Ephemeral Link Secret'),
    });

    expect(uri).toContain('#link=');
    expect(container.magic).toBe('OMBRIX_LINK');

    const opened = await Ombrix.openShareLink(uri, {
      carrierBytes: dummyCarrierBytes,
    });

    expect(opened.carrierVerified).toBe(true);
    expect(new TextDecoder().decode(opened.payloadBytes)).toBe('Ephemeral Link Secret');
  });

  it('executes research engines (PVD, DWT, DCT) and forensics scan via Ombrix facade', async () => {
    const carrier = createTestCarrier(64, 64);
    const payload = new TextEncoder().encode('Phase 6 Research Engine Test');

    // PVD
    const stegoPvd = await Ombrix.embedPvd(carrier, payload);
    const extractedPvd = await Ombrix.extractPvd(stegoPvd);
    expect(extractedPvd).toEqual(payload);

    // DWT
    const stegoDwt = await Ombrix.embedDwt(carrier, payload);
    const extractedDwt = await Ombrix.extractDwt(stegoDwt);
    expect(extractedDwt).toEqual(payload);

    // Forensics Scan
    const scanReport = Ombrix.scan(stegoPvd);
    expect(scanReport.verdict).toBeDefined();
    expect(scanReport.overallAnomalyScore).toBeGreaterThanOrEqual(0);
    expect(scanReport.caveats.length).toBeGreaterThan(0);
  });

  it('runs scientific experiment, serializes to Section 16.5 record and parses back', async () => {
    const carrier = createTestCarrier(64, 64);
    const payload = new Uint8Array([10, 20, 30, 40, 50, 60]);
    const { pngLsbSequential } = await import('@ombrix/stego-png-lsb');

    const exp = await Ombrix.runExperiment(carrier, payload, pngLsbSequential, {
      title: 'LSB Distortion & Forensics Benchmark',
      description: 'Automated test run',
      author: 'Test Runner',
    });

    expect(exp.schemaVersion).toBe('OMBRIX_EXPERIMENT_V1');
    expect(exp.experimentId).toMatch(/^exp_/);
    expect(exp.carrier.totalPixels).toBe(64 * 64);
    expect(exp.algorithm.methodId).toBe('png-lsb-sequential');
    expect(exp.metrics.roundtripSuccess).toBe(true);
    expect(exp.metrics.distortion.psnr).toBeGreaterThan(45);
    expect(exp.forensics.consensusVerdict).toBeDefined();

    // Serialization & Parsing
    const jsonStr = Ombrix.serializeExperiment(exp);
    const parsed = Ombrix.parseExperiment(jsonStr);

    expect(parsed.experimentId).toBe(exp.experimentId);
    expect(parsed.metrics.distortion.psnr).toBe(exp.metrics.distortion.psnr);
    expect(parsed.payload.sizeBytes).toBe(payload.length);
  });
});
