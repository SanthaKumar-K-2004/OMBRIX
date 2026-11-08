export interface LinkMetadata {
  readonly id: string;
  readonly version: 1;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly carrierHash: string;
  readonly carrierName?: string;
  readonly hasPassphrase: boolean;
  readonly burnAfterReading?: boolean;
  readonly senderFingerprint?: string;
}

export interface LinkContainer {
  readonly magic: 'OMBRIX_LINK';
  readonly version: 1;
  readonly metadata: LinkMetadata;
  readonly salt?: string;
  readonly nonce?: string;
  readonly ciphertext: string;
}

export interface CreateLinkOptions {
  readonly expiresInSeconds: number;
  readonly carrierBytes: Uint8Array;
  readonly payloadBytes: Uint8Array;
  readonly carrierName?: string;
  readonly passphrase?: string;
  readonly burnAfterReading?: boolean;
  readonly senderFingerprint?: string;
  readonly opsLimit?: number;
  readonly memLimit?: number;
}

export interface OpenLinkOptions {
  readonly passphrase?: string;
  readonly carrierBytes?: Uint8Array;
  readonly currentTimeMs?: number;
}

export interface OpenedLink {
  readonly metadata: LinkMetadata;
  readonly payloadBytes: Uint8Array;
  readonly isExpired: boolean;
  readonly carrierVerified: boolean;
}
