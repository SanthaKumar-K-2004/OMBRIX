import {
  DecryptionFailedError,
  buildSignDoc,
  computeFingerprint,
  computeKeyId,
  generateEncryptionKeyPair,
  generateSigningKeyPair,
  initCrypto,
  openSeal,
  seal,
  signDetached,
  verifyDetached,
} from '@ombrix/crypto-adapter';
import { parseEnvelope, serializeEnvelope } from '@ombrix/payload-protocol';
import type { Omb1Envelope } from '@ombrix/payload-protocol';
import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Phase 4: OMBRIX Studio End-to-End Secure Workflow Integration', () => {
  beforeAll(async () => {
    await initCrypto();
  });

  it('completes the full sender encrypt/sign/embed and recipient extract/decrypt/verify lifecycle', async () => {
    // 1. Participant Identities
    const aliceSigning = generateSigningKeyPair(); // Alice signs outgoing messages
    const bobEncryption = generateEncryptionKeyPair(); // Bob receives encrypted messages

    const bobKeyId = computeKeyId(bobEncryption.publicKey);
    const bobFingerprint = computeFingerprint(bobEncryption.publicKey);
    expect(bobFingerprint).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){7}$/);

    // 2. Sender (Alice) Prepares Payload
    const secretMessage = 'CONFIDENTIAL: Tactical deployment coordinates 48.8584° N, 2.2945° E';
    const plaintext = new TextEncoder().encode(secretMessage);

    // 3. Sender Encrypts via Libsodium Sealed Box (X25519-XChaCha20-Poly1305)
    const ciphertext = seal(plaintext, bobEncryption.publicKey);

    // 4. Sender Generates Random Message ID (16 bytes)
    const messageId = new Uint8Array(16);
    crypto.getRandomValues(messageId);

    // 5. Sender Signs Canonical SignDoc (Ed25519)
    const magic = new Uint8Array([0x4f, 0x4d, 0x42, 0x31]); // "OMB1"
    const flagsInt = 0x0001; // has_signature bit

    const signDoc = buildSignDoc({
      magic,
      version: 1,
      cipherSuite: 1, // X25519_XSALSA20_POLY1305
      flags: flagsInt,
      recipientKeyId: bobKeyId,
      messageId,
      ciphertext,
    });

    const signature = signDetached(signDoc, aliceSigning.privateKey);
    expect(signature.length).toBe(64);

    // 6. Assemble into Canonical OMB1 Binary Envelope
    const envelope: Omb1Envelope = {
      version: 1,
      cryptoSuite: 'X25519_XSALSA20_POLY1305',
      stegoMethod: 'PNG_LSB_SEQUENTIAL',
      flags: {
        signed: true,
        hasRecipientFingerprint: true,
      },
      messageId,
      recipientFingerprint: bobKeyId,
      payload: ciphertext,
      signature,
    };

    const envelopeBytes = serializeEnvelope(envelope);

    // 7. Embed into Carrier PNG Raster Buffer
    const width = 120;
    const height = 120;
    const carrierData = new Uint8ClampedArray(width * height * 4);
    // Initialize carrier with natural image baseline gradient
    for (let i = 0; i < carrierData.length; i += 4) {
      carrierData[i] = (i * 7) % 256; // R
      carrierData[i + 1] = (i * 13) % 256; // G
      carrierData[i + 2] = (i * 17) % 256; // B
      carrierData[i + 3] = 255; // Alpha (must remain untouched)
    }

    const carrier = { width, height, data: carrierData };
    const stegoCarrier = await pngLsbSequential.embed(carrier, envelopeBytes);

    // Verify alpha channel remains completely untouched
    for (let i = 3; i < stegoCarrier.data.length; i += 4) {
      expect(stegoCarrier.data[i]).toBe(255);
    }

    // 8. Transmission -> Recipient (Bob) Receives Stego Carrier
    // Extract raw payload bits from raster carrier
    const extractedBytes = await pngLsbSequential.extract(stegoCarrier);

    // 9. Recipient Parses OMB1 Binary Envelope
    const parsedEnvelope = parseEnvelope(extractedBytes);
    expect(parsedEnvelope.version).toBe(1);
    expect(parsedEnvelope.cryptoSuite).toBe('X25519_XSALSA20_POLY1305');
    expect(parsedEnvelope.flags.signed).toBe(true);
    expect(parsedEnvelope.recipientFingerprint).toEqual(bobKeyId);

    // 10. Recipient Decrypts Ciphertext with Bob's Private Key
    const decryptedBytes = openSeal(
      parsedEnvelope.payload,
      bobEncryption.publicKey,
      bobEncryption.privateKey,
    );
    const recoveredMessage = new TextDecoder().decode(decryptedBytes);
    expect(recoveredMessage).toBe(secretMessage);

    // 11. Recipient Verifies Sender's Signature against Alice's Public Key
    const recipientSignDoc = buildSignDoc({
      magic,
      version: 1,
      cipherSuite: 1,
      flags: flagsInt,
      recipientKeyId: parsedEnvelope.recipientFingerprint as Uint8Array,
      messageId: parsedEnvelope.messageId,
      ciphertext: parsedEnvelope.payload,
    });

    const isAliceSignatureValid = verifyDetached(
      recipientSignDoc,
      parsedEnvelope.signature as Uint8Array,
      aliceSigning.publicKey,
    );
    expect(isAliceSignatureValid).toBe(true);
  });

  it('rejects unauthorized decryption when wrong private key is used (Eve interception)', async () => {
    const bobEncryption = generateEncryptionKeyPair();
    const eveEncryption = generateEncryptionKeyPair();

    const plaintext = new TextEncoder().encode('Private message for Bob only.');
    const ciphertext = seal(plaintext, bobEncryption.publicKey);

    // Eve intercepts carrier and attempts decryption with Eve's private key
    expect(() => {
      openSeal(ciphertext, bobEncryption.publicKey, eveEncryption.privateKey);
    }).toThrow(DecryptionFailedError);
  });

  it('fails signature verification if sender public key does not match or payload is modified', async () => {
    const aliceSigning = generateSigningKeyPair();
    const mallorySigning = generateSigningKeyPair();
    const bobEncryption = generateEncryptionKeyPair();

    const ciphertext = seal(new TextEncoder().encode('Payload'), bobEncryption.publicKey);
    const magic = new Uint8Array([0x4f, 0x4d, 0x42, 0x31]);
    const bobKeyId = computeKeyId(bobEncryption.publicKey);
    const messageId = new Uint8Array(16).fill(0x01);

    const signDoc = buildSignDoc({
      magic,
      version: 1,
      cipherSuite: 1,
      flags: 0x0001,
      recipientKeyId: bobKeyId,
      messageId,
      ciphertext,
    });

    const signature = signDetached(signDoc, aliceSigning.privateKey);

    // Verification with Mallory's key must return false
    const validWithMallory = verifyDetached(signDoc, signature, mallorySigning.publicKey);
    expect(validWithMallory).toBe(false);

    // Verification of tampered doc with Alice's key must return false
    const tamperedCiphertext = new Uint8Array(ciphertext);
    tamperedCiphertext[0] ^= 0x01;
    const tamperedDoc = buildSignDoc({
      magic,
      version: 1,
      cipherSuite: 1,
      flags: 0x0001,
      recipientKeyId: bobKeyId,
      messageId,
      ciphertext: tamperedCiphertext,
    });

    const validWithTamperedDoc = verifyDetached(tamperedDoc, signature, aliceSigning.publicKey);
    expect(validWithTamperedDoc).toBe(false);
  });
});
