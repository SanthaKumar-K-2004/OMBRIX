import {
  type BatchEmbedItemResult,
  type BatchEmbedTask,
  type BatchExecutionOptions,
  type BatchExtractItemResult,
  type BatchExtractTask,
  executeBatchEmbed,
  executeBatchExtract,
  auditBatchCarriers as runBatchAudit,
  reassembleChunkedPayload as runReassemble,
  splitPayloadAcrossCarriers as runSplit,
} from '@ombrix/batch-pipeline';
import {
  type BitplaneResult,
  type ImageHistogram,
  computeHistogram,
  extractBitplane,
} from '@ombrix/carrier-lens';
import {
  buildSignDoc,
  computeFingerprint,
  computeKeyId,
  fromBase64,
  initCrypto,
  openSeal,
  seal,
  signDetached,
  verifyDetached,
} from '@ombrix/crypto-adapter';
import {
  type CreateLinkOptions,
  type LinkContainer,
  type OpenLinkOptions,
  type OpenedLink,
  createLinkContainer,
  deserializeLinkUri,
  openLinkContainer,
  serializeLinkUri,
} from '@ombrix/link-sharing';
import { type Omb1Envelope, parseEnvelope, serializeEnvelope } from '@ombrix/payload-protocol';
import type { CarrierImage } from '@ombrix/stego-interface';
import { type StegoBenchmarkResult, pngLsbMatching, runStegoBenchmark } from '@ombrix/stego-lab';
import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import {
  type ChiSquareReport,
  type TransitOptions,
  type TransitSimulationResult,
  type TransitTransformType,
  analyzeChiSquare,
  runTransitSimulation,
} from '@ombrix/transit-trace';
import type { OmbrixEmbedOptions, OmbrixExtractOptions, OmbrixExtractResult } from './types.js';

/** Initialize libsodium and cryptographic runtime */
export async function init(): Promise<void> {
  await initCrypto();
}

/**
 * Embed plaintext or encrypted payload into a carrier image
 */
export async function embed(
  carrier: CarrierImage,
  payload: string | Uint8Array,
  options?: OmbrixEmbedOptions,
): Promise<CarrierImage> {
  await init();

  const rawBytes = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;

  let ciphertext = rawBytes;
  let cryptoSuite: 'NONE' | 'X25519_XSALSA20_POLY1305' = 'NONE';
  let recipientKeyId: Uint8Array | undefined;

  if (options?.recipientPublicKey) {
    const pubKey = fromBase64(options.recipientPublicKey);
    ciphertext = seal(rawBytes, pubKey);
    cryptoSuite = 'X25519_XSALSA20_POLY1305';
    recipientKeyId = computeKeyId(pubKey);
  }

  const messageId = new Uint8Array(16);
  crypto.getRandomValues(messageId);

  let signature: Uint8Array | undefined;
  if (options?.signingPrivateKey) {
    const privKey = fromBase64(options.signingPrivateKey);
    const magic = new Uint8Array([0x4f, 0x4d, 0x42, 0x31]);
    const flagsInt = 0x0001; // signed bit

    const signDoc = buildSignDoc({
      magic,
      version: 1,
      cipherSuite: cryptoSuite === 'NONE' ? 0 : 1,
      flags: flagsInt,
      recipientKeyId: recipientKeyId ?? new Uint8Array(8),
      messageId,
      ciphertext,
    });

    signature = signDetached(signDoc, privKey);
  }

  const envelope: Omb1Envelope = {
    version: 1,
    cryptoSuite,
    stegoMethod: 'PNG_LSB_SEQUENTIAL',
    flags: {
      signed: Boolean(signature),
      hasRecipientFingerprint: Boolean(recipientKeyId),
      compressed: options?.compressed ?? false,
    },
    messageId,
    recipientFingerprint: recipientKeyId,
    payload: ciphertext,
    signature,
  };

  const envelopeBytes = serializeEnvelope(envelope);
  return await pngLsbSequential.embed(carrier, envelopeBytes);
}

/**
 * Extract payload from a stego carrier image and verify authentication
 */
