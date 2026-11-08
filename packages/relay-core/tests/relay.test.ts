import { initCrypto } from '@ombrix/crypto-adapter';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  LocalOpaqueRelayStore,
  RelayInvalidTokenError,
  RelayMessageExpiredError,
  RelayMessageNotFoundError,
  createOpaqueRelayEnvelope,
  generateCapabilityToken,
  hashCapabilityToken,
  verifyCapabilityToken,
} from '../src/index.js';

describe('@ombrix/relay-core - Zero-Knowledge Opaque Transport Protocol', () => {
  beforeAll(async () => {
    await initCrypto();
  });

  describe('Capability Bearer Tokens', () => {
    it('generates high-entropy bearer token and verifies its hash', () => {
      const token = generateCapabilityToken();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(30);

      const hash = hashCapabilityToken(token);
      expect(hash.length).toBe(64); // 32 bytes in hex

      expect(verifyCapabilityToken(token, hash)).toBe(true);
      expect(verifyCapabilityToken('corrupt-token', hash)).toBe(false);
    });
  });

  describe('Opaque Relay Envelope', () => {
    it('creates envelope encapsulating ciphertext and blind capability token', () => {
      const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const res = createOpaqueRelayEnvelope(payload, { ttlSeconds: 600 });

      expect(res.envelope.version).toBe(1);
      expect(res.envelope.messageId.length).toBe(32);
      expect(res.envelope.ciphertext).toEqual(payload);
      expect(res.envelope.tokenHashHex).toBe(hashCapabilityToken(res.bearerToken));
      expect(res.envelope.expiresAt).toBeGreaterThan(Date.now());
    });

    it('rejects empty ciphertext', () => {
      expect(() => createOpaqueRelayEnvelope(new Uint8Array(0))).toThrow(
        /Cannot deposit empty ciphertext/,
      );
    });
  });

  describe('Local Opaque Relay Store', () => {
    it('deposits and retrieves message with valid bearer token', () => {
      const store = new LocalOpaqueRelayStore();
      const secretCiphertext = new Uint8Array([0xca, 0xfe, 0xba, 0xbe]);

      const deposit = store.deposit(secretCiphertext);
      expect(store.count()).toBe(1);

      const retrieved = store.retrieve(deposit.envelope.messageId, deposit.bearerToken);
      expect(retrieved.ciphertext).toEqual(secretCiphertext);
      expect(retrieved.remainingRetrievals).toBe(0);

      // Single-use burn: envelope should now be purged
      expect(() => store.retrieve(deposit.envelope.messageId, deposit.bearerToken)).toThrow(
        RelayMessageNotFoundError,
      );
      expect(store.count()).toBe(0);
    });

    it('rejects retrieval with invalid bearer capability token', () => {
      const store = new LocalOpaqueRelayStore();
      const deposit = store.deposit(new Uint8Array([10, 20, 30]));

      expect(() => store.retrieve(deposit.envelope.messageId, 'wrong-token')).toThrow(
        RelayInvalidTokenError,
      );
      expect(store.count()).toBe(1); // Not consumed on failed auth
    });

    it('enforces multi-retrieval bounds before burning', () => {
      const store = new LocalOpaqueRelayStore();
      const deposit = store.deposit(new Uint8Array([1, 2, 3]), { maxRetrievals: 2 });

      // First retrieval
      const r1 = store.retrieve(deposit.envelope.messageId, deposit.bearerToken);
      expect(r1.remainingRetrievals).toBe(1);
      expect(store.count()).toBe(1);

      // Second retrieval (hits limit)
      const r2 = store.retrieve(deposit.envelope.messageId, deposit.bearerToken);
      expect(r2.remainingRetrievals).toBe(0);
      expect(store.count()).toBe(0);

      // Third retrieval fails
      expect(() => store.retrieve(deposit.envelope.messageId, deposit.bearerToken)).toThrow(
        RelayMessageNotFoundError,
      );
    });

    it('purges and rejects expired envelopes', () => {
      const store = new LocalOpaqueRelayStore();
      const deposit = store.deposit(new Uint8Array([99, 100]), { ttlSeconds: -10 }); // already expired

      expect(() => store.retrieve(deposit.envelope.messageId, deposit.bearerToken)).toThrow(
        RelayMessageExpiredError,
      );
      expect(store.count()).toBe(0);
    });
  });
});
