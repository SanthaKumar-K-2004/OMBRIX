import {
  type ContactEntry,
  type VaultIdentityData,
  computeFingerprint,
  generateEncryptionKeyPair,
  generateSigningKeyPair,
  initCrypto,
  toBase64,
} from '@ombrix/crypto-adapter';

const IDENTITY_SESSION_KEY = 'ombrix_active_session_identity';
const CONTACTS_STORAGE_KEY = 'ombrix_vault_contacts';

let inMemoryIdentity: VaultIdentityData | null = null;

export function getActiveIdentity(): VaultIdentityData | null {
  if (inMemoryIdentity) return inMemoryIdentity;
  try {
    const raw = sessionStorage.getItem(IDENTITY_SESSION_KEY);
    if (raw) {
      inMemoryIdentity = JSON.parse(raw);
      return inMemoryIdentity;
    }
  } catch (_e) {
    // sessionStorage unavailable or restricted
  }
  return null;
}

export function setActiveIdentity(identity: VaultIdentityData): void {
  inMemoryIdentity = identity;
  try {
    sessionStorage.setItem(IDENTITY_SESSION_KEY, JSON.stringify(identity));
  } catch (_e) {
    // sessionStorage unavailable
  }
}

export async function ensureActiveIdentity(): Promise<VaultIdentityData> {
  const existing = getActiveIdentity();
  if (existing) return existing;

  await initCrypto();
  const encPair = generateEncryptionKeyPair();
  const signPair = generateSigningKeyPair();

  const identity: VaultIdentityData = {
    version: 1,
    id: `identity_${Date.now()}`,
    name: 'My OMBRIX Identity',
    encryptionKeyPair: {
      publicKey: toBase64(encPair.publicKey),
      privateKey: toBase64(encPair.privateKey),
    },
    signingKeyPair: {
      publicKey: toBase64(signPair.publicKey),
      privateKey: toBase64(signPair.privateKey),
    },
    fingerprint: computeFingerprint(encPair.publicKey),
    contacts: getSavedContacts(),
    createdAt: Date.now(),
  };

  setActiveIdentity(identity);
  return identity;
}

export function getSavedContacts(): ContactEntry[] {
  try {
    const raw = localStorage.getItem(CONTACTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
