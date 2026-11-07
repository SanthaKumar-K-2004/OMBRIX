import { crc32 } from './crc32.js';
import {
  HeaderChecksumMismatchError,
  InvalidMagicBytesError,
  MalformedEnvelopeError,
  PayloadLengthExceededError,
  TruncatedEnvelopeError,
  UnsupportedVersionError,
} from './errors.js';
import type {
  CryptoSuite,
  EnvelopeFlags,
  Omb1Envelope,
  ParseEnvelopeOptions,
  StegoMethodId,
} from './types.js';

export const OMB1_MAGIC = new Uint8Array([0x4f, 0x4d, 0x42, 0x31]); // "OMB1"
export const CURRENT_PROTOCOL_VERSION = 1;
export const MAX_PAYLOAD_BYTES = 16_777_216; // 16 MiB

const SUITE_TO_ID: Record<CryptoSuite, number> = {
  NONE: 0x00,
  X25519_XSALSA20_POLY1305: 0x01,
  HPKE_DRAFT: 0x02,
};

const ID_TO_SUITE: Record<number, CryptoSuite> = {
  0: 'NONE',
  1: 'X25519_XSALSA20_POLY1305',
  2: 'HPKE_DRAFT',
};

const METHOD_TO_ID: Record<StegoMethodId, number> = {
  PNG_LSB_SEQUENTIAL: 0x01,
  PNG_LSB_PRNG: 0x02,
};

const ID_TO_METHOD: Record<number, StegoMethodId> = {
  1: 'PNG_LSB_SEQUENTIAL',
  2: 'PNG_LSB_PRNG',
};

const FLAG_COMPRESSED = 0x01;
const FLAG_SIGNED = 0x02;
const FLAG_RECIPIENT_FINGERPRINT = 0x04;
const FLAG_IS_FILE = 0x08;
const RESERVED_FLAGS_MASK = 0xf0;

/**
 * Serializes an Omb1Envelope structure into a canonical byte array.
 */
export function serializeEnvelope(envelope: Omb1Envelope): Uint8Array {
  if (envelope.version !== 1) {
    throw new UnsupportedVersionError(
      `Unsupported protocol version: expected 1, got ${envelope.version}.`,
    );
  }

  if (envelope.messageId.length !== 16) {
    throw new MalformedEnvelopeError(
      `Message ID must be exactly 16 bytes, got ${envelope.messageId.length}.`,
    );
  }

  if (envelope.payload.length > MAX_PAYLOAD_BYTES) {
    throw new PayloadLengthExceededError(
      `Payload length (${envelope.payload.length} bytes) exceeds maximum limit (${MAX_PAYLOAD_BYTES} bytes).`,
    );
  }

  const hasRecipientFingerprint = Boolean(
    envelope.flags.hasRecipientFingerprint || envelope.recipientFingerprint,
  );
  if (hasRecipientFingerprint) {
    if (!envelope.recipientFingerprint || envelope.recipientFingerprint.length !== 8) {
      throw new MalformedEnvelopeError(
        'Recipient fingerprint flag is set, but fingerprint is missing or not 8 bytes.',
      );
    }
  }

  const isSigned = Boolean(envelope.flags.signed || envelope.signature);
  if (isSigned) {
    if (!envelope.signature || envelope.signature.length !== 64) {
      throw new MalformedEnvelopeError(
        'Signed flag is set, but signature is missing or not 64 bytes.',
      );
    }
  }

  let flagsByte = 0;
  if (envelope.flags.compressed) flagsByte |= FLAG_COMPRESSED;
  if (isSigned) flagsByte |= FLAG_SIGNED;
  if (hasRecipientFingerprint) flagsByte |= FLAG_RECIPIENT_FINGERPRINT;
  if (envelope.flags.isFile) flagsByte |= FLAG_IS_FILE;

  const headerBeforeCrcLength = 4 + 1 + 1 + 1 + 1 + 16 + (hasRecipientFingerprint ? 8 : 0) + 4;
  const headerTotalLength = headerBeforeCrcLength + 4; // plus 4 bytes CRC
  const signatureLength = isSigned ? 64 : 0;
  const totalLength = headerTotalLength + envelope.payload.length + signatureLength;

  const buffer = new Uint8Array(totalLength);
  const view = new DataView(buffer.buffer);

  // Magic
  buffer.set(OMB1_MAGIC, 0);

  // Version, Suite, Method, Flags
  buffer[4] = CURRENT_PROTOCOL_VERSION;
  buffer[5] = SUITE_TO_ID[envelope.cryptoSuite] ?? 0x00;
  buffer[6] = METHOD_TO_ID[envelope.stegoMethod] ?? 0x01;
  buffer[7] = flagsByte;

  // Message ID (16 bytes)
  buffer.set(envelope.messageId, 8);

  let offset = 24;

  // Recipient Fingerprint (8 bytes if present)
  if (hasRecipientFingerprint && envelope.recipientFingerprint) {
    buffer.set(envelope.recipientFingerprint, offset);
    offset += 8;
  }

  // Payload Length (4 bytes uint32 BE)
  view.setUint32(offset, envelope.payload.length, false);
  offset += 4;

  // Compute CRC32 over all header bytes so far [0 .. offset]
  const headerCrc = crc32(buffer, 0, offset);
  view.setUint32(offset, headerCrc, false);
  offset += 4;

  // Payload body
  buffer.set(envelope.payload, offset);
  offset += envelope.payload.length;

  // Signature (64 bytes if present)
  if (isSigned && envelope.signature) {
    buffer.set(envelope.signature, offset);
    offset += 64;
  }

  return buffer;
}

