export interface OpaqueRelayEnvelope {
  readonly version: 1;
  readonly messageId: string;
  readonly recipientKeyIdHex?: string;
  readonly tokenHashHex: string;
  readonly ciphertext: Uint8Array;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly maxRetrievals: number;
  retrievalCount: number;
}

export interface CreateRelayEnvelopeOptions {
  ttlSeconds?: number;
  maxRetrievals?: number;
  recipientKeyId?: Uint8Array;
}

export interface RelayDepositResult {
  envelope: OpaqueRelayEnvelope;
  bearerToken: string;
}

export interface RelayRetrievalResult {
  ciphertext: Uint8Array;
  messageId: string;
  remainingRetrievals: number;
  expiresAt: number;
}
