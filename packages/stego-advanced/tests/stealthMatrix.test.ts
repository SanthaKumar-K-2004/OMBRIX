import { describe, expect, it } from 'vitest';
import { stealthMatrixMethod } from '../src/stealthMatrix.js';

describe('OMBRIX Stealth Matrix Engine (±1 Adaptive Edge-Scattered)', () => {
  function createSyntheticCarrier(width: number, height: number) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = (x * 17 + y * 23) % 256;
        data[idx + 1] = (y * 31 + x * 7) % 256;
        data[idx + 2] = (x * y + 53) % 256;
        data[idx + 3] = 255;
      }
    }
    return { width, height, data };
  }

  it('embeds and extracts secret payload using default stealth salt', async () => {
    const carrier = createSyntheticCarrier(64, 64);
    const secretText = 'OMBRIX classified payload: beyond what the eye can see.';
    const payload = new TextEncoder().encode(secretText);

    const stegoCarrier = await stealthMatrixMethod.embed(carrier, payload);
    expect(stegoCarrier.width).toBe(64);
    expect(stegoCarrier.height).toBe(64);

    const extracted = await stealthMatrixMethod.extract(stegoCarrier);
    expect(new TextDecoder().decode(extracted)).toBe(secretText);
  });

  it('embeds and extracts with custom user passphrase', async () => {
    const carrier = createSyntheticCarrier(64, 64);
    const secretText = 'Protected with custom Argon2/ChaCha20 passphrase';
    const payload = new TextEncoder().encode(secretText);
    const passphrase = 'SuperSecretCustomPassword123!';

    const stegoCarrier = await stealthMatrixMethod.embed(carrier, payload, { passphrase });
    const extracted = await stealthMatrixMethod.extract(stegoCarrier, { passphrase });
    expect(new TextDecoder().decode(extracted)).toBe(secretText);
  });

  it('fails cleanly with ExtractionError when an incorrect passphrase is used', async () => {
    const carrier = createSyntheticCarrier(64, 64);
    const secretText = 'Encrypted payload';
    const payload = new TextEncoder().encode(secretText);
    const passphrase = 'CorrectPassword';

    const stegoCarrier = await stealthMatrixMethod.embed(carrier, payload, { passphrase });

    await expect(
      stealthMatrixMethod.extract(stegoCarrier, { passphrase: 'WrongPassword!' }),
    ).rejects.toThrow(/No OMBRIX stealth payload detected|incorrect passphrase/);
  });

  it('achieves imperceptible image quality with high PSNR (> 60 dB)', async () => {
    const carrier = createSyntheticCarrier(64, 64);
    const secretText = 'High visual fidelity stealth testing';
    const payload = new TextEncoder().encode(secretText);

    const stego = await stealthMatrixMethod.embed(carrier, payload);

    let sumSqDiff = 0;
    const totalBytes = carrier.data.length;
    for (let i = 0; i < totalBytes; i++) {
      const diff = (carrier.data[i] ?? 0) - (stego.data[i] ?? 0);
      sumSqDiff += diff * diff;
    }

    const mse = sumSqDiff / totalBytes;
    const psnr = 10 * Math.log10((255 * 255) / mse);

    // MSE should be tiny (< 0.1) and PSNR very high (> 60 dB)
    expect(mse).toBeLessThan(0.1);
    expect(psnr).toBeGreaterThan(60);
  });

  it('rejects payloads exceeding safe carrier capacity', async () => {
    const carrier = createSyntheticCarrier(16, 16); // Small carrier
    const hugePayload = new Uint8Array(5000); // Exceeds capacity

    await expect(stealthMatrixMethod.embed(carrier, hugePayload)).rejects.toThrow(
      /exceeds stealth carrier capacity/,
    );
  });

  it('embeds and extracts reliably on smooth and boundary gradient images', async () => {
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = (x * 4) % 256;
        data[idx + 1] = (y * 4) % 256;
        data[idx + 2] = 128;
        data[idx + 3] = 255;
      }
    }
    const carrier = { width, height, data };
    const secretText = 'Reliable across all image gradient boundaries';
    const payload = new TextEncoder().encode(secretText);

    const stego = await stealthMatrixMethod.embed(carrier, payload);
    const extracted = await stealthMatrixMethod.extract(stego);
    expect(new TextDecoder().decode(extracted)).toBe(secretText);
  });
});
