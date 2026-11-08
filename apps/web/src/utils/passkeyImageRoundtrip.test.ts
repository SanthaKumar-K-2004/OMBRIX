import {
  decryptWithPasskey,
  encryptWithPasskey,
  generateRandomPasskey32,
  initCrypto,
  isPasskeyEncrypted,
} from '@ombrix/crypto-adapter';
import {
  haarDwtStego,
  hyperMatrixMethod,
  pvdStego,
  stealthMatrixMethod,
} from '@ombrix/stego-advanced';
import type { CarrierImage } from '@ombrix/stego-interface';
import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import { beforeAll, describe, expect, it } from 'vitest';
import { packFilePayload, unpackFilePayload } from './filePayload.js';

describe('Passkey & Secret Image Full Stego Roundtrip', () => {
  beforeAll(async () => {
    await initCrypto();
  });

  const createSyntheticCarrier = (width = 120, height = 120): CarrierImage => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = (i * 13) % 256;
      data[i + 1] = (i * 29) % 256;
      data[i + 2] = (i * 47) % 256;
      data[i + 3] = 255;
    }
    return { width, height, data };
  };

  it('embeds and reveals text message locked with 32-Byte Token using Hyper-Matrix', async () => {
    const carrier = createSyntheticCarrier(120, 120);
    const secretText = 'Top Secret 32-Bit Token Message Protected by OMBRIX Core';
    const rawBytes = new TextEncoder().encode(secretText);

    // 1. Generate 32-Byte Token
    const token = generateRandomPasskey32('formatted');
    expect(token).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}/);

    // 2. Encrypt payload with the 32-Byte Token
    const encryptedPayload = encryptWithPasskey(rawBytes, token);
    expect(isPasskeyEncrypted(encryptedPayload)).toBe(true);

    // 3. Embed into carrier using Hyper-Matrix
    const stegoCarrier = await hyperMatrixMethod.embed(carrier, encryptedPayload, {
      passphrase: token,
    });

    // 4. Extract from stego carrier
    const extractedBytes = await hyperMatrixMethod.extract(stegoCarrier, {
      passphrase: token,
    });
    expect(isPasskeyEncrypted(extractedBytes)).toBe(true);

    // 5. Decrypt using the 32-Byte Token
    const decryptedBytes = decryptWithPasskey(extractedBytes, token);
    const recoveredText = new TextDecoder().decode(decryptedBytes);
    expect(recoveredText).toBe(secretText);
  });

  it('embeds and reveals Secret Image locked with 32-Byte Token', async () => {
    const carrier = createSyntheticCarrier(160, 160);

    // Create synthetic secret PNG image
    const secretImageBytes = new Uint8Array([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      ...new Array(300).fill(0x77),
    ]);
    const imageMeta = {
      name: 'top-secret-blueprint.png',
      mime: 'image/png',
      size: secretImageBytes.length,
      width: 48,
      height: 48,
    };

    // 1. Pack secret image into container
    const packedImage = packFilePayload(secretImageBytes, imageMeta);

    // 2. Lock with 32-Byte Token
    const token = generateRandomPasskey32('formatted');
    const lockedImage = encryptWithPasskey(packedImage, token);

    // 3. Embed into carrier using Stealth Matrix
    const stegoCarrier = await stealthMatrixMethod.embed(carrier, lockedImage, {
      passphrase: token,
    });

    // 4. Extract from carrier
    const extractedBytes = await stealthMatrixMethod.extract(stegoCarrier, {
      passphrase: token,
    });
    expect(isPasskeyEncrypted(extractedBytes)).toBe(true);

    // 5. Decrypt with 32-Byte Token
    const decryptedPacked = decryptWithPasskey(extractedBytes, token);

    // 6. Unpack file payload and verify image
    const restoredFile = unpackFilePayload(decryptedPacked);
    expect(restoredFile).not.toBeNull();
    expect(restoredFile?.name).toBe('top-secret-blueprint.png');
    expect(restoredFile?.mime).toBe('image/png');
    expect(restoredFile?.isImage).toBe(true);
    expect(restoredFile?.data).toEqual(secretImageBytes);
  });

  it('embeds and reveals with custom passphrase (alphaxheros) across Sequential LSB', async () => {
    const carrier = createSyntheticCarrier(80, 80);
    const secretText = 'HI Friends - Secret Payload';
    const rawBytes = new TextEncoder().encode(secretText);
    const customPass = 'alphaxheros';

    // Encrypt payload with custom passkey
    const encryptedPayload = encryptWithPasskey(rawBytes, customPass);

    // Embed into sequential LSB
    const stegoCarrier = await pngLsbSequential.embed(carrier, encryptedPayload);

    // Extract
    const extractedBytes = await pngLsbSequential.extract(stegoCarrier);
    expect(isPasskeyEncrypted(extractedBytes)).toBe(true);

    // Decrypt with correct passkey
    const decryptedBytes = decryptWithPasskey(extractedBytes, customPass);
    expect(new TextDecoder().decode(decryptedBytes)).toBe(secretText);

    // Fails with wrong passkey
    expect(() => decryptWithPasskey(extractedBytes, 'wrong-password')).toThrow(
      /Decryption failed: incorrect passkey, token mismatch/,
    );
  });

  it('embeds and reveals with passkey across Haar DWT Wavelet engine', async () => {
    const carrier = createSyntheticCarrier(64, 64);
    const secretText = 'Haar Wavelet Passkey Secret';
    const rawBytes = new TextEncoder().encode(secretText);
    const passkey = generateRandomPasskey32();

    const encryptedPayload = encryptWithPasskey(rawBytes, passkey);
    const stegoCarrier = await haarDwtStego.embed(carrier, encryptedPayload);

    const extractedBytes = await haarDwtStego.extract(stegoCarrier);
    expect(isPasskeyEncrypted(extractedBytes)).toBe(true);
    const decryptedBytes = decryptWithPasskey(extractedBytes, passkey);
    expect(new TextDecoder().decode(decryptedBytes)).toBe(secretText);
  });

  it('embeds and reveals with passkey across Wu & Tsai PVD engine', async () => {
    const carrier = createSyntheticCarrier(64, 64);
    const secretText = 'PVD Contrast Passkey Secret';
    const rawBytes = new TextEncoder().encode(secretText);
    const passkey = generateRandomPasskey32();

    const encryptedPayload = encryptWithPasskey(rawBytes, passkey);
    const stegoCarrier = await pvdStego.embed(carrier, encryptedPayload);

    const extractedBytes = await pvdStego.extract(stegoCarrier);
    expect(isPasskeyEncrypted(extractedBytes)).toBe(true);
    const decryptedBytes = decryptWithPasskey(extractedBytes, passkey);
    expect(new TextDecoder().decode(decryptedBytes)).toBe(secretText);
  });
});
