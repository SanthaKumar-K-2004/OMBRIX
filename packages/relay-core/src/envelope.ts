import { toHex } from '@ombrix/crypto-adapter';
import { generateCapabilityToken, hashCapabilityToken } from './token.js';
import type {
  CreateRelayEnvelopeOptions,
  OpaqueRelayEnvelope,
  RelayDepositResult,
} from './types.js';

export const DEFAULT_RELAY_TTL_SECONDS = 3600; // 1 hour

export function createOpaqueRelayEnvelope(
  ciphertext: Uint8Array,
  options: CreateRelayEnvelopeOptions = {},
): RelayDepositResult {
  if (ciphertext.length === 0) {
    throw new Error('Cannot deposit empty ciphertext into relay');
  }

  const bearerToken = generateCapabilityToken();
  const tokenHashHex = hashCapabilityToken(bearerToken);

  const messageIdBytes = new Uint8Array(16);
  crypto.getRandomValues(messageIdBytes);
  const messageId = Array.from(messageIdBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const now = Date.now();
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_RELAY_TTL_SECONDS;
  const expiresAt = now + ttlSeconds * 1000;
  const maxRetrievals = Math.max(1, options.maxRetrievals ?? 1);

  const recipientKeyIdHex = options.recipientKeyId ? toHex(options.recipientKeyId) : undefined;

  const envelope: OpaqueRelayEnvelope = {
    version: 1,
    messageId,
    recipientKeyIdHex,
    tokenHashHex,
    ciphertext: new Uint8Array(ciphertext),
    createdAt: now,
    expiresAt,
    maxRetrievals,
    retrievalCount: 0,
  };

  return { envelope, bearerToken };
}