/**
 * Parses and verifies an OMB1 binary envelope from a byte buffer.
 */
export function parseEnvelope(buffer: Uint8Array, options?: ParseEnvelopeOptions): Omb1Envelope {
  const maxPayloadLength = options?.maxPayloadLength ?? MAX_PAYLOAD_BYTES;

  // Minimum header size: 4 magic + 1 ver + 1 suite + 1 method + 1 flag + 16 msgId + 4 len + 4 crc = 32 bytes
  if (buffer.length < 32) {
    throw new TruncatedEnvelopeError(
      `Buffer is too short (${buffer.length} bytes) to contain an OMB1 header (min 32 bytes).`,
    );
  }

  // Verify Magic bytes "OMB1"
  for (let i = 0; i < 4; i++) {
    if (buffer[i] !== OMB1_MAGIC[i]) {
      throw new InvalidMagicBytesError();
    }
  }

  const version = buffer[4]!;
  if (version !== 1) {
    throw new UnsupportedVersionError(
      `Unsupported protocol version: expected 1, found ${version}.`,
    );
  }

  const suiteId = buffer[5]!;
  const cryptoSuite = ID_TO_SUITE[suiteId];
  if (!cryptoSuite) {
    throw new MalformedEnvelopeError(`Unknown cryptographic suite ID: 0x${suiteId.toString(16)}.`);
  }

  const methodId = buffer[6]!;
  const stegoMethod = ID_TO_METHOD[methodId];
  if (!stegoMethod) {
    throw new MalformedEnvelopeError(`Unknown stego method ID: 0x${methodId.toString(16)}.`);
  }

  const flagsByte = buffer[7]!;
  if ((flagsByte & RESERVED_FLAGS_MASK) !== 0) {
    throw new MalformedEnvelopeError(
      `Reserved flag bits are set in flags byte: 0x${flagsByte.toString(16)}.`,
    );
  }

  const flags: EnvelopeFlags = {
    compressed: (flagsByte & FLAG_COMPRESSED) !== 0,
    signed: (flagsByte & FLAG_SIGNED) !== 0,
    hasRecipientFingerprint: (flagsByte & FLAG_RECIPIENT_FINGERPRINT) !== 0,
    isFile: (flagsByte & FLAG_IS_FILE) !== 0,
  };

  const messageId = buffer.slice(8, 24);
  let offset = 24;

  let recipientFingerprint: Uint8Array | undefined;
  if (flags.hasRecipientFingerprint) {
    if (buffer.length < offset + 8 + 4 + 4) {
      throw new TruncatedEnvelopeError('Truncated header: missing recipient fingerprint field.');
    }
    recipientFingerprint = buffer.slice(offset, offset + 8);
    offset += 8;
  }

  if (buffer.length < offset + 8) {
    throw new TruncatedEnvelopeError(
      'Truncated header: missing payload length and checksum fields.',
    );
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const payloadLength = view.getUint32(offset, false);
  offset += 4;

  if (payloadLength > maxPayloadLength) {
    throw new PayloadLengthExceededError(
      `Payload length (${payloadLength} bytes) exceeds maximum limit (${maxPayloadLength} bytes).`,
    );
  }

  // Validate Header CRC32
  const expectedCrc = view.getUint32(offset, false);
  const calculatedCrc = crc32(buffer, 0, offset);
  offset += 4;

  if (calculatedCrc !== expectedCrc) {
    throw new HeaderChecksumMismatchError(
      `Header CRC32 mismatch: expected 0x${expectedCrc.toString(16)}, calculated 0x${calculatedCrc.toString(16)}.`,
    );
  }

  const signatureLength = flags.signed ? 64 : 0;
  const totalRequiredLength = offset + payloadLength + signatureLength;

  if (buffer.length < totalRequiredLength) {
    throw new TruncatedEnvelopeError(
      `Envelope is truncated: expected ${totalRequiredLength} bytes, but buffer has ${buffer.length} bytes.`,
    );
  }

  const payload = buffer.slice(offset, offset + payloadLength);
  offset += payloadLength;

  let signature: Uint8Array | undefined;
  if (flags.signed) {
    signature = buffer.slice(offset, offset + 64);
    offset += 64;
  }

  return {
    version: 1,
    cryptoSuite,
    stegoMethod,
    flags,
    messageId,
    recipientFingerprint,
    payload,
    signature,
  };
}
