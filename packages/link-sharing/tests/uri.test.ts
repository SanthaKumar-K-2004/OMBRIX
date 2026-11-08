import { initCrypto } from '@ombrix/crypto-adapter';
import { beforeAll, describe, expect, it } from 'vitest';
import { createLinkContainer } from '../src/container.js';
import { InvalidLinkFormatError } from '../src/errors.js';
import {
  deserializeLinkUri,
  exportLinkBundle,
  importLinkBundle,
  serializeLinkUri,
} from '../src/uri.js';

describe('@ombrix/link-sharing - URI Serialization & Bundle Parsing', () => {
  beforeAll(async () => {
    await initCrypto();
  });

  const dummyCarrier = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2]);
  const dummyPayload = new TextEncoder().encode('Test Payload');

  it('serializes and deserializes link container via URL hash fragment', async () => {
    const container = await createLinkContainer({
      expiresInSeconds: 7200,
      carrierBytes: dummyCarrier,
      payloadBytes: dummyPayload,
      carrierName: 'avatar.png',
    });

    const uri = serializeLinkUri(container, 'https://ombrix.local/app');
    expect(uri).toContain('https://ombrix.local/app#link=');

    const recovered = deserializeLinkUri(uri);
    expect(recovered.magic).toBe('OMBRIX_LINK');
    expect(recovered.metadata.id).toBe(container.metadata.id);
    expect(recovered.metadata.carrierHash).toBe(container.metadata.carrierHash);
    expect(recovered.ciphertext).toBe(container.ciphertext);
  });

  it('exports and imports link bundle JSON string', async () => {
    const container = await createLinkContainer({
      expiresInSeconds: 3600,
      carrierBytes: dummyCarrier,
      payloadBytes: dummyPayload,
    });

    const json = exportLinkBundle(container);
    const parsed = importLinkBundle(json);

    expect(parsed.magic).toBe('OMBRIX_LINK');
    expect(parsed.metadata.carrierHash).toBe(container.metadata.carrierHash);
  });

  it('throws InvalidLinkFormatError on garbage URI', () => {
    expect(() => deserializeLinkUri('https://ombrix.local#link=invalid-base64-content!')).toThrow(
      InvalidLinkFormatError,
    );
    expect(() => deserializeLinkUri('https://ombrix.local/app')).toThrow(InvalidLinkFormatError);
  });
});
