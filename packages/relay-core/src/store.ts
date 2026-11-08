import { createOpaqueRelayEnvelope } from './envelope.js';
import { verifyCapabilityToken } from './token.js';
import type {
  CreateRelayEnvelopeOptions,
  OpaqueRelayEnvelope,
  RelayDepositResult,
  RelayRetrievalResult,
} from './types.js';

export class RelayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RelayError';
  }
}

export class RelayMessageNotFoundError extends RelayError {
  constructor(messageId: string) {
    super(`Relay message not found or already consumed: ${messageId}`);
    this.name = 'RelayMessageNotFoundError';
  }
}

export class RelayInvalidTokenError extends RelayError {
  constructor() {
    super('Invalid bearer capability token for relay message');
    this.name = 'RelayInvalidTokenError';
  }
}

export class RelayMessageExpiredError extends RelayError {
  constructor(messageId: string) {
    super(`Relay message has expired: ${messageId}`);
    this.name = 'RelayMessageExpiredError';
  }
}

export class LocalOpaqueRelayStore {
  private readonly store = new Map<string, OpaqueRelayEnvelope>();

  deposit(ciphertext: Uint8Array, options: CreateRelayEnvelopeOptions = {}): RelayDepositResult {
    const res = createOpaqueRelayEnvelope(ciphertext, options);
    this.store.set(res.envelope.messageId, res.envelope);
    return res;
  }

  depositEnvelope(envelope: OpaqueRelayEnvelope): void {
    this.store.set(envelope.messageId, envelope);
  }

  retrieve(messageId: string, bearerToken: string): RelayRetrievalResult {
    const envelope = this.store.get(messageId);
    if (!envelope) {
      throw new RelayMessageNotFoundError(messageId);
    }

    if (Date.now() > envelope.expiresAt) {
      this.store.delete(messageId);
      throw new RelayMessageExpiredError(messageId);
    }

    const isValidToken = verifyCapabilityToken(bearerToken, envelope.tokenHashHex);
    if (!isValidToken) {
      throw new RelayInvalidTokenError();
    }

    envelope.retrievalCount++;
    const remaining = Math.max(0, envelope.maxRetrievals - envelope.retrievalCount);

    if (envelope.retrievalCount >= envelope.maxRetrievals) {
      // Burn after maximum retrievals
      this.store.delete(messageId);
    }

    return {
      ciphertext: new Uint8Array(envelope.ciphertext),
      messageId: envelope.messageId,
      remainingRetrievals: remaining,
      expiresAt: envelope.expiresAt,
    };
  }

  purgeExpired(now: number = Date.now()): number {
    let purged = 0;
    for (const [id, env] of this.store.entries()) {
      if (now > env.expiresAt) {
        this.store.delete(id);
        purged++;
      }
    }
    return purged;
  }

  count(): number {
    this.purgeExpired();
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}
