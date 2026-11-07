import {
  type ContactEntry,
  type VaultBundle,
  type VaultIdentityData,
  computeFingerprint,
  decryptVaultData,
  encryptVaultData,
  fromBase64,
  generateEncryptionKeyPair,
  generateSigningKeyPair,
  initCrypto,
  toBase64,
} from '@ombrix/crypto-adapter';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ensureActiveIdentity, setActiveIdentity } from '../security/sessionIdentity.js';

const STORAGE_KEY = 'ombrix_vault_contacts';

export const VaultStudio: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);

  // Active Identity State (Stored in session memory)
  const [identityName, setIdentityName] = useState('My OMBRIX Identity');
  const [encPublicKey, setEncPublicKey] = useState('');
  const [encPrivateKey, setEncPrivateKey] = useState('');
  const [signPublicKey, setSignPublicKey] = useState('');
  const [signPrivateKey, setSignPrivateKey] = useState('');
  const [fingerprint, setFingerprint] = useState('');

  // Contacts / Address Book State
  const [contacts, setContacts] = useState<ContactEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // UI Dialog / Form States
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [vaultMessage, setVaultMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  // New Contact Form
  const [newContactName, setNewContactName] = useState('');
  const [newContactKey, setNewContactKey] = useState('');
  const [contactError, setContactError] = useState<string | null>(null);

  // Initialize Libsodium and Generate Initial Session Keypair if empty
  const generateNewIdentity = useCallback(
    (name = 'My OMBRIX Identity') => {
      const encPair = generateEncryptionKeyPair();
      const signPair = generateSigningKeyPair();

      const encPkB64 = toBase64(encPair.publicKey);
      const encSkB64 = toBase64(encPair.privateKey);
      const signPkB64 = toBase64(signPair.publicKey);
      const signSkB64 = toBase64(signPair.privateKey);
      const fp = computeFingerprint(encPair.publicKey);

      setIdentityName(name);
      setEncPublicKey(encPkB64);
      setEncPrivateKey(encSkB64);
      setSignPublicKey(signPkB64);
      setSignPrivateKey(signSkB64);
      setFingerprint(fp);

      const newId: VaultIdentityData = {
        version: 1,
        id: `identity_${Date.now()}`,
        name,
        encryptionKeyPair: { publicKey: encPkB64, privateKey: encSkB64 },
        signingKeyPair: { publicKey: signPkB64, privateKey: signSkB64 },
        fingerprint: fp,
        contacts: contacts || [],
        createdAt: Date.now(),
      };
      setActiveIdentity(newId);

      setVaultMessage({
        text: 'New ephemeral keypairs generated for active session.',
        type: 'success',
      });
    },
    [contacts],
  );

  useEffect(() => {
    async function init() {
      try {
        await initCrypto();
        const active = await ensureActiveIdentity();
        setIdentityName(active.name);
        setEncPublicKey(active.encryptionKeyPair.publicKey);
        setEncPrivateKey(active.encryptionKeyPair.privateKey);
        setSignPublicKey(active.signingKeyPair.publicKey);
        setSignPrivateKey(active.signingKeyPair.privateKey);
        setFingerprint(active.fingerprint);
      } catch (err) {
        console.error('Failed to initialize crypto adapter:', err);
      } finally {
        setIsInitializing(false);
      }
    }
    init();
  }, []);

  // Persist contacts to localStorage (only public keys and trust records)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
    } catch (e) {
      console.warn('Failed to persist contacts in localStorage:', e);
    }
  }, [contacts]);

  // Copy to clipboard helper
  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  // Add Contact Handler
  const handleAddContact = useCallback(() => {
    setContactError(null);
    if (!newContactName.trim()) {
      setContactError('Please enter a contact name.');
      return;
    }
    const cleanKey = newContactKey.trim();
    if (!cleanKey) {
      setContactError('Please enter the contact Curve25519 public key.');
      return;
    }

    try {
      const rawKey = fromBase64(cleanKey);
      if (rawKey.length !== 32) {
        setContactError(`Invalid public key length: expected 32 bytes, received ${rawKey.length}`);
        return;
      }
      const contactFp = computeFingerprint(rawKey);

      const newEntry: ContactEntry = {
        id: `contact_${Date.now()}`,
        name: newContactName.trim(),
        encPublicKey: cleanKey,
        fingerprint: contactFp,
        isVerified: false, // Default to unverified for safety
        createdAt: Date.now(),
      };

      setContacts((prev) => [...prev, newEntry]);
      setNewContactName('');
      setNewContactKey('');
      setVaultMessage({
        text: `Contact "${newEntry.name}" added. Please verify fingerprint out-of-band.`,
        type: 'success',
      });
    } catch {
      setContactError('Failed to parse public key. Please provide a valid Base64 string.');
    }
  }, [newContactName, newContactKey]);

  // Toggle Contact Verified Status
  const toggleContactVerified = useCallback((contactId: string) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, isVerified: !c.isVerified } : c)),
    );
  }, []);

  // Delete Contact
  const deleteContact = useCallback((contactId: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
  }, []);

  // Export Encrypted Vault Backup (.ombrix-vault)
  const handleExportVault = useCallback(async () => {
    if (!backupPassphrase || backupPassphrase.length < 8) {
      setVaultMessage({
        text: 'Passphrase must be at least 8 characters for Argon2id key derivation.',
        type: 'error',
      });
      return;
    }

    setIsExporting(true);
    setVaultMessage(null);

    try {
      const vaultData: VaultIdentityData = {
        version: 1,
        id: `vault_${Date.now()}`,
        name: identityName,
        encryptionKeyPair: {
          publicKey: encPublicKey,
          privateKey: encPrivateKey,
        },
        signingKeyPair: {
          publicKey: signPublicKey,
          privateKey: signPrivateKey,
        },
        fingerprint,
        contacts,
        createdAt: Date.now(),
      };

      // Encrypt with Argon2id interactive profile
      const bundle = encryptVaultData(vaultData, backupPassphrase);

      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ombrix-vault-backup-${Date.now()}.ombrix-vault`;
      a.click();
      URL.revokeObjectURL(url);

      setBackupPassphrase('');
      setVaultMessage({
        text: 'Encrypted vault backup successfully exported.',
        type: 'success',
      });
    } catch (err) {
      setVaultMessage({
        text: `Export failed: ${err instanceof Error ? err.message : String(err)}`,
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  }, [
    backupPassphrase,
    identityName,
    encPublicKey,
    encPrivateKey,
    signPublicKey,
    signPrivateKey,
    fingerprint,
    contacts,
  ]);

  // Import Encrypted Vault Backup (.ombrix-vault)
  const handleImportVault = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!restorePassphrase) {
        setVaultMessage({
          text: 'Please enter your vault passphrase before selecting the backup file.',
          type: 'error',
        });
        e.target.value = '';
        return;
      }

      setIsRestoring(true);
      setVaultMessage(null);

      try {
        const text = await file.text();
        const bundle = JSON.parse(text) as VaultBundle;

        const restored = decryptVaultData(bundle, restorePassphrase);

        setIdentityName(restored.name);
        setEncPublicKey(restored.encryptionKeyPair.publicKey);
        setEncPrivateKey(restored.encryptionKeyPair.privateKey);
        setSignPublicKey(restored.signingKeyPair.publicKey);
        setSignPrivateKey(restored.signingKeyPair.privateKey);
        setFingerprint(restored.fingerprint);
        setContacts(restored.contacts || []);

        setRestorePassphrase('');
        setVaultMessage({
          text: `Vault successfully restored! Active identity: ${restored.name}`,
          type: 'success',
        });
      } catch (err) {
        setVaultMessage({
          text: `Restoration failed: ${err instanceof Error ? err.message : 'Invalid passphrase or corrupt file.'}`,
          type: 'error',
        });
      } finally {
        setIsRestoring(false);
        e.target.value = '';
      }
    },
    [restorePassphrase],
  );

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center p-12 text-[#94A3B8]">
        <RefreshCw className="w-5 h-5 animate-spin mr-3 text-[#A855F7]" />
        <span>Initializing audited Libsodium cryptographic engine...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#7C3AED]/20 border border-[#7C3AED]/40 flex items-center justify-center text-[#A855F7]">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-['Sora'] text-white flex items-center gap-2">
              <span>OMBRIX Vault</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#14B8A6]/20 text-[#14B8A6] font-mono font-normal border border-[#14B8A6]/30">
                Phase 3 Active
              </span>
            </h1>
            <p className="text-xs text-[#94A3B8]">
              Client-side identity management, audited Libsodium sealed boxes, and Argon2id
              encrypted backups.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => generateNewIdentity()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-xs font-semibold text-[#E2E8F0] border border-[#334155] transition"
        >
          <RefreshCw className="w-4 h-4 text-[#A855F7]" />
          <span>Regenerate Identity</span>
        </button>
      </div>

      {/* Global Status Message */}
      {vaultMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center gap-3 border ${
            vaultMessage.type === 'success'
              ? 'bg-[#14B8A6]/10 border-[#14B8A6]/30 text-[#14B8A6]'
              : 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'
          }`}
        >
          {vaultMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          <span>{vaultMessage.text}</span>
        </div>
      )}

      {/* Grid: Active Identity & Encrypted Backup */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Identity Card (2 Cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-6">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-5 h-5 text-[#3B82F6]" />
              <h2 className="text-sm font-semibold font-['Sora'] text-white">
                Active Cryptographic Identity
              </h2>
            </div>
            <span className="text-[11px] text-[#94A3B8] font-mono">Curve25519 & Ed25519</span>
          </div>

          {/* Fingerprint Display */}
          <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#A855F7] tracking-wider uppercase">
                Public Key Fingerprint (BLAKE2b)
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(fingerprint, 'fp')}
                className="text-[11px] text-[#3B82F6] hover:underline flex items-center gap-1"
              >
                {copiedKey === 'fp' ? (
                  <Check className="w-3.5 h-3.5 text-[#14B8A6]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedKey === 'fp' ? 'Copied' : 'Copy Fingerprint'}</span>
              </button>
            </div>
            <div className="font-mono text-sm tracking-widest text-[#14B8A6] font-bold bg-[#111827] p-2.5 rounded-lg border border-[#1E293B]">
              {fingerprint}
            </div>
            <p className="text-[10px] text-[#94A3B8]">
              Verify this fingerprint through an out-of-band channel before communicating sensitive
              payloads.
            </p>
          </div>

          {/* Keys Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Encryption Public Key */}
            <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#E2E8F0]">
                  Encryption Public Key (X25519)
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(encPublicKey, 'enc')}
                  className="text-[10px] text-[#3B82F6] hover:underline flex items-center gap-1"
                >
                  {copiedKey === 'enc' ? (
                    <Check className="w-3 h-3 text-[#14B8A6]" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedKey === 'enc' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="font-mono text-[11px] text-[#94A3B8] break-all bg-[#111827] p-2 rounded border border-[#1E293B]/60 select-all">
                {encPublicKey}
              </div>
              <span className="text-[10px] text-[#94A3B8]">
                Share this key with others to receive encrypted messages.
              </span>
            </div>

            {/* Signing Public Key */}
            <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#E2E8F0]">
                  Signing Public Key (Ed25519)
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(signPublicKey, 'sign')}
                  className="text-[10px] text-[#3B82F6] hover:underline flex items-center gap-1"
                >
                  {copiedKey === 'sign' ? (
                    <Check className="w-3 h-3 text-[#14B8A6]" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedKey === 'sign' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="font-mono text-[11px] text-[#94A3B8] break-all bg-[#111827] p-2 rounded border border-[#1E293B]/60 select-all">
                {signPublicKey}
              </div>
              <span className="text-[10px] text-[#94A3B8]">
                Authenticates your identity on signed payloads.
              </span>
            </div>
          </div>
        </div>

        {/* Backup & Restore Card (1 Col) */}
        <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-6">
          <div className="flex items-center gap-2.5 border-b border-[#1E293B] pb-4">
            <ShieldCheck className="w-5 h-5 text-[#14B8A6]" />
            <h2 className="text-sm font-semibold font-['Sora'] text-white">
              Encrypted Vault Backup
            </h2>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              OMBRIX never stores unencrypted private keys. Export a password-encrypted{' '}
              <code className="text-[#A855F7]">.ombrix-vault</code> bundle derived via Argon2id (64
              MiB RAM, 2 passes).
            </p>

            {/* Export Section */}
            <div className="space-y-2 pt-2">
              <label
                htmlFor="export-passphrase"
                className="block text-[11px] font-medium text-[#E2E8F0]"
              >
                Export Passphrase (min 8 chars)
              </label>
              <input
                id="export-passphrase"
                type="password"
                placeholder="Enter strong passphrase..."
                value={backupPassphrase}
                onChange={(e) => setBackupPassphrase(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#0B0F19] border border-[#1E293B] text-white focus:outline-none focus:border-[#7C3AED]"
              />
              <button
                type="button"
                disabled={isExporting || !backupPassphrase}
                onClick={handleExportVault}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-xs font-semibold text-white transition shadow-lg shadow-[#7C3AED]/20"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? 'Deriving Argon2id...' : 'Export .ombrix-vault'}</span>
              </button>
            </div>

            <div className="border-t border-[#1E293B] pt-4 space-y-2">
              <label
                htmlFor="restore-passphrase"
                className="block text-[11px] font-medium text-[#E2E8F0]"
              >
                Restore Vault File
              </label>
              <input
                id="restore-passphrase"
                type="password"
                placeholder="Passphrase for selected backup..."
                value={restorePassphrase}
                onChange={(e) => setRestorePassphrase(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#0B0F19] border border-[#1E293B] text-white focus:outline-none focus:border-[#3B82F6]"
              />
              <label className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-xs font-semibold text-white cursor-pointer transition">
                <Upload className="w-4 h-4 text-[#3B82F6]" />
                <span>{isRestoring ? 'Decrypting Vault...' : 'Select .ombrix-vault File'}</span>
                <input
                  type="file"
                  accept=".ombrix-vault,.json"
                  onChange={handleImportVault}
                  className="hidden"
                  disabled={isRestoring}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Address Book & Contact Keyring */}
      <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E293B] pb-4">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#A855F7]" />
            <div>
              <h2 className="text-sm font-semibold font-['Sora'] text-white">
                Contact Keyring & Trust Records
              </h2>
              <p className="text-[11px] text-[#94A3B8]">
                Store public keys and mark contacts as verified after independent out-of-band
                fingerprint checks.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-[#94A3B8]">{contacts.length} Contact(s)</span>
        </div>

        {/* Add Contact Form */}
        <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-3">
          <div className="text-xs font-semibold text-[#E2E8F0] flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-[#3B82F6]" />
            <span>Add New Trusted Contact</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Contact Name (e.g. Alice)"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-[#111827] border border-[#1E293B] text-white focus:outline-none focus:border-[#3B82F6]"
            />
            <input
              type="text"
              placeholder="Curve25519 Public Key (Base64)"
              value={newContactKey}
              onChange={(e) => setNewContactKey(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-[#111827] border border-[#1E293B] text-white focus:outline-none focus:border-[#3B82F6]"
            />
            <button
              type="button"
              onClick={handleAddContact}
              className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-xs font-semibold text-white transition"
            >
              <Plus className="w-4 h-4" />
              <span>Save Contact</span>
            </button>
          </div>

          {contactError && (
            <div className="text-[11px] text-[#EF4444] font-medium">{contactError}</div>
          )}
        </div>

        {/* Contacts List */}
        {contacts.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#94A3B8]">
            No contacts saved yet. Add a contact's public key above to send encrypted steganographic
            messages.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white font-['Sora']">
                      {contact.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleContactVerified(contact.id)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 transition ${
                        contact.isVerified
                          ? 'bg-[#14B8A6]/20 text-[#14B8A6] border border-[#14B8A6]/40'
                          : 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40 hover:bg-[#F59E0B]/30'
                      }`}
                    >
                      <UserCheck className="w-3 h-3" />
                      <span>{contact.isVerified ? 'Verified Contact' : 'Mark as Verified'}</span>
                    </button>
                  </div>

                  <div className="font-mono text-[11px] text-[#14B8A6] tracking-wider break-all bg-[#111827] p-1.5 rounded border border-[#1E293B]/60">
                    {contact.fingerprint}
                  </div>
                  <div className="font-mono text-[10px] text-[#94A3B8] truncate">
                    PK: {contact.encPublicKey}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[#1E293B] pt-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(contact.encPublicKey, `key_${contact.id}`)}
                    className="text-[10px] text-[#3B82F6] hover:underline flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedKey === `key_${contact.id}` ? 'Copied' : 'Copy Key'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteContact(contact.id)}
                    className="text-[10px] text-[#EF4444] hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
