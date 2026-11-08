import {
  type ContactEntry,
  type VaultIdentityData,
  buildSignDoc,
  computeKeyId,
  fromBase64,
  initCrypto,
  openSeal,
  seal,
  signDetached,
  verifyDetached,
} from '@ombrix/crypto-adapter';
import { validatePngOrThrow } from '@ombrix/image-validation';
import type { PngMetadata } from '@ombrix/image-validation';
import { parseEnvelope, serializeEnvelope } from '@ombrix/payload-protocol';
import type { CryptoSuite, Omb1Envelope } from '@ombrix/payload-protocol';
import type { CapacityReport } from '@ombrix/stego-interface';
import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import { StegoWorkerClient } from '@ombrix/stego-worker';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Key,
  Loader2,
  Lock,
  Radar,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ensureActiveIdentity,
  getActiveIdentity,
  getSavedContacts,
} from '../security/sessionIdentity.js';
import { studioDataBus } from '../services/studioDataBus.js';

export const CoreStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'hide' | 'reveal'>('hide');

  // Crypto & Session Identity State
  const [activeIdentity, setActiveIdentityState] = useState<VaultIdentityData | null>(null);
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [cryptoSuite, setCryptoSuite] = useState<CryptoSuite>('X25519_XSALSA20_POLY1305');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('custom');
  const [recipientPublicKeyBase64, setRecipientPublicKeyBase64] = useState<string>('');
  const [signMessage, setSignMessage] = useState<boolean>(true);

  // Carrier State
  const [_carrierFile, setCarrierFile] = useState<File | null>(null);
  const [carrierPreview, setCarrierPreview] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<PngMetadata | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<CapacityReport | null>(null);
  const [carrierImageData, setCarrierImageData] = useState<ImageData | null>(null);

  // Hide (Embed) State
  const [payloadText, setPayloadText] = useState('Secret message protected by OMBRIX Core.');
  const [useEnvelope, setUseEnvelope] = useState(true);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [embedProgress, setEmbedProgress] = useState(0);
  const [embeddedImageUrl, setEmbeddedImageUrl] = useState<string | null>(null);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const embedAbortRef = useRef<AbortController | null>(null);

  // Reveal (Extract) State
  const [revealFile, setRevealFile] = useState<File | null>(null);
  const [revealPreview, setRevealPreview] = useState<string | null>(null);
  const [revealValidation, setRevealValidation] = useState<PngMetadata | null>(null);
  const [revealValidationError, setRevealValidationError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractedPayloadText, setExtractedPayloadText] = useState<string | null>(null);
  const [extractedEnvelope, setExtractedEnvelope] = useState<Omb1Envelope | null>(null);
  const [decryptionStatus, setDecryptionStatus] = useState<
    'plaintext' | 'decrypted' | 'failed' | null
  >(null);
  const [signatureStatus, setSignatureStatus] = useState<
    'none' | 'verified_contact' | 'verified_unknown' | 'invalid'
  >('none');
  const [verifiedContactName, setVerifiedContactName] = useState<string | null>(null);
  const [senderPublicKeyInput, setSenderPublicKeyInput] = useState<string>('');
  const [extractError, setExtractError] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const extractAbortRef = useRef<AbortController | null>(null);

  // Worker client ref
  const workerClientRef = useRef<StegoWorkerClient | null>(null);

  // Initialize Libsodium and Session Identity
  useEffect(() => {
    async function init() {
      try {
        await initCrypto();
        const identity = await ensureActiveIdentity();
        setActiveIdentityState(identity);
        const saved = getSavedContacts();
        setContacts(saved);
        if (saved.length > 0 && saved[0]) {
          const first = saved[0];
          setSelectedRecipientId((curr) => {
            if (curr === 'custom') {
              setRecipientPublicKeyBase64(first.encPublicKey);
              return first.id;
            }
            return curr;
          });
        }
      } catch (err) {
        console.error('Failed to init crypto in CoreStudio:', err);
      }
    }
    init();
  }, []);

  // Sync identity and contacts when switching tabs or window focusing
  const refreshIdentityAndContacts = useCallback(() => {
    const ident = getActiveIdentity();
    if (ident) setActiveIdentityState(ident);
    const saved = getSavedContacts();
    setContacts(saved);
  }, []);

  useEffect(() => {
    refreshIdentityAndContacts();
    window.addEventListener('focus', refreshIdentityAndContacts);
    return () => window.removeEventListener('focus', refreshIdentityAndContacts);
  }, [refreshIdentityAndContacts]);

  useEffect(() => {
    // Initialize Web Worker
    const worker = new Worker(new URL('../workers/stego.worker.ts', import.meta.url), {
      type: 'module',
    });
    const client = new StegoWorkerClient(worker);
    workerClientRef.current = client;

    return () => {
      client.destroy();
      worker.terminate();
    };
  }, []);

  // Handle Carrier Image Selection (Embed)
  const handleCarrierSelect = useCallback(async (file: File) => {
    setCarrierFile(file);
    setValidationError(null);
    setValidationResult(null);
    setCapacity(null);
    setCarrierImageData(null);
    setEmbeddedImageUrl(null);
    setEmbedError(null);

    const previewUrl = URL.createObjectURL(file);
    setCarrierPreview(previewUrl);

    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const result = validatePngOrThrow(buffer);
      setValidationResult(result);

      // Decode into ImageData via an off-screen canvas
      const img = new Image();
      img.src = previewUrl;
      await img.decode();

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Could not acquire 2D rendering context.');

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setCarrierImageData(imgData);

      const cap = pngLsbSequential.calculateCapacity({
        width: imgData.width,
        height: imgData.height,
        data: imgData.data,
      });
      setCapacity(cap);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setValidationError(msg);
    }
  }, []);

  // Compute estimated payload size
  const rawPayloadBytes = new TextEncoder().encode(payloadText);
  let effectivePayloadLength = rawPayloadBytes.length;
  if (useEnvelope) {
    // 32 bytes minimum header
    let headerSize = 32;
    if (cryptoSuite === 'X25519_XSALSA20_POLY1305') {
      headerSize += 8; // recipient fingerprint
      // sealed box ciphertext overhead is 48 bytes
      effectivePayloadLength += 48;
    }
    if (signMessage) {
      headerSize += 64; // Ed25519 signature
    }
    effectivePayloadLength += headerSize;
  }
  const capacityUsedPercent = capacity?.usableBytes
    ? Math.min(100, Math.round((effectivePayloadLength / capacity.usableBytes) * 100))
    : 0;

  // Execute Embedding
  const handleEmbed = async () => {
    if (!carrierImageData || !capacity || !workerClientRef.current) return;
    setIsEmbedding(true);
    setEmbedProgress(0);
    setEmbedError(null);
    setEmbeddedImageUrl(null);

    const controller = new AbortController();
    embedAbortRef.current = controller;

    try {
      let payloadToEmbed: Uint8Array;

      if (useEnvelope) {
        // Construct canonical OMB1 Envelope
        const randomMsgId = new Uint8Array(16);
        crypto.getRandomValues(randomMsgId);

        let payloadData: Uint8Array = rawPayloadBytes;
        let recipientKeyId: Uint8Array | undefined;

        if (cryptoSuite === 'X25519_XSALSA20_POLY1305') {
          if (!recipientPublicKeyBase64.trim()) {
            throw new Error('Recipient encryption public key is required for Sealed Box.');
          }
          const recPkBytes = fromBase64(recipientPublicKeyBase64.trim());
          if (recPkBytes.length !== 32) {
            throw new Error('Recipient public key must be 32 bytes (Base64).');
          }
          payloadData = seal(rawPayloadBytes, recPkBytes);
          recipientKeyId = computeKeyId(recPkBytes);
        }

        let signature: Uint8Array | undefined;
        if (signMessage && activeIdentity?.signingKeyPair?.privateKey) {
          const senderPrivKey = fromBase64(activeIdentity.signingKeyPair.privateKey);
          const magic = new Uint8Array([0x4f, 0x4d, 0x42, 0x31]); // OMB1
          const flagsInt = 1 /* signed */ | (recipientKeyId ? 2 /* hasRecipientFingerprint */ : 0);
          const signDoc = buildSignDoc({
            magic,
            version: 1,
            cipherSuite: cryptoSuite === 'X25519_XSALSA20_POLY1305' ? 1 : 0,
            flags: flagsInt,
            recipientKeyId: recipientKeyId ?? new Uint8Array(8),
            messageId: randomMsgId,
            ciphertext: payloadData,
          });
          signature = signDetached(signDoc, senderPrivKey);
        }

        const envelope: Omb1Envelope = {
          version: 1,
          cryptoSuite,
          stegoMethod: 'PNG_LSB_SEQUENTIAL',
          flags: {
            signed: Boolean(signature),
            hasRecipientFingerprint: Boolean(recipientKeyId),
          },
          messageId: randomMsgId,
          recipientFingerprint: recipientKeyId,
          payload: payloadData,
          signature,
        };

        payloadToEmbed = serializeEnvelope(envelope);
      } else {
        payloadToEmbed = rawPayloadBytes;
      }

      const stegoCarrier = await workerClientRef.current.embed(
        {
          width: carrierImageData.width,
          height: carrierImageData.height,
          data: carrierImageData.data,
        },
        payloadToEmbed,
        undefined,
        controller.signal,
        (p) => setEmbedProgress(Math.round(p * 100)),
      );

      // Render back to canvas and create PNG download URL
      const canvas = document.createElement('canvas');
      canvas.width = stegoCarrier.width;
      canvas.height = stegoCarrier.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context failure.');

      const clampedData = new Uint8ClampedArray(stegoCarrier.data);
      const newImgData = new ImageData(clampedData, stegoCarrier.width, stegoCarrier.height);
      ctx.putImageData(newImgData, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setEmbeddedImageUrl(url);
        }
      }, 'image/png');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setEmbedError(msg);
    } finally {
      setIsEmbedding(false);
      embedAbortRef.current = null;
    }
  };

  // Handle Reveal File Selection
  const handleRevealSelect = async (file: File) => {
    setRevealFile(file);
    setRevealValidationError(null);
    setRevealValidation(null);
    setExtractedPayloadText(null);
    setExtractedEnvelope(null);
    setDecryptionStatus(null);
    setSignatureStatus('none');
    setVerifiedContactName(null);
    setExtractError(null);

    const previewUrl = URL.createObjectURL(file);
    setRevealPreview(previewUrl);

    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const result = validatePngOrThrow(buffer);
      setRevealValidation(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRevealValidationError(msg);
    }
  };

  // Execute Extraction
  const handleExtract = async () => {
    if (!revealFile || !revealPreview || !workerClientRef.current) return;
    setIsExtracting(true);
    setExtractProgress(0);
    setExtractError(null);
    setExtractedPayloadText(null);
    setExtractedEnvelope(null);
    setDecryptionStatus(null);
    setSignatureStatus('none');
    setVerifiedContactName(null);

    const controller = new AbortController();
    extractAbortRef.current = controller;

    try {
      const img = new Image();
      img.src = revealPreview;
      await img.decode();

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Could not acquire 2D rendering context.');

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const extractedBytes = await workerClientRef.current.extract(
        {
          width: imgData.width,
          height: imgData.height,
          data: imgData.data,
        },
        undefined,
        controller.signal,
        (p) => setExtractProgress(Math.round(p * 100)),
      );

      // Check if extracted bytes are an OMB1 envelope
      if (
        extractedBytes.length >= 32 &&
        extractedBytes[0] === 0x4f &&
        extractedBytes[1] === 0x4d &&
        extractedBytes[2] === 0x42 &&
        extractedBytes[3] === 0x31
      ) {
        const envelope = parseEnvelope(extractedBytes);
        setExtractedEnvelope(envelope);

        let plaintextBytes: Uint8Array = envelope.payload;

        // Handle Decryption if Encrypted
        if (envelope.cryptoSuite === 'X25519_XSALSA20_POLY1305') {
          const identity = activeIdentity || getActiveIdentity();
          if (!identity?.encryptionKeyPair?.privateKey) {
            setDecryptionStatus('failed');
            throw new Error(
              'Payload is encrypted with Sealed Box (X25519), but no active Vault private key is available in this session.',
            );
          }

          try {
            const recPub = fromBase64(identity.encryptionKeyPair.publicKey);
            const recPriv = fromBase64(identity.encryptionKeyPair.privateKey);
            plaintextBytes = openSeal(envelope.payload, recPub, recPriv);
            setDecryptionStatus('decrypted');
          } catch (_err) {
            setDecryptionStatus('failed');
            throw new Error(
              'Decryption failed. The active session keypair does not match the intended recipient or the payload was tampered with.',
            );
          }
        } else {
          setDecryptionStatus('plaintext');
        }

        setExtractedPayloadText(new TextDecoder().decode(plaintextBytes));

        // Handle Signature Verification if Signed
        if (envelope.flags.signed && envelope.signature) {
          const magic = new Uint8Array([0x4f, 0x4d, 0x42, 0x31]);
          const flagsInt =
            (envelope.flags.signed ? 1 : 0) | (envelope.flags.hasRecipientFingerprint ? 2 : 0);
          const signDoc = buildSignDoc({
            magic,
            version: envelope.version,
            cipherSuite: envelope.cryptoSuite === 'X25519_XSALSA20_POLY1305' ? 1 : 0,
            flags: flagsInt,
            recipientKeyId: envelope.recipientFingerprint ?? new Uint8Array(8),
            messageId: envelope.messageId,
            ciphertext: envelope.payload,
          });

          // Check if user manually supplied a sender key or search saved contacts
          const candidates: Array<{ name: string; key: Uint8Array }> = [];
          if (senderPublicKeyInput.trim()) {
            try {
              candidates.push({
                name: 'Custom Input Key',
                key: fromBase64(senderPublicKeyInput.trim()),
              });
            } catch {
              // ignore invalid base64 in manual input
            }
          }

          for (const c of contacts) {
            if (c.signPublicKey) {
              candidates.push({ name: c.name, key: fromBase64(c.signPublicKey) });
            }
          }

          if (activeIdentity?.signingKeyPair?.publicKey) {
            candidates.push({
              name: `${activeIdentity.name} (Yourself)`,
              key: fromBase64(activeIdentity.signingKeyPair.publicKey),
            });
          }

          let verifiedMatch: { name: string; key: Uint8Array } | null = null;
          for (const cand of candidates) {
            if (cand.key.length === 32) {
              const ok = verifyDetached(signDoc, envelope.signature, cand.key);
              if (ok) {
                verifiedMatch = cand;
                break;
              }
            }
          }

          if (verifiedMatch) {
            setSignatureStatus('verified_contact');
            setVerifiedContactName(verifiedMatch.name);
          } else if (senderPublicKeyInput.trim()) {
            setSignatureStatus('invalid');
          } else {
            setSignatureStatus('verified_unknown');
          }
        } else {
          setSignatureStatus('none');
        }
      } else {
        // Plain text fallback
        setDecryptionStatus('plaintext');
        setSignatureStatus('none');
        setExtractedPayloadText(new TextDecoder().decode(extractedBytes));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setExtractError(msg);
    } finally {
      setIsExtracting(false);
      extractAbortRef.current = null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#111827] border border-[#1E293B]">
        <div>
          <h2 className="text-xl font-bold font-['Sora'] text-white flex items-center gap-2">
            <span>OMBRIX Core Studio</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#7C3AED]/20 border border-[#7C3AED]/40 text-[#A855F7] font-mono">
              LSB Sequential Engine
            </span>
          </h2>
          <p className="text-sm text-[#94A3B8]">
            Deterministic raster steganography laboratory with static PNG validation and worker
            sandboxing.
          </p>
        </div>

        <div
          className="inline-flex p-1 rounded-lg bg-[#0B0F19] border border-[#1E293B]"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'hide'}
            onClick={() => setActiveTab('hide')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'hide'
                ? 'bg-[#7C3AED] text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <EyeOff className="w-4 h-4" />
            <span>Hide (Conceal)</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reveal'}
            onClick={() => setActiveTab('reveal')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'reveal'
                ? 'bg-[#3B82F6] text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Reveal (Extract)</span>
          </button>
        </div>
      </div>

      {/* Mode Content */}
      {activeTab === 'hide' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Carrier Upload & Inspection */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-5 rounded-xl bg-[#111827] border border-[#1E293B] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#A855F7]" />
                  <span>1. Carrier Image (Static PNG)</span>
                </h3>
                {validationResult && (
                  <span className="flex items-center gap-1 text-xs text-[#14B8A6] font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Validated
                  </span>
                )}
              </div>

              {/* Dropzone */}
              <label
                htmlFor="carrier-input"
                className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  carrierPreview
                    ? 'border-[#7C3AED]/40 bg-[#0B0F19]'
                    : 'border-[#334155] hover:border-[#7C3AED] bg-[#0B0F19]/50 hover:bg-[#0B0F19]'
                }`}
              >
                {carrierPreview ? (
                  <div className="relative w-full max-h-56 flex items-center justify-center overflow-hidden rounded-lg">
                    <img
                      src={carrierPreview}
                      alt="Carrier Preview"
                      className="max-h-56 object-contain rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-[#7C3AED]/10 flex items-center justify-center text-[#A855F7]">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div className="text-sm text-[#E2E8F0] font-medium">
                      Select or drop static PNG image
                    </div>
                    <div className="text-xs text-[#94A3B8]">
                      Enforces magic bytes, IHDR validation & bomb protection
                    </div>
                  </div>
                )}
                <input
                  id="carrier-input"
                  type="file"
                  accept="image/png"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCarrierSelect(f);
                  }}
                />
              </label>

              {/* Validation Error Alert */}
              {validationError && (
                <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                  <div>
                    <div className="font-semibold">Validation Rejected</div>
                    <div>{validationError}</div>
                  </div>
                </div>
              )}

              {/* Carrier Inspection Specs */}
              {validationResult && capacity && (
                <div className="space-y-3 pt-2 border-t border-[#1E293B]">
                  <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Carrier Specifications
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                      <div className="text-[#64748B]">Resolution</div>
                      <div className="font-mono text-white font-semibold">
                        {validationResult.width} × {validationResult.height}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                      <div className="text-[#64748B]">Pixel Count</div>
                      <div className="font-mono text-white font-semibold">
                        {validationResult.totalPixels.toLocaleString()} px
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                      <div className="text-[#64748B]">Format</div>
                      <div className="font-mono text-white font-semibold">
                        {validationResult.colorTypeName}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                      <div className="text-[#64748B]">Usable Capacity</div>
                      <div className="font-mono text-[#14B8A6] font-semibold">
                        {capacity.usableBytes.toLocaleString()} bytes
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                      <div className="text-[#64748B]">Theoretical Limit</div>
                      <div className="font-mono text-[#94A3B8] font-semibold">
                        {capacity.theoreticalBytes.toLocaleString()} bytes
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                      <div className="text-[#64748B]">File Size</div>
                      <div className="font-mono text-[#94A3B8] font-semibold">
                        {(validationResult.compressedSizeBytes / 1024).toFixed(1)} KiB
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Payload Input, Protocol Framing & Embedding */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-5 rounded-xl bg-[#111827] border border-[#1E293B] space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#3B82F6]" />
                <span>2. Payload & Envelope Configuration</span>
              </h3>

              {/* Payload Textarea */}
              <div className="space-y-1.5">
                <label
                  htmlFor="payload-textarea"
                  className="text-xs text-[#94A3B8] flex items-center justify-between"
                >
                  <span>Secret Payload Content</span>
                  <span className="font-mono text-[#E2E8F0]">{rawPayloadBytes.length} bytes</span>
                </label>
                <textarea
                  id="payload-textarea"
                  value={payloadText}
                  onChange={(e) => setPayloadText(e.target.value)}
                  rows={4}
                  className="w-full p-3 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-white text-xs font-mono focus:outline-none focus:border-[#7C3AED] resize-none"
                  placeholder="Enter confidential message..."
                />
              </div>

              {/* Protocol & Encryption Options */}
              <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#7C3AED]" />
                    <span className="text-xs font-semibold text-white">
                      OMB1 Protocol & Cryptography
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[#94A3B8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useEnvelope}
                      onChange={(e) => setUseEnvelope(e.target.checked)}
                      className="rounded bg-[#111827] border-[#334155] text-[#7C3AED] focus:ring-[#7C3AED]"
                    />
                    <span>Binary Envelope Framing</span>
                  </label>
                </div>

                {useEnvelope && (
                  <div className="space-y-3 pt-2 border-t border-[#1E293B]/60 text-xs">
                    {/* Cipher Suite Selector */}
                    <div className="space-y-1.5">
                      <label htmlFor="cipher-suite-select" className="text-[#94A3B8] block">
                        Encryption Mode
                      </label>
                      <select
                        id="cipher-suite-select"
                        value={cryptoSuite}
                        onChange={(e) => setCryptoSuite(e.target.value as CryptoSuite)}
                        className="w-full p-2.5 rounded-lg bg-[#111827] border border-[#1E293B] text-white text-xs focus:outline-none focus:border-[#7C3AED]"
                      >
                        <option value="X25519_XSALSA20_POLY1305">
                          Libsodium Sealed Box (X25519 + XSalsa20-Poly1305) — Recommended
                        </option>
                        <option value="NONE">Unencrypted (Plaintext Payload)</option>
                      </select>
                    </div>

                    {/* Recipient Selection for Sealed Box */}
                    {cryptoSuite === 'X25519_XSALSA20_POLY1305' && (
                      <div className="space-y-2 p-3 rounded-lg bg-[#111827] border border-[#1E293B]">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-[#3B82F6]" />
                            <span>Recipient Encryption Key</span>
                          </span>
                          {contacts.length > 0 && (
                            <select
                              value={selectedRecipientId}
                              onChange={(e) => {
                                setSelectedRecipientId(e.target.value);
                                const found = contacts.find((c) => c.id === e.target.value);
                                if (found) {
                                  setRecipientPublicKeyBase64(found.encPublicKey);
                                }
                              }}
                              className="text-[11px] p-1 rounded bg-[#0B0F19] border border-[#334155] text-[#94A3B8]"
                            >
                              <option value="custom">Manual Key Input</option>
                              {contacts.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        <input
                          type="text"
                          value={recipientPublicKeyBase64}
                          onChange={(e) => {
                            setRecipientPublicKeyBase64(e.target.value);
                            setSelectedRecipientId('custom');
                          }}
                          placeholder="Paste recipient's 32-byte Base64 X25519 public key..."
                          className="w-full p-2.5 rounded bg-[#0B0F19] border border-[#1E293B] text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6]"
                        />

                        {recipientPublicKeyBase64.trim() && (
                          <div className="flex items-center justify-between text-[10px] text-[#64748B] font-mono">
                            <span>Key ID:</span>
                            <span className="text-[#3B82F6]">
                              {(() => {
                                try {
                                  const bytes = fromBase64(recipientPublicKeyBase64.trim());
                                  if (bytes.length === 32) {
                                    return Array.from(computeKeyId(bytes))
                                      .map((b) => b.toString(16).padStart(2, '0'))
                                      .join('');
                                  }
                                  return 'Invalid length';
                                } catch {
                                  return 'Invalid Base64';
                                }
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sender Ed25519 Signature Option */}
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#111827] border border-[#1E293B]">
                      <input
                        type="checkbox"
                        id="sign-toggle"
                        checked={signMessage}
                        onChange={(e) => setSignMessage(e.target.checked)}
                        className="mt-0.5 rounded bg-[#0B0F19] border-[#334155] text-[#7C3AED] focus:ring-[#7C3AED]"
                      />
                      <label
                        htmlFor="sign-toggle"
                        className="text-xs text-[#E2E8F0] cursor-pointer"
                      >
                        <div className="font-medium text-white flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-[#14B8A6]" />
                          <span>Attach Sender Ed25519 Detached Signature</span>
                        </div>
                        <div className="text-[11px] text-[#64748B] pt-0.5">
                          Signs the canonical SignDoc using active Vault identity (
                          <span className="text-[#A855F7] font-mono">
                            {activeIdentity?.name || 'Active Identity'}
                          </span>
                          ) to guarantee origin authenticity and metadata integrity.
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Capacity Utilization Bar */}
              {capacity && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#94A3B8]">Carrier Capacity Utilization</span>
                    <span
                      className={`font-mono font-semibold ${capacityUsedPercent > 90 ? 'text-red-400' : 'text-[#14B8A6]'}`}
                    >
                      {effectivePayloadLength.toLocaleString()} /{' '}
                      {capacity.usableBytes.toLocaleString()} bytes ({capacityUsedPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#0B0F19] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        capacityUsedPercent > 90
                          ? 'bg-red-500'
                          : capacityUsedPercent > 50
                            ? 'bg-[#A855F7]'
                            : 'bg-[#14B8A6]'
                      }`}
                      style={{ width: `${capacityUsedPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleEmbed}
                  disabled={!carrierImageData || isEmbedding || Boolean(validationError)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-[0_0_20px_rgba(124,58,237,0.3)] transition-all"
                >
                  {isEmbedding ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Embedding in Worker ({embedProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-4 h-4" />
                      <span>Embed & Conceal Payload</span>
                    </>
                  )}
                </button>

                {isEmbedding && (
                  <button
                    type="button"
                    onClick={() => embedAbortRef.current?.abort()}
                    className="px-3 py-2.5 rounded-lg bg-[#1E293B] hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-[#334155] transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {embedError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{embedError}</span>
                </div>
              )}

              {/* Download Stego Output */}
              {embeddedImageUrl && (
                <div className="p-4 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/30 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#14B8A6]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Steganographic Embedding Complete</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <img
                      src={embeddedImageUrl}
                      alt="Stego Output"
                      className="w-16 h-16 object-cover rounded-lg border border-[#14B8A6]/40"
                    />
                    <div className="flex-1 text-xs text-[#94A3B8]">
                      Exact RGB LSB bytes embedded. Ready to download and transmit.
                    </div>
                    <a
                      href={embeddedImageUrl}
                      download={`ombrix-stego-${Date.now()}.png`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#14B8A6] text-black font-semibold text-xs hover:bg-[#0D9488] transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PNG</span>
                    </a>
                  </div>

                  {/* Cross-Studio Actions Row */}
                  <div className="pt-2 border-t border-[#14B8A6]/20 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-[#14B8A6] mr-1">Handoff:</span>
                    <button
                      type="button"
                      onClick={() => {
                        studioDataBus.sendCarrierToModule('lens', {
                          dataUrl: embeddedImageUrl,
                          name: 'stego-embedded.png',
                          source: 'core-studio',
                        });
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B0F19] hover:bg-[#1E293B] border border-[#1E293B] hover:border-[#3B82F6]/50 text-[11px] text-[#E2E8F0] transition-colors"
                    >
                      <ZoomIn className="w-3 h-3 text-[#3B82F6]" />
                      <span>Analyze in Lens</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        studioDataBus.sendCarrierToModule('scan', {
                          dataUrl: embeddedImageUrl,
                          name: 'stego-embedded.png',
                          source: 'core-studio',
                        });
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B0F19] hover:bg-[#1E293B] border border-[#1E293B] hover:border-[#06B6D4]/50 text-[11px] text-[#E2E8F0] transition-colors"
                    >
                      <Radar className="w-3 h-3 text-[#06B6D4]" />
                      <span>Scan Forensics</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        studioDataBus.sendCarrierToModule('airgap', {
                          dataUrl: embeddedImageUrl,
                          name: 'stego-embedded.png',
                          source: 'core-studio',
                        });
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B0F19] hover:bg-[#1E293B] border border-[#1E293B] hover:border-[#A855F7]/50 text-[11px] text-[#E2E8F0] transition-colors"
                    >
                      <Camera className="w-3 h-3 text-[#A855F7]" />
                      <span>Transmit via Air-Gap</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        studioDataBus.sendCarrierToModule('transit', {
                          dataUrl: embeddedImageUrl,
                          name: 'stego-embedded.png',
                          source: 'core-studio',
                        });
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B0F19] hover:bg-[#1E293B] border border-[#1E293B] hover:border-[#14B8A6]/50 text-[11px] text-[#E2E8F0] transition-colors"
                    >
                      <Radio className="w-3 h-3 text-[#14B8A6]" />
                      <span>Test in Transit</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Reveal (Extract) Tab */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <div className="p-5 rounded-xl bg-[#111827] border border-[#1E293B] space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#3B82F6]" />
                <span>Upload Stego Carrier Image</span>
              </h3>

              <label
                htmlFor="reveal-input"
                className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  revealPreview
                    ? 'border-[#3B82F6]/40 bg-[#0B0F19]'
                    : 'border-[#334155] hover:border-[#3B82F6] bg-[#0B0F19]/50 hover:bg-[#0B0F19]'
                }`}
              >
                {revealPreview ? (
                  <img
                    src={revealPreview}
                    alt="Stego Candidate"
                    className="max-h-56 object-contain rounded-lg"
                  />
                ) : (
                  <div className="text-center space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-[#3B82F6]/10 flex items-center justify-center text-[#3B82F6]">
                      <Eye className="w-5 h-5" />
                    </div>
                    <div className="text-sm text-[#E2E8F0] font-medium">
                      Select or drop stego PNG image
                    </div>
                    <div className="text-xs text-[#94A3B8]">
                      Extracts 32-bit header and payload bits via Web Worker
                    </div>
                  </div>
                )}
                <input
                  id="reveal-input"
                  type="file"
                  accept="image/png"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleRevealSelect(f);
                  }}
                />
              </label>

              {revealValidationError && (
                <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{revealValidationError}</span>
                </div>
              )}

              {revealValidation && (
                <div className="p-3 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-xs flex items-center justify-between font-mono">
                  <span className="text-[#94A3B8]">Carrier Integrity:</span>
                  <span className="text-[#14B8A6]">
                    Valid Static PNG ({revealValidation.width}×{revealValidation.height})
                  </span>
                </div>
              )}

              {/* Optional Sender Public Key for Verification */}
              <div className="space-y-1.5 p-3 rounded-lg bg-[#0B0F19] border border-[#1E293B]">
                <label
                  htmlFor="sender-pubkey-verify"
                  className="text-xs text-[#94A3B8] flex items-center gap-1.5"
                >
                  <Key className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span>Sender Signing Key (Optional)</span>
                </label>
                <input
                  id="sender-pubkey-verify"
                  type="text"
                  value={senderPublicKeyInput}
                  onChange={(e) => setSenderPublicKeyInput(e.target.value)}
                  placeholder="Auto-checks contacts and identity, or paste custom Base64 key..."
                  className="w-full p-2 rounded bg-[#111827] border border-[#334155] text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6]"
                />
                <div className="text-[10px] text-[#64748B]">
                  Leave blank to automatically check against your saved Vault contacts and session
                  identities.
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleExtract}
                  disabled={!revealPreview || isExtracting || Boolean(revealValidationError)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Extracting ({extractProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>Extract Embedded Payload</span>
                    </>
                  )}
                </button>

                {isExtracting && (
                  <button
                    type="button"
                    onClick={() => extractAbortRef.current?.abort()}
                    className="px-3 py-2.5 rounded-lg bg-[#1E293B] hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-[#334155] transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {extractError && (
                <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
                  <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Extraction Failed</div>
                    <div>{extractError}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reveal Result Column */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-5 rounded-xl bg-[#111827] border border-[#1E293B] space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#14B8A6]" />
                <span>Extracted Secret Information</span>
              </h3>

              {extractedPayloadText !== null ? (
                <div className="space-y-4">
                  {/* Status Badges */}
                  <div className="space-y-2">
                    {/* Decryption Status */}
                    {decryptionStatus === 'decrypted' && (
                      <div className="p-3 rounded-lg bg-[#14B8A6]/10 border border-[#14B8A6]/30 text-[#14B8A6] text-xs flex items-center gap-2">
                        <Lock className="w-4 h-4 flex-shrink-0" />
                        <div>
                          <div className="font-semibold">Decryption Authenticated & Successful</div>
                          <div className="text-[11px] text-[#14B8A6]/80">
                            Payload unlocked using your active Vault identity's X25519 private key.
                          </div>
                        </div>
                      </div>
                    )}

                    {decryptionStatus === 'failed' && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                        <div>
                          <div className="font-semibold">Decryption Failed</div>
                          <div className="text-[11px] text-red-400/80">
                            Key mismatch or ciphertext tampering detected. Poly1305 MAC rejected.
                          </div>
                        </div>
                      </div>
                    )}

                    {decryptionStatus === 'plaintext' && (
                      <div className="p-2.5 rounded-lg bg-[#1E293B] border border-[#334155] text-[#94A3B8] text-xs flex items-center gap-2">
                        <FileText className="w-4 h-4 flex-shrink-0 text-[#94A3B8]" />
                        <span>Unencrypted Plaintext Payload (No cryptographic seal applied)</span>
                      </div>
                    )}

                    {/* Signature Status */}
                    {signatureStatus === 'verified_contact' && (
                      <div className="p-3 rounded-lg bg-[#14B8A6]/10 border border-[#14B8A6]/30 text-[#14B8A6] text-xs flex items-center gap-2">
                        <UserCheck className="w-4 h-4 flex-shrink-0 text-[#14B8A6]" />
                        <div>
                          <div className="font-semibold">
                            Sender Verified: {verifiedContactName}
                          </div>
                          <div className="text-[11px] text-[#14B8A6]/80">
                            Canonical SignDoc Ed25519 signature matches saved public key.
                          </div>
                        </div>
                      </div>
                    )}

                    {signatureStatus === 'verified_unknown' && (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 flex-shrink-0 text-amber-400" />
                        <div>
                          <div className="font-semibold">
                            Valid Ed25519 Signature (Unverified Key)
                          </div>
                          <div className="text-[11px] text-amber-300/80">
                            Signature is mathematically valid, but the sender key is not in your
                            Vault contacts.
                          </div>
                        </div>
                      </div>
                    )}

                    {signatureStatus === 'invalid' && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 flex-shrink-0 text-red-400" />
                        <div>
                          <div className="font-semibold">Signature Verification Rejected</div>
                          <div className="text-[11px] text-red-400/80">
                            The detached Ed25519 signature does not match the provided public key or
                            metadata was altered.
                          </div>
                        </div>
                      </div>
                    )}

                    {signatureStatus === 'none' && extractedEnvelope && (
                      <div className="p-2 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-[#64748B] text-xs">
                        No digital signature attached to this message.
                      </div>
                    )}
                  </div>

                  {extractedEnvelope && (
                    <div className="p-3.5 rounded-lg bg-[#0B0F19] border border-[#7C3AED]/30 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-[#7C3AED]" />
                          <span>OMB1 Protocol Envelope Verified</span>
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#7C3AED]/20 text-[#A855F7]">
                          Version {extractedEnvelope.version}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                        <div>
                          <span className="text-[#64748B]">Crypto Suite: </span>
                          <span className="text-[#E2E8F0] font-mono">
                            {extractedEnvelope.cryptoSuite}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#64748B]">Stego Method: </span>
                          <span className="text-[#E2E8F0] font-mono">
                            {extractedEnvelope.stegoMethod}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[#64748B]">Message ID: </span>
                          <span className="text-[#14B8A6] font-mono">
                            {Array.from(extractedEnvelope.messageId)
                              .map((b) => b.toString(16).padStart(2, '0'))
                              .join('')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor="extracted-content-textarea" className="text-[#94A3B8]">
                        Recovered Payload Text
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (extractedPayloadText) {
                              navigator.clipboard.writeText(extractedPayloadText);
                              setCopiedPayload(true);
                              setTimeout(() => setCopiedPayload(false), 2000);
                            }
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-[#1E293B] hover:bg-[#334155] text-[11px] text-[#E2E8F0] transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedPayload ? 'Copied!' : 'Copy'}</span>
                        </button>
                        <a
                          href={`data:text/plain;charset=utf-8,${encodeURIComponent(extractedPayloadText)}`}
                          download={`ombrix-extracted-${Date.now()}.txt`}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-[#1E293B] hover:bg-[#334155] text-[11px] text-[#E2E8F0] transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </a>
                      </div>
                    </div>
                    <textarea
                      id="extracted-content-textarea"
                      readOnly
                      value={extractedPayloadText}
                      rows={5}
                      className="w-full p-3 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-[#14B8A6] font-mono text-xs focus:outline-none resize-none"
                    />
                  </div>

                  {/* Security Notice */}
                  <div className="p-3 rounded-lg bg-[#0B0F19] border border-[#1E293B] flex items-center gap-2 text-[11px] text-[#64748B]">
                    <ShieldAlert className="w-4 h-4 text-[#64748B] flex-shrink-0" />
                    <span>
                      Security Guarantee: Extracted payloads are isolated in memory and never
                      auto-executed.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-[#64748B] text-xs">
                  Upload an image and run extraction to view decoded payload contents and envelope
                  metadata.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
