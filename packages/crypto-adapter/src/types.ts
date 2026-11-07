export interface KeyPair {
  readonly publicKey: Uint8Array;
  readonly privateKey: Uint8Array;
}

export type EncryptionKeyPair = KeyPair;
export type SigningKeyPair = KeyPair;

export interface VaultKdfParams {
  readonly algorithm: 'argon2id';
  readonly opsLimit: number;
  readonly memLimit: number;
  readonly salt: string; // base64
}

export interface VaultBundle {
  readonly magic: 'OMBRIX_VAULT_BACKUP';
  readonly version: 1;
  readonly createdAt: number;
  readonly kdf: VaultKdfParams;
  readonly cipher: {
    readonly algorithm: 'xchacha20poly1305';
    readonly nonce: string; // base64
    readonly ciphertext: string; // base64
  };
}

export interface ContactEntry {
  readonly id: string;
  readonly name: string;
  readonly encPublicKey: string; // base64
  readonly signPublicKey?: string; // base64
  readonly fingerprint: string;
  readonly isVerified: boolean;
  readonly createdAt: number;
}

export interface VaultIdentityData {
  readonly version: 1;
  readonly id: string;
  readonly name: string;
  readonly encryptionKeyPair: {
    readonly publicKey: string; // base64
    readonly privateKey: string; // base64
  };
  readonly signingKeyPair: {
    readonly publicKey: string; // base64
    readonly privateKey: string; // base64
  };
  readonly fingerprint: string;
  readonly contacts: ContactEntry[];
  readonly createdAt: number;
}
