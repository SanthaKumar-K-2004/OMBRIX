import { hyperMatrixMethod, robustResilientStego } from '@ombrix/stego-advanced';
import type { CarrierImage } from '@ombrix/stego-interface';
import { StegoWorkerHandler } from '@ombrix/stego-worker';
import { simulateJpegCompression, simulateResize } from '@ombrix/transit-trace';
import { describe, expect, it } from 'vitest';

function createPhotoCarrier(width = 384, height = 384): CarrierImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Multi-frequency synthetic photo texture
      const r = Math.sin(x * 0.05) * 60 + Math.cos(y * 0.05) * 60 + 128;
      const g = Math.cos(x * 0.03) * 50 + Math.sin(y * 0.03) * 50 + 128;
      const b = Math.sin((x + y) * 0.04) * 50 + 128;
      data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('Cross-Platform WhatsApp & Social Media Transmission Test', () => {
  it('survives WhatsApp-style lossy JPEG 75 compression and auto-probe extracts cleanly', async () => {
    const carrier = createPhotoCarrier(384, 384);
    const secretText = 'OMBRIX-WHATSAPP-SAFE-TOKEN: 8A2F-9C1D-4E7B-03F6';
    const secretPayload = new TextEncoder().encode(secretText);

    // 1. Laptop side: User encodes with Robust Messaging Mode
    const stegoCarrier = await robustResilientStego.embed(carrier, secretPayload);

    // 2. WhatsApp transmission simulation: Lossy JPEG recompression (Quality 75)
    const whatsAppTranscoded = simulateJpegCompression(stegoCarrier, 75);

    // 3. Phone side: Auto-probe extraction via Web Worker handler
    let responsePayload: Uint8Array | null = null;
    let responseError: Error | null = null;

    const mockPort = {
      postMessage: (msg: {
        type: string;
        payloadBuffer?: ArrayBuffer;
        error?: { message: string };
      }) => {
        if (msg.type === 'SUCCESS' && msg.payloadBuffer) {
          responsePayload = new Uint8Array(msg.payloadBuffer);
        } else if (msg.type === 'ERROR' && msg.error) {
          responseError = new Error(msg.error.message);
        }
      },
    };

    const handler = new StegoWorkerHandler(mockPort);
    await handler.handleMessage({
      id: 'job-phone-test-1',
      type: 'EXTRACT',
      width: whatsAppTranscoded.width,
      height: whatsAppTranscoded.height,
      carrierBuffer: whatsAppTranscoded.data.buffer.slice(0),
      options: { methodId: 'auto' }, // Phone uses automatic method probing!
    });

    expect(responseError).toBeNull();
    expect(responsePayload).not.toBeNull();
    const decodedSecret = new TextDecoder().decode(responsePayload!);
    expect(decodedSecret).toBe(secretText);
  });

  it('survives WhatsApp JPEG 75 compression when armored with a secret passkey', async () => {
    const carrier = createPhotoCarrier(384, 384);
    const secretText = 'PASSKEY-ARMORED-MESSAGE-OVER-WHATSAPP';
    const secretPayload = new TextEncoder().encode(secretText);
    const passkey = 'military-grade-whatsapp-key-2026';

    // 1. Laptop side: User encodes with Robust Messaging Mode + Passkey
    const stegoCarrier = await robustResilientStego.embed(carrier, secretPayload, {
      passphrase: passkey,
    });

    // 2. WhatsApp transmission: Lossy JPEG recompression (Quality 75)
    const whatsAppTranscoded = simulateJpegCompression(stegoCarrier, 75);

    // 3. Phone side: Extract with matching passkey
    const extractedWithKey = await robustResilientStego.extract(whatsAppTranscoded, {
      passphrase: passkey,
    });
    expect(new TextDecoder().decode(extractedWithKey)).toBe(secretText);

    // 4. Attacker side: Extract with wrong passkey -> rejected by HMAC
    await expect(
      robustResilientStego.extract(whatsAppTranscoded, {
        passphrase: 'wrong-attack-key',
      }),
    ).rejects.toThrow();
  });

  it('UNIFIED HYPER-MATRIX: embeds via Hyper-Matrix, survives WhatsApp JPEG 75, extracts via HyperMatrix fallback', async () => {
    const carrier = createPhotoCarrier(384, 384);
    const secretText = 'TOP-SECRET-HYPER-MATRIX-WHATSAPP-UNIFIED';
    const secretPayload = new TextEncoder().encode(secretText);
    const passkey =
      '2CC2-D98C-4E6B-641C-9D5D-CA4D-5831-C74B-A87E-26DD-20A3-C1F9-4523-37D8-5AEF-B491';

    // 1. Laptop side: User encodes with flagship Hyper-Matrix engine (single default method)
    const stegoCarrier = await hyperMatrixMethod.embed(carrier, secretPayload, {
      passphrase: passkey,
    });

    // 2. WhatsApp transmission: Lossy JPEG recompression (Quality 75) alters LSBs
    const whatsAppTranscoded = simulateJpegCompression(stegoCarrier, 75);

    // 3. Phone side: Extract directly using Hyper-Matrix with the 32-byte passkey!
    const recovered = await hyperMatrixMethod.extract(whatsAppTranscoded, {
      passphrase: passkey,
    });

    expect(new TextDecoder().decode(recovered)).toBe(secretText);
  });

  it('UNIFIED HYPER-MATRIX: extracts lossless PNG carrier via High-Capacity Wavelet LSB layer', async () => {
    const carrier = createPhotoCarrier(384, 384);
    const secretText = 'LOSSLESS-DOCUMENT-TRANSFER-PERFECT-FIDELITY';
    const secretPayload = new TextEncoder().encode(secretText);
    const passkey = 'token-lossless-fidelity-key';

    // 1. Encode with Hyper-Matrix
    const stegoCarrier = await hyperMatrixMethod.embed(carrier, secretPayload, {
      passphrase: passkey,
    });

    // 2. Lossless Document transfer (no JPEG transcoding)
    const recovered = await hyperMatrixMethod.extract(stegoCarrier, {
      passphrase: passkey,
    });

    expect(new TextDecoder().decode(recovered)).toBe(secretText);
  });

  it('UNIFIED HYPER-MATRIX: survives WhatsApp 1.5x downscaling + JPEG 75 compression via multi-scale probe', async () => {
    const carrier = createPhotoCarrier(480, 480);
    const secretText = 'WHATSAPP-DOWNSCALED-1.5X-RECOVERY';
    const secretPayload = new TextEncoder().encode(secretText);
    const passkey = 'scale-resilient-passkey-2026';

    // 1. Encoded at 480x480 with Hyper-Matrix
    const stegoCarrier = await hyperMatrixMethod.embed(carrier, secretPayload, {
      passphrase: passkey,
    });

    // 2. WhatsApp downscales from 480x480 to 320x320 (1.5x downscale) + applies JPEG 75 compression
    const downscaled = simulateResize(stegoCarrier, 320, 320);
    const transcoded = simulateJpegCompression(downscaled, 75);

    // 3. Phone side: HyperMatrix probe automatically detects downscaling, upscales to 480x480, and recovers!
    const recovered = await hyperMatrixMethod.extract(transcoded, {
      passphrase: passkey,
    });

    expect(new TextDecoder().decode(recovered)).toBe(secretText);
  });
});
