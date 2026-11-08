export class LinkSharingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinkSharingError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LinkExpiredError extends LinkSharingError {
  readonly expiresAt: number;
  readonly attemptedAt: number;

  constructor(expiresAt: number, attemptedAt: number) {
    const expireDate = new Date(expiresAt).toISOString();
    super(
      `OMBRIX Link has expired at ${expireDate}. Client-side TTL policy strictly prohibits opening.`,
    );
    this.name = 'LinkExpiredError';
    this.expiresAt = expiresAt;
    this.attemptedAt = attemptedAt;
  }
}

export class CarrierTamperedError extends LinkSharingError {
  readonly expectedHash: string;
  readonly actualHash: string;

  constructor(expectedHash: string, actualHash: string) {
    super(
      `Carrier integrity hash ring verification failed. Expected BLAKE2b hash ${expectedHash}, but computed ${actualHash}. The carrier image was altered, compressed, or corrupted.`,
    );
    this.name = 'CarrierTamperedError';
    this.expectedHash = expectedHash;
    this.actualHash = actualHash;
  }
}

export class LinkPassphraseRequiredError extends LinkSharingError {
  constructor() {
    super('This OMBRIX Link is encrypted with a passphrase. A passphrase must be provided.');
    this.name = 'LinkPassphraseRequiredError';
  }
}

export class LinkPassphraseInvalidError extends LinkSharingError {
  constructor() {
    super('Invalid link passphrase. Argon2id key derivation and secretbox authentication failed.');
    this.name = 'LinkPassphraseInvalidError';
  }
}

export class InvalidLinkFormatError extends LinkSharingError {
  constructor(reason: string) {
    super(`Malformed or invalid OMBRIX Link format: ${reason}`);
    this.name = 'InvalidLinkFormatError';
  }
}
