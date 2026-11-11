import { describe, expect, it } from 'vitest';
import { decodePngAsync, encodePngAsync } from '../../apps/web/src/utils/browserPngCodec.js';
import { packFilePayload, unpackFilePayload } from '../../apps/web/src/utils/filePayload.js';
import {
  decryptWithPasskey,
  encryptWithPasskey,
  initCrypto,
} from '../../packages/crypto-adapter/src/index.js';
import { parseEnvelope, serializeEnvelope } from '../../packages/payload-protocol/src/index.js';
import { hyperMatrixMethod } from '../../packages/stego-advanced/src/hyperMatrix.js';
import { stealthMatrixMethod } from '../../packages/stego-advanced/src/stealthMatrix.js';
import type { CarrierImage } from '../../packages/stego-interface/src/index.js';
import {
  type StegoWorkerErrorResponse,
  StegoWorkerHandler,
  type StegoWorkerResponse,
  type StegoWorkerSuccessResponse,
  type WorkerPostMessagePort,
} from '../../packages/stego-worker/src/worker-handler.js';

function createSyntheticCarrier(width = 800, height = 600): CarrierImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (i * 11) % 256;
    data[i + 1] = (i * 19) % 256;
    data[i + 2] = (i * 23) % 256;
    data[i + 3] = 255;
  }
  return { width, height, data };
}

describe('Secret Photo Stego Architecture Verification', () => {
  it('losslessly encodes and decodes carrier with browser PNG codec (zero bit loss)', async () => {
    const original = createSyntheticCarrier(200, 150);
    const pngBytes = await encodePngAsync(original);
    expect(pngBytes.length).toBeGreaterThan(0);
    expect(pngBytes[0]).toBe(0x89);
    expect(pngBytes[1]).toBe(0x50); // 'P'
    expect(pngBytes[2]).toBe(0x4e); // 'N'
    expect(pngBytes[3]).toBe(0x47); // 'G'

    const decoded = await decodePngAsync(pngBytes);
    expect(decoded.width).toBe(original.width);
    expect(decoded.height).toBe(original.height);
    expect(decoded.data.length).toBe(original.data.length);

    // Verify 100% exact bit match across all pixels
    for (let i = 0; i < original.data.length; i++) {
      expect(decoded.data[i]).toBe(original.data[i]);
    }
  }, 15000);

  it('embeds photo as secret message, exports to PNG, reloads, and extracts with 32-byte token', async () => {
    await initCrypto();
    const carrier = createSyntheticCarrier(800, 600);
    const passkeyToken =
      '5DFB-9C8E-12D3-9875-228A-E0B4-6ABC-F770-833D-D46B-E0B5-53A9-CFCC-0D40-15D7-F8A7';

    // 1. Simulate 30KB Secret Photo
    const photoBytes = new Uint8Array(30 * 1024);
    for (let i = 0; i < photoBytes.length; i++) {
      photoBytes[i] = (i * 37) % 256;
    }

    const packedPhoto = packFilePayload(photoBytes, {
      name: 'agent-target-recon.jpg',
      mime: 'image/jpeg',
      size: photoBytes.length,
      width: 640,
      height: 480,
    });

    // 2. Encrypt with passkey token
    const encryptedSecret = encryptWithPasskey(packedPhoto, passkeyToken);

    // 3. Wrap in standard OMB1 envelope
    const envelope = {
      version: 1,
      cryptoSuite: 'NONE' as const,
      stegoMethod: 'PNG_LSB_SEQUENTIAL' as const,
      flags: { signed: false, hasRecipientFingerprint: false },
      messageId: new Uint8Array(16),
      payload: encryptedSecret,
    };
    const payloadBytes = serializeEnvelope(envelope);

    // 4. Embed into carrier with HyperMatrix
    const stegoCarrier = await hyperMatrixMethod.embed(carrier, payloadBytes, {
      passphrase: passkeyToken,
    });

    // 5. Save as lossless PNG bytes (simulating download)
    const pngExport = await encodePngAsync(stegoCarrier);

    // 6. Reload from PNG bytes (simulating upload into Reveal Secret)
    const reloadedCarrier = await decodePngAsync(pngExport);

    // 7. Auto-probe extraction via worker handler
    let workerResult: StegoWorkerSuccessResponse | null = null;
    let workerError: StegoWorkerErrorResponse | null = null;

    const fakePort: WorkerPostMessagePort = {
      postMessage: (msg: StegoWorkerResponse) => {
        if (msg.type === 'SUCCESS') workerResult = msg;
        if (msg.type === 'ERROR') workerError = msg;
      },
    };

    const handler = new StegoWorkerHandler(fakePort);
    await handler.handleMessage({
      id: 'photo-extract-job-1',
      type: 'EXTRACT',
      width: reloadedCarrier.width,
      height: reloadedCarrier.height,
      carrierBuffer: reloadedCarrier.data.buffer as ArrayBuffer,
      options: {
        methodId: 'auto',
        passphrase: passkeyToken,
      },
    });

    expect(workerError).toBeNull();
    expect(workerResult).not.toBeNull();

    const recoveredPayload = new Uint8Array(workerResult.payloadBuffer);
    expect(recoveredPayload).toEqual(payloadBytes);

    // 8. Parse envelope and decrypt
    const parsedEnv = parseEnvelope(recoveredPayload);
    const decryptedBytes = decryptWithPasskey(parsedEnv.payload, passkeyToken);
    expect(decryptedBytes).toEqual(packedPhoto);

    // 9. Unpack secret photo
    const unpacked = unpackFilePayload(decryptedBytes);
    expect(unpacked).not.toBeNull();
    expect(unpacked?.name).toBe('agent-target-recon.jpg');
    expect(unpacked?.mime).toBe('image/jpeg');
    expect(unpacked?.width).toBe(640);
    expect(unpacked?.height).toBe(480);
    expect(unpacked?.data).toEqual(photoBytes);
  }, 15000);

  it('provides a clean human-readable error when passkey is incorrect during auto-probe', async () => {
    const carrier = createSyntheticCarrier(400, 300);
    const passkey = 'CORRECT-SECRET-PASSKEY';
    const payload = new TextEncoder().encode('Confidential payload');

    const stegoCarrier = await stealthMatrixMethod.embed(carrier, payload, { passphrase: passkey });

    let workerResult: StegoWorkerSuccessResponse | null = null;
    let workerError: StegoWorkerErrorResponse | null = null;

    const fakePort: WorkerPostMessagePort = {
      postMessage: (msg: StegoWorkerResponse) => {
        if (msg.type === 'SUCCESS') workerResult = msg;
        if (msg.type === 'ERROR') workerError = msg;
      },
    };

    const handler = new StegoWorkerHandler(fakePort);
    await handler.handleMessage({
      id: 'wrong-key-job',
      type: 'EXTRACT',
      width: stegoCarrier.width,
      height: stegoCarrier.height,
      carrierBuffer: stegoCarrier.data.buffer as ArrayBuffer,
      options: {
        methodId: 'auto',
        passphrase: 'WRONG-PASSKEY-ATTEMPT',
      },
    });

    expect(workerResult).toBeNull();
    expect(workerError).not.toBeNull();
    // Must NOT be the misleading Haar DWT error!
    expect(workerError.error.message).not.toContain('Invalid Haar DWT');
    expect(workerError.error.message).toContain('No valid steganographic payload detected');
  }, 15000);
});
