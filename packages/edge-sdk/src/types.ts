export type {
  PngValidationResult,
  PngValidationLimits,
  PngChunkInfo,
  PngMetadata,
} from '@ombrix/image-validation';
export {
  validatePng,
  validatePngSafe,
  isPng,
  PNG_SIGNATURE,
} from '@ombrix/image-validation';

export * from '@ombrix/payload-protocol';
export * from '@ombrix/stego-interface';
export * from '@ombrix/crypto-adapter';
export * from '@ombrix/carrier-lens';
export * from '@ombrix/stego-lab';
export * from '@ombrix/transit-trace';
export * from '@ombrix/link-sharing';
export * from '@ombrix/batch-pipeline';

export interface OmbrixEmbedOptions {
  readonly recipientPublicKey?: string;
  readonly signingPrivateKey?: string;
  readonly compressed?: boolean;
}

export interface OmbrixExtractOptions {
  readonly recipientPublicKey?: string;
  readonly recipientPrivateKey?: string;
  readonly senderSigningPublicKey?: string;
}

export interface OmbrixExtractResult {
  readonly payload: Uint8Array;
  readonly text?: string;
  readonly isEncrypted: boolean;
  readonly isSigned: boolean;
  readonly signatureVerified?: boolean;
  readonly senderFingerprint?: string;
}
