export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoError';
  }
}

export class DecryptionFailedError extends CryptoError {
  constructor(
    message = 'Decryption failed: recipient key mismatch, altered ciphertext, or invalid MAC.',
  ) {
    super(message);
    this.name = 'DecryptionFailedError';
  }
}

export class InvalidSignatureError extends CryptoError {
  constructor(message = 'Signature verification failed: sender key mismatch or payload altered.') {
    super(message);
    this.name = 'InvalidSignatureError';
  }
}

export class InvalidKeyError extends CryptoError {
  constructor(message = 'Invalid cryptographic key: key length or encoding incorrect.') {
    super(message);
    this.name = 'InvalidKeyError';
  }
}

export class VaultPassphraseError extends CryptoError {
  constructor(message = 'Vault decryption failed: incorrect passphrase or corrupted vault file.') {
    super(message);
    this.name = 'VaultPassphraseError';
  }
}

export class SodiumNotReadyError extends CryptoError {
  constructor(message = 'Libsodium has not finished initialization. Await initCrypto() first.') {
    super(message);
    this.name = 'SodiumNotReadyError';
  }
}