export async function extract(
  stegoCarrier: CarrierImage,
  options?: OmbrixExtractOptions,
): Promise<OmbrixExtractResult> {
  await init();

  const envelopeBytes = await pngLsbSequential.extract(stegoCarrier);
  const envelope = parseEnvelope(envelopeBytes);

  let payload = envelope.payload;
  const isEncrypted = envelope.cryptoSuite !== 'NONE';

  if (isEncrypted) {
    if (!options?.recipientPublicKey || !options?.recipientPrivateKey) {
      throw new Error(
        'Payload is encrypted with sealed box. Recipient public and private keys required.',
      );
    }
    const pubKey = fromBase64(options.recipientPublicKey);
    const privKey = fromBase64(options.recipientPrivateKey);
    payload = openSeal(envelope.payload, pubKey, privKey);
  }

  let signatureVerified: boolean | undefined;
  let senderFingerprint: string | undefined;

  if (envelope.flags.signed && envelope.signature && options?.senderSigningPublicKey) {
    const signPubKey = fromBase64(options.senderSigningPublicKey);
    senderFingerprint = computeFingerprint(signPubKey);

    const magic = new Uint8Array([0x4f, 0x4d, 0x42, 0x31]);
    const cipherSuiteInt = envelope.cryptoSuite === 'NONE' ? 0 : 1;
    const flagsInt = 0x0001;

    const signDoc = buildSignDoc({
      magic,
      version: envelope.version,
      cipherSuite: cipherSuiteInt,
      flags: flagsInt,
      recipientKeyId: envelope.recipientFingerprint ?? new Uint8Array(8),
      messageId: envelope.messageId,
      ciphertext: envelope.payload,
    });

    signatureVerified = verifyDetached(signDoc, envelope.signature, signPubKey);
  }

  let text: string | undefined;
  try {
    text = new TextDecoder().decode(payload);
  } catch {
    // Binary payload
  }

  return {
    payload,
    text,
    isEncrypted,
    isSigned: Boolean(envelope.flags.signed),
    signatureVerified,
    senderFingerprint,
  };
}

/** Inspect visual characteristics, bitplanes, and histograms */
export function inspect(carrier: CarrierImage): {
  bitplanes: {
    red: BitplaneResult;
    green: BitplaneResult;
    blue: BitplaneResult;
  };
  histogram: ImageHistogram;
} {
  return {
    bitplanes: {
      red: extractBitplane(carrier, { channel: 'r', bitIndex: 0 }),
      green: extractBitplane(carrier, { channel: 'g', bitIndex: 0 }),
      blue: extractBitplane(carrier, { channel: 'b', bitIndex: 0 }),
    },
    histogram: computeHistogram(carrier),
  };
}

/** Run laboratory comparison of Sequential LSB vs LSB Matching */
export async function benchmark(
  carrier: CarrierImage,
  samplePayload: Uint8Array,
): Promise<StegoBenchmarkResult[]> {
  return await runStegoBenchmark(carrier, samplePayload, [pngLsbSequential, pngLsbMatching]);
}

/** Simulate channel noise, lossy compression, and resizing */
export async function simulateTransit(
  carrier: CarrierImage,
  transformType: TransitTransformType,
  options: TransitOptions = {},
): Promise<TransitSimulationResult> {
  return await runTransitSimulation(carrier, pngLsbSequential, transformType, options);
}

/** Detect spatial LSB steganographic anomalies via Chi-Square test */
export function detectStego(carrier: CarrierImage): ChiSquareReport {
  return analyzeChiSquare(carrier);
}

/** Create ephemeral self-verifying sharing container */
export async function createShareLink(options: CreateLinkOptions): Promise<{
  container: LinkContainer;
  uri: string;
}> {
  const container = await createLinkContainer(options);
  const uri = serializeLinkUri(container);
  return { container, uri };
}

/** Open ephemeral sharing container and verify BLAKE2b carrier integrity */
export async function openShareLink(
  uriOrContainer: string | LinkContainer,
  options?: OpenLinkOptions,
): Promise<OpenedLink> {
  const container =
    typeof uriOrContainer === 'string' ? deserializeLinkUri(uriOrContainer) : uriOrContainer;
  return await openLinkContainer(container, options);
}

/** Run concurrent batch embedding across multiple carriers */
export async function runBatchEmbed(
  tasks: readonly BatchEmbedTask[],
  options?: BatchExecutionOptions,
): Promise<BatchEmbedItemResult[]> {
  return await executeBatchEmbed(tasks, options);
}

/** Run concurrent batch extraction across multiple carriers */
export async function runBatchExtract(
  tasks: readonly BatchExtractTask[],
  options?: BatchExecutionOptions,
): Promise<BatchExtractItemResult[]> {
  return await executeBatchExtract(tasks, options);
}

export const Ombrix = {
  init,
  embed,
  extract,
  inspect,
  benchmark,
  simulateTransit,
  detectStego,
  createShareLink,
  openShareLink,
  auditBatchCarriers: runBatchAudit,
  splitPayloadAcrossCarriers: runSplit,
  reassembleChunkedPayload: runReassemble,
  runBatchEmbed,
  runBatchExtract,
};
