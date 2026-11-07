import { describe, expect, it } from 'vitest';
import {
  HeaderChecksumMismatchError,
  InvalidMagicBytesError,
  MAX_PAYLOAD_BYTES,
  MalformedEnvelopeError,
  OMB1_MAGIC,
  PayloadLengthExceededError,
  TruncatedEnvelopeError,
  UnsupportedVersionError,
  crc32,
  parseEnvelope,
  serializeEnvelope,
} from '../src/index.js';
import type { Omb1Envelope } from '../src/types.js';

describe('payload-protocol package (OMB1)', () => {
  const sampleMessageId = new Uint8Array([
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
  ]);
  const samplePayload = new TextEncoder().encode('Confidential research payload for OMBRIX Core');

  it('performs exact round-trip serialization and parsing for minimal envelope', () => {
    const envelope: Omb1Envelope = {
      version: 1,
      cryptoSuite: 'NONE',
      stegoMethod: 'PNG_LSB_SEQUENTIAL',
      flags: {},
      messageId: sampleMessageId,
      payload: samplePayload,
    };

    const serialized = serializeEnvelope(envelope);
    expect(serialized.subarray(0, 4)).toEqual(OMB1_MAGIC);

    const parsed = parseEnvelope(serialized);
    expect(parsed.version).toBe(1);
    expect(parsed.cryptoSuite).toBe('NONE');
    expect(parsed.stegoMethod).toBe('PNG_LSB_SEQUENTIAL');
    expect(parsed.flags.compressed).toBe(false);
    expect(parsed.flags.signed).toBe(false);
    expect(parsed.flags.hasRecipientFingerprint).toBe(false);
    expect(parsed.messageId).toEqual(sampleMessageId);
    expect(parsed.payload).toEqual(samplePayload);
    expect(parsed.recipientFingerprint).toBeUndefined();
    expect(parsed.signature).toBeUndefined();
  });

  it('handles optional recipient fingerprint and signature fields correctly', () => {
    const fingerprint = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0x11, 0x22, 0x33, 0x44]);
    const signature = new Uint8Array(64).fill(0x7c);

    const envelope: Omb1Envelope = {
      version: 1,
      cryptoSuite: 'X25519_XSALSA20_POLY1305',
      stegoMethod: 'PNG_LSB_SEQUENTIAL',
      flags: {
        compressed: true,
        signed: true,
        hasRecipientFingerprint: true,
        isFile: true,
      },
      messageId: sampleMessageId,
      recipientFingerprint: fingerprint,
      payload: samplePayload,
      signature: signature,
    };

    const serialized = serializeEnvelope(envelope);
    const parsed = parseEnvelope(serialized);

    expect(parsed.cryptoSuite).toBe('X25519_XSALSA20_POLY1305');
    expect(parsed.flags.compressed).toBe(true);
    expect(parsed.flags.signed).toBe(true);
    expect(parsed.flags.hasRecipientFingerprint).toBe(true);
    expect(parsed.flags.isFile).toBe(true);
    expect(parsed.recipientFingerprint).toEqual(fingerprint);
    expect(parsed.signature).toEqual(signature);
    expect(parsed.payload).toEqual(samplePayload);
  });

  it('rejects invalid magic bytes', () => {
    const envelope: Omb1Envelope = {
      version: 1,
      cryptoSuite: 'NONE',
      stegoMethod: 'PNG_LSB_SEQUENTIAL',
      flags: {},
      messageId: sampleMessageId,
      payload: samplePayload,
    };

    const serialized = serializeEnvelope(envelope);
    serialized[0] = 0x58; // Change 'O' to 'X'
    expect(() => parseEnvelope(serialized)).toThrow(InvalidMagicBytesError);
  });

  it('rejects unsupported protocol version', () => {
    const envelope: Omb1Envelope = {
      version: 1,
      cryptoSuite: 'NONE',
      stegoMethod: 'PNG_LSB_SEQUENTIAL',
      flags: {},
      messageId: sampleMessageId,
      payload: samplePayload,
    };

    const serialized = serializeEnvelope(envelope);
    serialized[4] = 2; // version 2

    // Modifying byte 4 will trigger header CRC mismatch first, or version error if CRC recalculated
    // Test direct version mismatch with valid CRC:
    const view = new DataView(serialized.buffer);
    const crc = crc32(serialized, 0, serialized.length - samplePayload.length - 4);
    view.setUint32(serialized.length - samplePayload.length - 4, crc, false);

    expect(() => parseEnvelope(serialized)).toThrow(UnsupportedVersionError);
  });

  it('rejects tampered header with HeaderChecksumMismatchError', () => {
    const envelope: Omb1Envelope = {
      version: 1,
      cryptoSuite: 'NONE',
      stegoMethod: 'PNG_LSB_SEQUENTIAL',
      flags: {},
      messageId: sampleMessageId,
      payload: samplePayload,
    };

    const serialized = serializeEnvelope(envelope);
    // Tamper with message ID in header
    serialized[10] = serialized[10]! ^ 0xff;

    expect(() => parseEnvelope(serialized)).toThrow(HeaderChecksumMismatchError);
  });

  it('rejects truncated envelope buffers at various boundaries', () => {
    const envelope: Omb1Envelope = {
      version: 1,
      cryptoSuite: 'NONE',
      stegoMethod: 'PNG_LSB_SEQUENTIAL',
      flags: { signed: true },
      messageId: sampleMessageId,
      payload: samplePayload,
      signature: new Uint8Array(64).fill(0x55),
    };

    const serialized = serializeEnvelope(envelope);

    // Truncate before header end
    expect(() => parseEnvelope(serialized.subarray(0, 20))).toThrow(TruncatedEnvelopeError);

    // Truncate payload
    expect(() => parseEnvelope(serialized.subarray(0, serialized.length - 70))).toThrow(
      TruncatedEnvelopeError,
    );

    // Truncate signature
    expect(() => parseEnvelope(serialized.subarray(0, serialized.length - 20))).toThrow(
      TruncatedEnvelopeError,
    );
  });

  it('rejects payload exceeding maximum size limit', () => {
    const envelope: Omb1Envelope = {
      version: 1,
      cryptoSuite: 'NONE',
      stegoMethod: 'PNG_LSB_SEQUENTIAL',
      flags: {},
      messageId: sampleMessageId,
      payload: new Uint8Array(MAX_PAYLOAD_BYTES + 1),
    };

    expect(() => serializeEnvelope(envelope)).toThrow(PayloadLengthExceededError);

    const normal = serializeEnvelope({
      version: 1,
      cryptoSuite: 'NONE',
      stegoMethod: 'PNG_LSB_SEQUENTIAL',
      flags: {},
      messageId: sampleMessageId,
      payload: new Uint8Array(100),
    });

    expect(() => parseEnvelope(normal, { maxPayloadLength: 50 })).toThrow(
      PayloadLengthExceededError,
    );
  });

  it('rejects malformed envelope metadata during serialization', () => {
    expect(() =>
      serializeEnvelope({
        version: 1,
        cryptoSuite: 'NONE',
        stegoMethod: 'PNG_LSB_SEQUENTIAL',
        flags: {},
        messageId: new Uint8Array(10), // invalid length
        payload: samplePayload,
      }),
    ).toThrow(MalformedEnvelopeError);

    expect(() =>
      serializeEnvelope({
        version: 1,
        cryptoSuite: 'NONE',
        stegoMethod: 'PNG_LSB_SEQUENTIAL',
        flags: { signed: true },
        messageId: sampleMessageId,
        payload: samplePayload,
        signature: new Uint8Array(32), // invalid signature length
      }),
    ).toThrow(MalformedEnvelopeError);
  });
});
