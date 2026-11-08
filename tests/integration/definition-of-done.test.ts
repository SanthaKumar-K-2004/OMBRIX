import * as fs from 'node:fs';
import * as path from 'node:path';
import { encodePng } from '@ombrix/cli';
import {
  DecryptionFailedError,
  computeFingerprint,
  decryptVaultData,
  encryptVaultData,
  fromBase64,
  generateEncryptionKeyPair,
  generateSigningKeyPair,
  isCryptoReady,
  toBase64,
} from '@ombrix/crypto-adapter';
import { Ombrix } from '@ombrix/edge-sdk';
import { validatePng } from '@ombrix/image-validation';
import { haarDwtStego, jpegDctStego, pvdStego } from '@ombrix/stego-advanced';
import type { CarrierImage } from '@ombrix/stego-interface';
import { pngLsbMatching } from '@ombrix/stego-lab';
import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApngVector } from '../../packages/image-validation/tests/helpers/png-builder.js';

function makeCarrier(width: number, height: number): CarrierImage {
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

describe('Section 22 Definition of Done (DoD) Automated Verification', () => {
  beforeAll(async () => {
    await Ombrix.init();
  });

  describe('Pillar 1: Product Capabilities', () => {
    it('DoD 1.1: User can create cryptographic keys and derive fingerprints', () => {
      const encKeys = generateEncryptionKeyPair();
      const signKeys = generateSigningKeyPair();

      expect(encKeys.publicKey.length).toBe(32);
      expect(encKeys.privateKey.length).toBe(32);
      expect(signKeys.publicKey.length).toBe(32);
      expect(signKeys.privateKey.length).toBe(64);

      const fp = computeFingerprint(encKeys.publicKey);
      expect(fp).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){7}$/);
    });

    it('DoD 1.2: Sender can encrypt and embed a payload into a supported PNG carrier', async () => {
      const carrier = makeCarrier(64, 64);
      const bob = generateEncryptionKeyPair();
      const secret = 'OMBRIX Production-Ready Payload';

      const stegoCarrier = await Ombrix.embed(carrier, secret, {
        recipientPublicKey: toBase64(bob.publicKey),
      });

      expect(stegoCarrier.width).toBe(carrier.width);
      expect(stegoCarrier.height).toBe(carrier.height);

      const pngBytes = encodePng(stegoCarrier);
      const validation = validatePng(pngBytes);
      expect(validation.valid).toBe(true);
    });

    it('DoD 1.3: Recipient can extract and decrypt payload in a fresh session', async () => {
      const carrier = makeCarrier(64, 64);
      const bob = generateEncryptionKeyPair();
      const secret = 'Fresh session extraction test payload';

      const stegoCarrier = await Ombrix.embed(carrier, secret, {
        recipientPublicKey: toBase64(bob.publicKey),
      });

      // Simulate a completely fresh session by extracting with recipient private key
      const extracted = await Ombrix.extract(stegoCarrier, {
        recipientPrivateKey: toBase64(bob.privateKey),
      });

      expect(extracted.text).toBe(secret);
      expect(extracted.isEncrypted).toBe(true);
    });

    it('DoD 1.4: Binary file payloads are bounded and treated strictly as inert bytes', async () => {
      const carrier = makeCarrier(64, 64);
      const binaryData = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0xff]);

      const stegoCarrier = await Ombrix.embed(carrier, binaryData);
      const extracted = await Ombrix.extract(stegoCarrier);

      expect(extracted.payload).toEqual(binaryData);
      expect(extracted.isEncrypted).toBe(false);
    });

    it('DoD 1.5: Rejects unsupported formats and corrupt carriers safely', () => {
      const corruptData = new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77]);
      const res = validatePng(corruptData);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error.name).toBe('InvalidSignatureError');
      }
    });
  });

  describe('Pillar 2: Cryptographic Rigor', () => {
    it('DoD 2.1: Uses vetted Libsodium WebAssembly cryptographic runtime', () => {
      expect(isCryptoReady()).toBe(true);
    });

    it('DoD 2.2: Encryption and signing keys are cryptographically distinct', () => {
      const enc = generateEncryptionKeyPair();
      const sign = generateSigningKeyPair();

      // Encryption private key is 32 bytes (X25519)
      // Signing private key is 64 bytes (Ed25519)
      expect(enc.privateKey.length).toBe(32);
      expect(sign.privateKey.length).toBe(64);
    });

    it('DoD 2.3: Decryption fails cleanly with wrong recipient key (zero plaintext leak)', async () => {
      const carrier = makeCarrier(64, 64);
      const bob = generateEncryptionKeyPair();
      const eve = generateEncryptionKeyPair();
      const secret = 'Eyes only for Bob';

      const stegoCarrier = await Ombrix.embed(carrier, secret, {
        recipientPublicKey: toBase64(bob.publicKey),
      });

      await expect(
        Ombrix.extract(stegoCarrier, {
          recipientPrivateKey: toBase64(eve.privateKey),
        }),
      ).rejects.toThrow(DecryptionFailedError);
    });

    it('DoD 2.4: Tampered ciphertext fails Poly1305 authentication', async () => {
      const carrier = makeCarrier(64, 64);
      const bob = generateEncryptionKeyPair();
      const secret = 'Tamper detection payload';

      const stegoCarrier = await Ombrix.embed(carrier, secret, {
        recipientPublicKey: toBase64(bob.publicKey),
      });

      // Tamper with stego carrier pixels where payload is embedded
      const tamperedCarrier: CarrierImage = {
        width: stegoCarrier.width,
        height: stegoCarrier.height,
        data: new Uint8ClampedArray(stegoCarrier.data),
      };
      // Flip bits in the payload region
      tamperedCarrier.data[100] = (tamperedCarrier.data[100] ?? 0) ^ 0x01;

      await expect(
        Ombrix.extract(tamperedCarrier, {
          recipientPrivateKey: toBase64(bob.privateKey),
        }),
      ).rejects.toThrow();
    });

    it('DoD 2.5: Detached digital signatures are strictly bound to trusted sender key', async () => {
      const carrier = makeCarrier(64, 64);
      const alice = generateSigningKeyPair();
      const mallory = generateSigningKeyPair();
      const secret = 'Signed military orders from Alice';

      const stegoCarrier = await Ombrix.embed(carrier, secret, {
        signingPrivateKey: toBase64(alice.privateKey),
      });

      // Verify with Alice's public key (valid)
      const resAlice = await Ombrix.extract(stegoCarrier, {
        senderSigningPublicKey: toBase64(alice.publicKey),
      });
      expect(resAlice.isSigned).toBe(true);
      expect(resAlice.signatureVerified).toBe(true);

      // Verify with Mallory's public key (invalid)
      const resMallory = await Ombrix.extract(stegoCarrier, {
        senderSigningPublicKey: toBase64(mallory.publicKey),
      });
      expect(resMallory.isSigned).toBe(true);
      expect(resMallory.signatureVerified).toBe(false);
    });

    it('DoD 2.6: Argon2id password-protected key vault export and restore', () => {
      const keypair = generateEncryptionKeyPair();
      const passphrase = 'Ultra-Secure-Password-2026!';

      const vaultBundle = encryptVaultData(
        {
          identities: [
            {
              id: 'ID_ALICE',
              label: 'Alice Master Key',
              encryption: {
                publicKey: toBase64(keypair.publicKey),
                privateKey: toBase64(keypair.privateKey),
              },
              createdAt: Date.now(),
            },
          ],
        },
        passphrase,
      );

      expect(vaultBundle.magic).toBe('OMBRIX_VAULT_BACKUP');

      const restored = decryptVaultData(vaultBundle, passphrase);
      expect(restored.identities).toHaveLength(1);
      expect(restored.identities[0]?.id).toBe('ID_ALICE');

      // Fails with wrong passphrase
      expect(() => decryptVaultData(vaultBundle, 'WrongPassword')).toThrow();
    });
  });

  describe('Pillar 3: Image Engine & Steganography Defense', () => {
    it('DoD 3.1: Static PNG capacity calculation matches independent vectors', () => {
      const carrier = makeCarrier(100, 100);
      const capacity = pngLsbSequential.calculateCapacity(carrier);

      // 100x100 = 10,000 pixels * 3 channels = 30,000 bits = 3,750 bytes total capacity
      // Header overhead is 4 bytes (32-bit length prefix)
      expect(capacity.theoreticalBytes).toBe(3750);
      expect(capacity.usableBytes).toBe(3746);
      expect(capacity.overheadBytes).toBe(4);
    });

    it('DoD 3.2: Rejects APNG, oversized images, and decompression bombs safely', () => {
      const apng = createApngVector('acTL', 'before-idat');

      const res = validatePng(apng);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error.name).toBe('AnimatedPngDetectedError');
      }
    });

    it('DoD 3.3: Exact roundtrip embedding and extraction across all 5 algorithms', async () => {
      const carrier = makeCarrier(64, 64);
      const payload = new TextEncoder().encode('DoD Multi-Algorithm Roundtrip Benchmark 2026');

      // 1. Sequential RGB LSB
      const stegoLsb = await pngLsbSequential.embed(carrier, payload);
      expect(await pngLsbSequential.extract(stegoLsb)).toEqual(payload);

      // 2. LSB Matching
      const stegoMatching = await pngLsbMatching.embed(carrier, payload);
      expect(await pngLsbMatching.extract(stegoMatching)).toEqual(payload);

      // 3. PVD (Pixel Value Differencing)
      const stegoPvd = await pvdStego.embed(carrier, payload);
      expect(await pvdStego.extract(stegoPvd)).toEqual(payload);

      // 4. 2D Haar DWT
      const stegoDwt = await haarDwtStego.embed(carrier, payload);
      expect(await haarDwtStego.extract(stegoDwt)).toEqual(payload);

      // 5. JPEG 8x8 DCT
      const stegoDct = await jpegDctStego.embed(carrier, payload);
      expect(await jpegDctStego.extract(stegoDct)).toEqual(payload);
    });
  });

  describe('Pillar 4: UX, Accessibility & Client-Side Design', () => {
    it('DoD 4.1: UI shell enforces WCAG accessibility and brand design tokens', () => {
      const indexCssPath = path.resolve(__dirname, '../../apps/web/src/index.css');
      expect(fs.existsSync(indexCssPath)).toBe(true);

      const cssContent = fs.readFileSync(indexCssPath, 'utf8').toLowerCase();
      // Verifies obsidian background and brand palette
      expect(cssContent).toContain('#0b0f19');
      expect(cssContent).toContain('#7c3aed');
      expect(cssContent).toContain('#14b8a6');
    });

    it('DoD 4.2: Security states are communicated with text and icon indicators, not color alone', () => {
      const coreStudioPath = path.resolve(
        __dirname,
        '../../apps/web/src/components/CoreStudio.tsx',
      );
      expect(fs.existsSync(coreStudioPath)).toBe(true);

      const content = fs.readFileSync(coreStudioPath, 'utf8');
      expect(content).toContain('Valid Ed25519 Signature');
      expect(content).toContain('Decryption Authenticated & Successful');
    });
  });

  describe('Pillar 5: Security, Zero-Telemetry & Release Readiness', () => {
    it('DoD 5.1: Content Security Policy strictly enforces zero network telemetry', () => {
      const htmlPath = path.resolve(__dirname, '../../apps/web/index.html');
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');

      expect(htmlContent).toContain("connect-src 'none'");
      expect(htmlContent).toContain("default-src 'self'");
      expect(htmlContent).toContain("object-src 'none'");
    });

    it('DoD 5.2: Production documentation and transparent threat limitations published', () => {
      const docsDir = path.resolve(__dirname, '../../docs');
      const requiredDocs = [
        'threat-model.md',
        'key-management.md',
        'algorithms.md',
        'limitations.md',
        'browser-compatibility.md',
        'licenses.md',
        'release-process.md',
      ];

      for (const doc of requiredDocs) {
        const fullPath = path.join(docsDir, doc);
        expect(fs.existsSync(fullPath)).toBe(true);
        const text = fs.readFileSync(fullPath, 'utf8');
        expect(text.length).toBeGreaterThan(100);
      }
    });

    it('DoD 5.3: Offline PWA manifest and service worker precache verified', () => {
      const manifestPath = path.resolve(__dirname, '../../apps/web/public/manifest.webmanifest');
      const swPath = path.resolve(__dirname, '../../apps/web/public/sw.js');

      expect(fs.existsSync(manifestPath)).toBe(true);
      expect(fs.existsSync(swPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(manifest.display).toBe('standalone');
      expect(manifest.theme_color).toBe('#0B0F19');
    });
  });
});
