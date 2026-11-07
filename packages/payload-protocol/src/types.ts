export type CryptoSuite = 'NONE' | 'X25519_XSALSA20_POLY1305' | 'HPKE_DRAFT';

export type StegoMethodId = 'PNG_LSB_SEQUENTIAL' | 'PNG_LSB_PRNG';

export interface EnvelopeFlags {
  compressed?: boolean;
  signed?: boolean;
  hasRecipientFingerprint?: boolean;
  isFile?: boolean;
}

export interface Omb1Envelope {
  version: 1;
  cryptoSuite: CryptoSuite;
  stegoMethod: StegoMethodId;
  flags: EnvelopeFlags;
  messageId: Uint8Array; // 16 bytes
  recipientFingerprint?: Uint8Array; // 8 bytes if flag set
  payload: Uint8Array;
  signature?: Uint8Array; // 64 bytes if signed flag set
}

export interface ParseEnvelopeOptions {
  maxPayloadLength?: number;
}
