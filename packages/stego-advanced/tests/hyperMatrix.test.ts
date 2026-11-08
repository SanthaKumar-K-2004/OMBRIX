import type { CarrierImage } from '@ombrix/stego-interface';
import { describe, expect, it } from 'vitest';
import { hyperMatrixMethod } from '../src/hyperMatrix.js';

function createTestCarrier(width = 64, height = 64): CarrierImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = (x * 3 + y * 7) % 256; // R
      data[idx + 1] = (x * 11 + y * 5) % 256; // G
      data[idx + 2] = (x * 13 + y * 17) % 256; // B
      data[idx + 3] = 255; // A
    }
  }
  return { width, height, data };
}

describe('OMBRIX Hyper-Matrix (Quad-Hybrid Omni-Stealth)', () => {
  it('calculates capacity accurately for carrier', () => {
    const carrier = createTestCarrier(100, 100);
    const cap = hyperMatrixMethod.calculateCapacity(carrier);
    expect(cap.usableBytes).toBeGreaterThan(3000);
    expect(cap.channelsUsed).toEqual(['R', 'G', 'B']);
    expect(cap.overheadBytes).toBe(16);
  });

  it('embeds and extracts payload with 100% fidelity without passkey', async () => {
    const carrier = createTestCarrier(64, 64);
    const payload = new TextEncoder().encode('Confidential Hyper-Matrix Secret Payload 2026!');

    const stegoCarrier = await hyperMatrixMethod.embed(carrier, payload);
    expect(stegoCarrier.width).toBe(64);
    expect(stegoCarrier.height).toBe(64);

    const recoveredBytes = await hyperMatrixMethod.extract(stegoCarrier);
    const recoveredText = new TextDecoder().decode(recoveredBytes);
    expect(recoveredText).toBe('Confidential Hyper-Matrix Secret Payload 2026!');
  });

  it('embeds and extracts payload with custom passkey', async () => {
    const carrier = createTestCarrier(64, 64);
    const payload = new TextEncoder().encode('Top-Secret Defense Memo: Passkey Secured');
    const passphrase = 'alphaxheros-hyper-quad-key';

    const stegoCarrier = await hyperMatrixMethod.embed(carrier, payload, { passphrase });
    const recoveredBytes = await hyperMatrixMethod.extract(stegoCarrier, { passphrase });
    expect(new TextDecoder().decode(recoveredBytes)).toBe(
      'Top-Secret Defense Memo: Passkey Secured',
    );
  });

  it('fails extraction if wrong passkey is provided', async () => {
    const carrier = createTestCarrier(64, 64);
    const payload = new TextEncoder().encode('Super secret');
    const stegoCarrier = await hyperMatrixMethod.embed(carrier, payload, {
      passphrase: 'correct-password',
    });

    await expect(
      hyperMatrixMethod.extract(stegoCarrier, { passphrase: 'wrong-password' }),
    ).rejects.toThrow();
  });

  it('maintains high visual quality (PSNR > 50 dB)', async () => {
    const carrier = createTestCarrier(80, 80);
    const payload = new TextEncoder().encode('High-PSNR invisible payload test.');

    const stegoCarrier = await hyperMatrixMethod.embed(carrier, payload);

    let sumSq = 0;
    const totalBytes = carrier.data.length;
    for (let i = 0; i < totalBytes; i++) {
      const diff = carrier.data[i]! - stegoCarrier.data[i]!;
      sumSq += diff * diff;
    }
    const mse = sumSq / totalBytes;
    const psnr = 10 * Math.log10((255 * 255) / mse);

    expect(psnr).toBeGreaterThan(50);
  });
});

