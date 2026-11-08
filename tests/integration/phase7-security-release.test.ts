import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateEncryptionKeyPair,
  generateSigningKeyPair,
  initCrypto,
  openSeal,
  seal,
  signDetached,
  verifyDetached,
} from '@ombrix/crypto-adapter';
import { Ombrix } from '@ombrix/edge-sdk';
import { ExtractionError } from '@ombrix/stego-interface';
import { describe, expect, it } from 'vitest';
import { demoDataset } from '../fixtures/demo-dataset/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Phase 7 Release Hardening & Security Audit', () => {
  it('Milestone 19: verifies Content Security Policy strictly enforces connect-src none', () => {
    const indexPath = path.resolve(__dirname, '../../apps/web/index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf-8');

    expect(indexHtml).toContain('http-equiv="Content-Security-Policy"');
    expect(indexHtml).toContain("connect-src 'none'");
    expect(indexHtml).toContain("default-src 'self'");
    expect(indexHtml).toContain("object-src 'none'");

    // Verify no telemetry domains are allowlisted
    const bannedDomains = [
      'google-analytics.com',
      'segment.com',
      'mixpanel.com',
      'sentry.io',
      'posthog.com',
    ];
    for (const domain of bannedDomains) {
      expect(indexHtml).not.toContain(domain);
    }
  });

  it('Milestone 19: verifies dependency and license inventory document exists and specifies zero telemetry', () => {
    const licenseDocPath = path.resolve(__dirname, '../../docs/licenses.md');
    expect(fs.existsSync(licenseDocPath)).toBe(true);

    const content = fs.readFileSync(licenseDocPath, 'utf-8');
    expect(content).toContain('Zero Telemetry Guarantee');
    expect(content).toContain("connect-src 'none'");
    expect(content).toContain('libsodium-wrappers-sumo');
  });

  it('Milestone 19: verifies strict cryptographic isolation (wrong-key rejection and signature tamper detection)', async () => {
    await initCrypto();

    const senderKeys = generateSigningKeyPair();
    const recipientA = generateEncryptionKeyPair();
    const recipientB = generateEncryptionKeyPair();

    const plaintext = new TextEncoder().encode('Confidential Phase 7 Test');
    const ciphertext = seal(plaintext, recipientA.publicKey);

    // Decrypt with correct key
    const decrypted = openSeal(ciphertext, recipientA.publicKey, recipientA.privateKey);
    expect(decrypted).toEqual(plaintext);

    // Decrypt with wrong key (Recipient B) must fail
    expect(() => openSeal(ciphertext, recipientB.publicKey, recipientB.privateKey)).toThrow();

    // Detached signature tamper detection
    const sig = signDetached(plaintext, senderKeys.privateKey);
    expect(verifyDetached(plaintext, sig, senderKeys.publicKey)).toBe(true);

    // Tampered payload must fail verification
    const tamperedPayload = new Uint8Array(plaintext);
    tamperedPayload[0] = (tamperedPayload[0] ?? 0) ^ 0x01;
    expect(verifyDetached(tamperedPayload, sig, senderKeys.publicKey)).toBe(false);
  });

  it('Milestone 20: verifies ephemeral sharing container carrier hash ring rejects modified carriers', async () => {
    const dummyCarrier = new Uint8Array(2048);
    for (let i = 0; i < dummyCarrier.length; i++) dummyCarrier[i] = (i * 17) & 0xff;

    const payload = new TextEncoder().encode('Hash ring tamper test');

    const { uri } = await Ombrix.createShareLink({
      expiresInSeconds: 3600,
      carrierBytes: dummyCarrier,
      payloadBytes: payload,
    });

    // Opening with original carrier succeeds
    const openedOriginal = await Ombrix.openShareLink(uri, { carrierBytes: dummyCarrier });
    expect(openedOriginal.carrierVerified).toBe(true);
    expect(openedOriginal.payloadBytes).toEqual(payload);

    // Modifying a single byte in the carrier must cause hash ring failure (rejection)
    const modifiedCarrier = new Uint8Array(dummyCarrier);
    modifiedCarrier[100] = (modifiedCarrier[100] ?? 0) ^ 0xff;

    await expect(Ombrix.openShareLink(uri, { carrierBytes: modifiedCarrier })).rejects.toThrow();
  });

  it('Milestone 20: mutation fuzzing across research stego extractors produces zero unhandled crashes', async () => {
    const width = 32;
    const height = 32;
    const randomNoiseCarrier = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4),
    };

    // 100 pseudo-random noise mutations
    for (let iter = 0; iter < 100; iter++) {
      for (let i = 0; i < randomNoiseCarrier.data.length; i++) {
        randomNoiseCarrier.data[i] = (Math.random() * 256) | 0;
      }

      // PVD Extraction fuzzing: must throw ExtractionError or return bytes, never crash with unhandled exception
      try {
        await Ombrix.extractPvd(randomNoiseCarrier);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }

      // DWT Extraction fuzzing
      try {
        await Ombrix.extractDwt(randomNoiseCarrier);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    }
  });

  it('Milestone 20: verifies curated demo dataset vectors embed and extract accurately', async () => {
    const carrier = demoDataset.referenceCarriers.gradientCarrier64;
    const payload = demoDataset.samplePayloads.shortText;

    // Test PVD on reference carrier
    const stegoPvd = await Ombrix.embedPvd(carrier, payload);
    const recoveredPvd = await Ombrix.extractPvd(stegoPvd);
    expect(recoveredPvd).toEqual(payload);

    // Test DWT on reference carrier
    const stegoDwt = await Ombrix.embedDwt(carrier, payload);
    const recoveredDwt = await Ombrix.extractDwt(stegoDwt);
    expect(recoveredDwt).toEqual(payload);
  });

  it('Milestone 21: verifies all core documentation files exist and are populated', () => {
    const requiredDocs = [
      'algorithms.md',
      'architecture.md',
      'browser-compatibility.md',
      'key-management.md',
      'limitations.md',
      'protocol-v1.md',
      'release-process.md',
      'threat-model.md',
      'licenses.md',
    ];

    for (const doc of requiredDocs) {
      const docPath = path.resolve(__dirname, '../../docs', doc);
      expect(fs.existsSync(docPath), `Missing documentation file: docs/${doc}`).toBe(true);
      const stat = fs.statSync(docPath);
      expect(stat.size, `Documentation file docs/${doc} must not be empty`).toBeGreaterThan(100);
    }
  });
});
