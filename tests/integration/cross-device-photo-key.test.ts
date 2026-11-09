import {
  computePerceptualHashFromRgba,
  decryptWithPasskey,
  encryptWithPasskey,
  initCrypto,
  toHex,
} from '@ombrix/crypto-adapter';
import type { CarrierImage } from '@ombrix/stego-interface';
import { simulateJpegCompression } from '@ombrix/transit-trace';
import { describe, expect, it } from 'vitest';

function createSampleKeyPhoto(width = 256, height = 256): CarrierImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = Math.floor(Math.sin(x * 0.05) * 80 + 128);
      const g = Math.floor(Math.cos(y * 0.05) * 80 + 128);
      const b = Math.floor(Math.sin((x + y) * 0.03) * 80 + 128);
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('Cross-Device Photo-As-Key Resilience Test', () => {
  it('successfully unlocks secret when key photo was transmitted via WhatsApp JPEG compression', async () => {
    await initCrypto();
    // 1. Device A: Original Key Photo
    const originalKeyPhoto = createSampleKeyPhoto(256, 256);
    const keyA = computePerceptualHashFromRgba(
      originalKeyPhoto.width,
      originalKeyPhoto.height,
      originalKeyPhoto.data,
    );
    const passkeyHexA = toHex(keyA).toUpperCase();

    // 2. Encrypt confidential message on Device A
    const secretMessage = 'TOP-SECRET-MISSION: Cross-device perceptual photo key verified.';
    const secretBytes = new TextEncoder().encode(secretMessage);
    const ciphertextContainer = encryptWithPasskey(secretBytes, passkeyHexA);

    // 3. Sender sends key photo to recipient via WhatsApp (simulating aggressive JPEG 70 lossy recompression)
    const whatsAppKeyPhoto = simulateJpegCompression(originalKeyPhoto, 70);

    // 4. Device B: Recipient derives perceptual key from the WhatsApp-compressed copy
    const keyB = computePerceptualHashFromRgba(
      whatsAppKeyPhoto.width,
      whatsAppKeyPhoto.height,
      whatsAppKeyPhoto.data,
    );
    const passkeyHexB = toHex(keyB).toUpperCase();

    // The perceptual visual key is preserved across WhatsApp compression!
    expect(passkeyHexB).toBe(passkeyHexA);

    // 5. Decrypt on Device B
    const decryptedBytes = decryptWithPasskey(ciphertextContainer, passkeyHexB);
    const decryptedMessage = new TextDecoder().decode(decryptedBytes);
    expect(decryptedMessage).toBe(secretMessage);
  });
});
