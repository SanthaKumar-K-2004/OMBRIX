import {
  type ContactEntry,
  type VaultIdentityData,
  buildSignDoc,
  computeKeyId,
  decryptWithPasskey,
  encryptWithPasskey,
  fromBase64,
  initCrypto,
  isPasskeyEncrypted,
  openSeal,
  parseAnyKey32,
  seal,
  signDetached,
  verifyDetached,
  zeroMemory,
} from '@ombrix/crypto-adapter';
import { validatePngOrThrow } from '@ombrix/image-validation';
import type { PngMetadata } from '@ombrix/image-validation';
import { parseEnvelope, serializeEnvelope } from '@ombrix/payload-protocol';
import type { CryptoSuite, Omb1Envelope } from '@ombrix/payload-protocol';
import {
  haarDwtStego,
  hyperMatrixMethod,
  pvdStego,
  robustResilientStego,
  stealthMatrixMethod,
} from '@ombrix/stego-advanced';
import type { CapacityReport, CarrierImage } from '@ombrix/stego-interface';
import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import { StegoWorkerClient } from '@ombrix/stego-worker';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Key,
  Layers,
  Loader2,
  Lock,
  Maximize2,
  Radar,
  Radio,
  RefreshCw,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ensureActiveIdentity,
  getActiveIdentity,
  getSavedContacts,
} from '../security/sessionIdentity.js';
import { studioDataBus } from '../services/studioDataBus.js';
import { encodePngAsync, loadCarrierImageLossless } from '../utils/browserPngCodec.js';
import {
  isChameleonContainer,
  packChameleonContainer,
  unpackChameleonContainer,
} from '../utils/chameleon.js';
import { smartCompress, smartDecompress } from '../utils/compression.js';
import {
  type ExtractedSecretFile,
  packFilePayload,
  unpackFilePayload,
} from '../utils/filePayload.js';
import { type GhostCarrierTheme, generateGhostCarrier } from '../utils/ghostCarrier.js';
import {
  getImageDimensions,
  optimizeCovertPhotoForRobustMessaging,
  optimizeSecretPhoto,
} from '../utils/secretImageScaler.js';
import { SmartPasskeyAssistant } from './SmartPasskeyAssistant.js';
import { SplitComparisonSlider } from './SplitComparisonSlider.js';

const HIGH_CAPACITY_PNG_LIMITS = {
  maxFileSize: 100 * 1024 * 1024, // 100 MiB
  maxWidth: 16384,
  maxHeight: 16384,
  maxPixels: 100_000_000, // 100 Megapixels
  maxUncompressedBytes: 256 * 1024 * 1024,
};

function computeMethodCapacity(methodId: string, carrier: CarrierImage): CapacityReport {
  switch (methodId) {
    case 'stego-hyper-matrix':
      return hyperMatrixMethod.calculateCapacity(carrier);
    case 'stego-stealth-matrix':
      return stealthMatrixMethod.calculateCapacity(carrier);
    case 'stego-robust-resilient':
      return robustResilientStego.calculateCapacity(carrier);
    case 'stego-dwt':
      return haarDwtStego.calculateCapacity(carrier);
    case 'stego-pvd':
      return pvdStego.calculateCapacity(carrier);
    default:
      return pngLsbSequential.calculateCapacity(carrier);
  }
}

export const CoreStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'hide' | 'reveal'>('hide');

  // Stego Method & Passphrase State (Default to Flagship Hyper-Matrix)
  const [selectedMethod, setSelectedMethod] = useState<string>('stego-hyper-matrix');
  const [revealMethod, setRevealMethod] = useState<string>('auto');
  const [passphrase, setPassphrase] = useState<string>('');
  const [revealPassphrase, setRevealPassphrase] = useState<string>('');
  const [detectedMethodName, setDetectedMethodName] = useState<string | null>(null);
  const [psnr, setPsnr] = useState<number | null>(null);
  const [mse, setMse] = useState<number | null>(null);

  // Sync activeTab with studioDataBus
  useEffect(() => {
    return studioDataBus.subscribeCoreTab((tab) => {
      setActiveTab(tab);
    });
  }, []);

  // Crypto & Session Identity State - Default to 'NONE' (Passkey / Symmetric direct) so users are never blocked
  const [activeIdentity, setActiveIdentityState] = useState<VaultIdentityData | null>(null);
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [cryptoSuite, setCryptoSuite] = useState<CryptoSuite>('NONE');
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
  const [isGeneratingGhost, setIsGeneratingGhost] = useState(false);
  const [ghostTheme, setGhostTheme] = useState<GhostCarrierTheme>('nebula');

  // Hide (Embed) State
  const [payloadMode, setPayloadMode] = useState<'text' | 'image'>('text');
  const [payloadText, setPayloadText] = useState('Secret message protected by OMBRIX Core.');
  const [secretImageFile, setSecretImageFile] = useState<File | null>(null);
  const [rawSecretFile, setRawSecretFile] = useState<File | null>(null);
  const [secretImageBytes, setSecretImageBytes] = useState<Uint8Array | null>(null);
  const [secretImagePreview, setSecretImagePreview] = useState<string | null>(null);
  const [secretImageDims, setSecretImageDims] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [autoScaleSecretPhoto, setAutoScaleSecretPhoto] = useState<boolean>(true);
  const [isOptimizingSecretPhoto, setIsOptimizingSecretPhoto] = useState<boolean>(false);
  const [optimizedSecretMeta, setOptimizedSecretMeta] = useState<{
    originalSize: number;
    newSize: number;
  } | null>(null);
  // Chameleon Anti-Coercion (Dual-Layer) State
  const [isChameleonEnabled, setIsChameleonEnabled] = useState(false);
  const [decoyText, setDecoyText] = useState(
    'Team sync notes: Design sprint postponed to Thursday 3:00 PM.',
  );
  const [decoyPassphrase, setDecoyPassphrase] = useState('decoy-safe-pass');
  const [useEnvelope, setUseEnvelope] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [embedProgress, setEmbedProgress] = useState(0);
  const [embeddedImageUrl, setEmbeddedImageUrl] = useState<string | null>(null);
  const embeddedBlobRef = useRef<Blob | null>(null);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const embedAbortRef = useRef<AbortController | null>(null);

  // Reveal (Extract) State
  const [revealFile, setRevealFile] = useState<File | null>(null);
  const [revealPreview, setRevealPreview] = useState<string | null>(null);
  const [_revealValidation, setRevealValidation] = useState<PngMetadata | null>(null);
  const [revealValidationError, setRevealValidationError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractedPayloadText, setExtractedPayloadText] = useState<string | null>(null);
  const [extractedSecretFile, setExtractedSecretFile] = useState<ExtractedSecretFile | null>(null);
  const [extractedEnvelope, setExtractedEnvelope] = useState<Omb1Envelope | null>(null);
  const [unlockedChameleonLayer, setUnlockedChameleonLayer] = useState<'master' | 'decoy' | null>(
    null,
  );
  const [decryptionStatus, setDecryptionStatus] = useState<
    'plaintext' | 'decrypted' | 'passkey_decrypted' | 'failed' | null
  >(null);
  const [signatureStatus, setSignatureStatus] = useState<
    'none' | 'verified_contact' | 'verified_unknown' | 'invalid'
  >('none');
  const [verifiedContactName, setVerifiedContactName] = useState<string | null>(null);
  const [senderPublicKeyInput, setSenderPublicKeyInput] = useState<string>('');
  const [extractError, setExtractError] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const extractAbortRef = useRef<AbortController | null>(null);

  // Security & Forensic Memory Zeroization
  const [memoryScrubbedToast, setMemoryScrubbedToast] = useState(false);
  const activeObjectUrls = useRef<Set<string>>(new Set());

  const registerTrackedUrl = useCallback((url: string | null | undefined): string | null => {
    if (!url) return null;
    activeObjectUrls.current.add(url);
    return url;
  }, []);

  const revokeTrackedUrl = useCallback((url: string | null | undefined) => {
    if (url && activeObjectUrls.current.has(url)) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
      activeObjectUrls.current.delete(url);
    }
  }, []);

  const purgeAllTrackedUrls = useCallback(() => {
    for (const url of activeObjectUrls.current) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
    activeObjectUrls.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      purgeAllTrackedUrls();
    };
  }, [purgeAllTrackedUrls]);

  // Forensic RAM Memory Sanitization & Panic Flush
  const handlePanicZeroize = useCallback(() => {
    // 1. In-place wipe of carrier raster
    if (carrierImageData?.data) {
      carrierImageData.data.fill(0);
    }
    // 2. In-place wipe of secret payload buffers
    if (secretImageBytes) {
      zeroMemory(secretImageBytes);
    }
    if (extractedSecretFile?.data) {
      zeroMemory(extractedSecretFile.data);
    }
    // 3. Purge all object URLs from browser memory
    purgeAllTrackedUrls();
    // 4. Reset state
    setCarrierFile(null);
    setCarrierPreview(null);
    setCarrierImageData(null);
    setCapacity(null);
    setEmbeddedImageUrl(null);
    embeddedBlobRef.current = null;
    setSecretImageFile(null);
    setRawSecretFile(null);
    setSecretImageBytes(null);
    setSecretImagePreview(null);
    setPassphrase('');
    setRevealFile(null);
    setRevealPreview(null);
    setRevealPassphrase('');
    setExtractedPayloadText(null);
    setExtractedSecretFile(null);
    setExtractedEnvelope(null);
    setUnlockedChameleonLayer(null);
    setDecryptionStatus(null);
    setSignatureStatus('none');
    setExtractError(null);
    setEmbedError(null);
    setMemoryScrubbedToast(true);
    setTimeout(() => setMemoryScrubbedToast(false), 3500);
  }, [carrierImageData, secretImageBytes, extractedSecretFile, purgeAllTrackedUrls]);

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
        } else if (identity?.encryptionKeyPair?.publicKey) {
          // Pre-populate with user's active Vault identity key so they are never blocked
          setRecipientPublicKeyBase64(identity.encryptionKeyPair.publicKey);
        }
      } catch (err) {
        console.error('Failed to init crypto in CoreStudio:', err);
      }
    }
    init();
  }, []);

  // Recalculate capacity live whenever selectedMethod or carrierImageData changes
  useEffect(() => {
    if (carrierImageData) {
      const cap = computeMethodCapacity(selectedMethod, {
        width: carrierImageData.width,
        height: carrierImageData.height,
        data: carrierImageData.data,
      });
      setCapacity(cap);
    }
  }, [selectedMethod, carrierImageData]);

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
  const handleCarrierSelect = useCallback(
    async (file: File) => {
      setCarrierFile(file);
      setValidationError(null);
      setValidationResult(null);
      setCapacity(null);
      setCarrierImageData(null);
      setEmbeddedImageUrl(null);
      setEmbedError(null);
      setPsnr(null);
      setMse(null);

      const previewUrl = URL.createObjectURL(file);
      setCarrierPreview((prev) => {
        revokeTrackedUrl(prev);
        return registerTrackedUrl(previewUrl);
      });

      try {
        const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
        if (isPng) {
          try {
            const buffer = new Uint8Array(await file.arrayBuffer());
            const result = validatePngOrThrow(buffer, HIGH_CAPACITY_PNG_LIMITS);
            setValidationResult(result);
          } catch (_pngErr) {
            // If non-standard chunks, still allow canvas decoding
          }
        }

        // Bit-exact lossless carrier raster loading
        const carrierImg = await loadCarrierImageLossless(file);
        const imgData = new ImageData(
          new Uint8ClampedArray(carrierImg.data),
          carrierImg.width,
          carrierImg.height,
        );
        setCarrierImageData(imgData);

        const cap = computeMethodCapacity(selectedMethod, {
          width: imgData.width,
          height: imgData.height,
          data: imgData.data,
        });
        setCapacity(cap);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setValidationError(msg);
      }
    },
    [selectedMethod, registerTrackedUrl, revokeTrackedUrl],
  );

  // Handle 1-Click Procedural Ghost Carrier Synthesis
  const handleGenerateGhostCarrier = useCallback(
    async (theme?: GhostCarrierTheme) => {
      setIsGeneratingGhost(true);
      setValidationError(null);
      setEmbedError(null);
      try {
        const selected = theme ?? ghostTheme;
        if (theme) setGhostTheme(theme);
        const ghost = await generateGhostCarrier(selected, 1920, 1080);
        await handleCarrierSelect(ghost.file);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setValidationError(`Ghost carrier generation failed: ${msg}`);
      } finally {
        setIsGeneratingGhost(false);
      }
    },
    [ghostTheme, handleCarrierSelect],
  );

  // Handle Secret Image selection with smart auto-optimization for large photos
  const handleSecretImageSelect = useCallback(
    async (file: File, forceRaw = false) => {
      setRawSecretFile(file);
      setIsOptimizingSecretPhoto(true);

      try {
        const usableBudget = capacity?.usableBytes ?? 150 * 1024;
        const dims = await getImageDimensions(file);

        if (!forceRaw && autoScaleSecretPhoto && file.size > usableBudget * 0.8) {
          const opt =
            selectedMethod === 'stego-robust-resilient'
              ? await optimizeCovertPhotoForRobustMessaging(file, usableBudget)
              : await optimizeSecretPhoto(file, usableBudget);
          setSecretImageFile(opt.file);
          setSecretImageBytes(opt.bytes);
          setSecretImageDims({ width: opt.width, height: opt.height });
          const optUrl = URL.createObjectURL(opt.file);
          setSecretImagePreview((prev) => {
            revokeTrackedUrl(prev);
            return registerTrackedUrl(optUrl);
          });
          setOptimizedSecretMeta({ originalSize: opt.originalSize, newSize: opt.newSize });
        } else {
          const buf = await file.arrayBuffer();
          const bytes = new Uint8Array(buf);
          setSecretImageFile(file);
          setSecretImageBytes(bytes);
          setSecretImageDims(dims);
          const rawUrl = URL.createObjectURL(file);
          setSecretImagePreview((prev) => {
            revokeTrackedUrl(prev);
            return registerTrackedUrl(rawUrl);
          });
          setOptimizedSecretMeta(null);
        }
      } finally {
        setIsOptimizingSecretPhoto(false);
      }
    },
    [autoScaleSecretPhoto, capacity, registerTrackedUrl, revokeTrackedUrl, selectedMethod],
  );

  const handleToggleSecretPhotoOptimization = useCallback(async () => {
    if (!rawSecretFile) return;
    const nextState = !autoScaleSecretPhoto;
    setAutoScaleSecretPhoto(nextState);
    await handleSecretImageSelect(rawSecretFile, !nextState);
  }, [rawSecretFile, autoScaleSecretPhoto, handleSecretImageSelect]);

  // Compute estimated payload size
  const rawPayloadBytes = useMemo(() => {
    if (payloadMode === 'image') {
      if (!secretImageBytes || !secretImageFile) return new Uint8Array(0);
      return packFilePayload(secretImageBytes, {
        name: secretImageFile.name,
        mime: secretImageFile.type || 'image/png',
        size: secretImageBytes.length,
        width: secretImageDims?.width,
        height: secretImageDims?.height,
      });
    }
    return new TextEncoder().encode(payloadText);
  }, [payloadMode, secretImageBytes, secretImageFile, secretImageDims, payloadText]);

  const [compressedPayloadBytes, setCompressedPayloadBytes] = useState<Uint8Array | null>(null);
  const [compressionSavings, setCompressionSavings] = useState<{
    original: number;
    compressed: number;
    percent: number;
  } | null>(null);

  useEffect(() => {
    let active = true;
    if (rawPayloadBytes.length === 0) {
      setCompressedPayloadBytes(null);
      setCompressionSavings(null);
      return;
    }
    const timer = setTimeout(() => {
      smartCompress(rawPayloadBytes).then(({ data, compressed, savedBytes }) => {
        if (!active) return;
        if (compressed) {
          setCompressedPayloadBytes(data);
          const pct = Math.round((savedBytes / rawPayloadBytes.length) * 100);
          setCompressionSavings({
            original: rawPayloadBytes.length,
            compressed: data.length,
            percent: pct,
          });
        } else {
          setCompressedPayloadBytes(rawPayloadBytes);
          setCompressionSavings(null);
        }
      });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [rawPayloadBytes]);

  const activePayloadBytes = compressedPayloadBytes ?? rawPayloadBytes;
  let effectivePayloadLength = activePayloadBytes.length;
  if (isChameleonEnabled) {
    const decoyBytesLength = new TextEncoder().encode(decoyText).length;
    effectivePayloadLength += decoyBytesLength + 28; // 28-byte Chameleon container header & MAC tags
  } else if (passphrase.trim()) {
    effectivePayloadLength += 48; // 48-byte OMBPASS1 container header + nonce + Poly1305 MAC
  }
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

  // 1-Click Auto-Scale Carrier to Fit Payload
  const handleAutoScaleCarrier = useCallback(() => {
    if (!carrierImageData || !capacity) return;
    const currentW = carrierImageData.width;
    const currentH = carrierImageData.height;
    const aspectRatio = currentW / currentH;

    // Bits needed: effectivePayloadLength * 8 + 64 bytes overhead
    const bitsNeeded = (effectivePayloadLength + 64) * 8;
    // Target pixels: at 3 channels/pixel with 1.25 safe buffer so capacity is ~75% utilized
    const targetPixels = Math.ceil((bitsNeeded / 3) * 1.25);

    // Compute new dimensions keeping aspect ratio
    const newW = Math.max(currentW, Math.ceil(Math.sqrt(targetPixels * aspectRatio)));
    const newH = Math.max(currentH, Math.ceil(targetPixels / newW));

    const canvas = document.createElement('canvas');
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = currentW;
    tempCanvas.height = currentH;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    tempCtx.putImageData(carrierImageData, 0, 0);

    ctx.drawImage(tempCanvas, 0, 0, newW, newH);
    const scaledImgData = ctx.getImageData(0, 0, newW, newH);
    for (let i = 3; i < scaledImgData.data.length; i += 4) {
      scaledImgData.data[i] = 255;
    }

    setCarrierImageData(scaledImgData);
    const newCap = computeMethodCapacity(selectedMethod, {
      width: newW,
      height: newH,
      data: scaledImgData.data,
    });
    setCapacity(newCap);

    canvas.toBlob((blob) => {
      if (blob) {
        setCarrierPreview(URL.createObjectURL(blob));
      }
    }, 'image/png');
  }, [carrierImageData, capacity, effectivePayloadLength, selectedMethod]);

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
      let corePayload = activePayloadBytes;

      if (isChameleonEnabled) {
        if (!passphrase.trim()) {
          throw new Error(
            'Primary Passkey is required as the Master Key for Chameleon Dual-Layer steganography.',
          );
        }
        if (!decoyPassphrase.trim()) {
          throw new Error('Decoy Passkey is required for Chameleon Dual-Layer steganography.');
        }
        if (passphrase.trim() === decoyPassphrase.trim()) {
          throw new Error(
            'Primary Passkey and Decoy Passkey must be different to establish plausible deniability.',
          );
        }
        const decoyBytes = new TextEncoder().encode(
          decoyText.trim() || 'No decoy notes available.',
        );
        corePayload = packChameleonContainer(
          activePayloadBytes,
          passphrase.trim(),
          decoyBytes,
          decoyPassphrase.trim(),
        );
      } else if (passphrase.trim()) {
        // Encrypt payload with the user's Passkey or 32-Byte Token using authenticated XSalsa20-Poly1305
        corePayload = encryptWithPasskey(corePayload, passphrase.trim());
      }

      let payloadToEmbed: Uint8Array;

      if (useEnvelope) {
        // Construct canonical OMB1 Envelope
        const randomMsgId = new Uint8Array(16);
        crypto.getRandomValues(randomMsgId);

        let payloadData: Uint8Array = corePayload;
        let recipientKeyId: Uint8Array | undefined;

        if (cryptoSuite === 'X25519_XSALSA20_POLY1305') {
          let rawKey = recipientPublicKeyBase64.trim();
          if (!rawKey && activeIdentity?.encryptionKeyPair?.publicKey) {
            rawKey = activeIdentity.encryptionKeyPair.publicKey;
          }
          if (!rawKey) {
            throw new Error(
              'Recipient encryption public key is required for Sealed Box, or switch Encryption Mode to "Unencrypted / Passkey-Secured Payload".',
            );
          }
          const recPkBytes = parseAnyKey32(rawKey);
          if (recPkBytes.length !== 32) {
            throw new Error('Recipient public key must resolve to 32 bytes.');
          }
          payloadData = seal(corePayload, recPkBytes);
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
        payloadToEmbed = corePayload;
      }

      const stegoCarrier = await workerClientRef.current.embed(
        {
          width: carrierImageData.width,
          height: carrierImageData.height,
          data: carrierImageData.data,
        },
        payloadToEmbed,
        {
          methodId: selectedMethod,
          passphrase: passphrase.trim() || undefined,
        },
        controller.signal,
        (p) => setEmbedProgress(Math.round(p * 100)),
      );

      // Calculate empirical PSNR & MSE using worker-computed metrics to prevent main-thread lag
      if (stegoCarrier.metrics) {
        setMse(stegoCarrier.metrics.mse);
        setPsnr(stegoCarrier.metrics.psnr);
      } else {
        let sumSq = 0;
        const totalBytes = carrierImageData.data.length;
        const step = totalBytes > 1000000 ? 16 : 1;
        let sampled = 0;
        for (let i = 0; i < totalBytes; i += step) {
          const d = (carrierImageData.data[i] ?? 0) - (stegoCarrier.data[i] ?? 0);
          sumSq += d * d;
          sampled++;
        }
        const calculatedMse = sumSq / sampled;
        const calculatedPsnr =
          calculatedMse === 0 ? 99.9 : 10 * Math.log10((255 * 255) / calculatedMse);
        setMse(Math.round(calculatedMse * 10000) / 10000);
        setPsnr(Math.round(calculatedPsnr * 10) / 10);
      }

      // Bit-exact lossless PNG encoding (bypasses canvas toBlob & GPU color conversion)
      const pngBytes = await encodePngAsync(stegoCarrier);
      const blob = new Blob([pngBytes as unknown as BlobPart], { type: 'image/png' });
      embeddedBlobRef.current = blob;
      const url = URL.createObjectURL(blob);
      setEmbeddedImageUrl((prev) => {
        revokeTrackedUrl(prev);
        return registerTrackedUrl(url);
      });
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
    setExtractedSecretFile((prev) => {
      if (prev?.blobUrl) revokeTrackedUrl(prev.blobUrl);
      return null;
    });
    setExtractedEnvelope(null);
    setUnlockedChameleonLayer(null);
    setDecryptionStatus(null);
    setSignatureStatus('none');
    setVerifiedContactName(null);
    setExtractError(null);
    setDetectedMethodName(null);

    const previewUrl = URL.createObjectURL(file);
    setRevealPreview((prev) => {
      revokeTrackedUrl(prev);
      return registerTrackedUrl(previewUrl);
    });

    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    if (isPng) {
      try {
        const buffer = new Uint8Array(await file.arrayBuffer());
        const result = validatePngOrThrow(buffer, HIGH_CAPACITY_PNG_LIMITS);
        setRevealValidation(result);
      } catch (_err: unknown) {
        // Non-standard chunks, allow canvas decoding anyway
      }
    }
  };

  // Execute Extraction
  const handleExtract = async () => {
    if (!revealFile || !revealPreview || !workerClientRef.current) return;
    setIsExtracting(true);
    setExtractProgress(0);
    setExtractError(null);
    setExtractedPayloadText(null);
    setExtractedSecretFile(null);
    setExtractedEnvelope(null);
    setUnlockedChameleonLayer(null);
    setDecryptionStatus(null);
    setSignatureStatus('none');
    setVerifiedContactName(null);
    setDetectedMethodName(null);

    const controller = new AbortController();
    extractAbortRef.current = controller;

    try {
      if (!revealFile) throw new Error('Please select a stego carrier image first.');
      const carrierImg = await loadCarrierImageLossless(revealFile);

      const extractedBytes = await workerClientRef.current.extract(
        {
          width: carrierImg.width,
          height: carrierImg.height,
          data: carrierImg.data,
        },
        {
          methodId: revealMethod,
          passphrase: revealPassphrase.trim() || undefined,
        },
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
        setDetectedMethodName('OMB1 Envelope (Legacy Sequential LSB / Sealed Box)');
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

        let contentBytes = plaintextBytes;

        // Check if payload is encrypted with Passkey / 32-Byte Token
        if (isPasskeyEncrypted(contentBytes)) {
          if (!revealPassphrase.trim()) {
            setDecryptionStatus('failed');
            throw new Error(
              'Payload is locked with a Passkey / 32-Byte Token. Please enter your passkey or token above and extract.',
            );
          }
          try {
            contentBytes = decryptWithPasskey(contentBytes, revealPassphrase.trim());
            setDecryptionStatus('passkey_decrypted');
          } catch (passErr: unknown) {
            setDecryptionStatus('failed');
            throw new Error(
              passErr instanceof Error
                ? passErr.message
                : 'Incorrect passkey or 32-byte token. Poly1305 MAC verification failed.',
            );
          }
        }

        if (isChameleonContainer(contentBytes)) {
          if (!revealPassphrase.trim()) {
            throw new Error(
              'Chameleon Dual-Layer container detected. A passkey (Master or Decoy) is required to unlock the embedded payload.',
            );
          }
          const cham = unpackChameleonContainer(contentBytes, revealPassphrase.trim());
          setUnlockedChameleonLayer(cham.layer);
          contentBytes = cham.data;
        } else {
          setUnlockedChameleonLayer(null);
        }

        const restoredBytes = await smartDecompress(contentBytes);
        const secretFile = unpackFilePayload(restoredBytes);
        if (secretFile) {
          registerTrackedUrl(secretFile.blobUrl);
          setExtractedSecretFile((prev) => {
            if (prev?.blobUrl) revokeTrackedUrl(prev.blobUrl);
            return secretFile;
          });
          setExtractedPayloadText(null);
        } else {
          setExtractedSecretFile((prev) => {
            if (prev?.blobUrl) revokeTrackedUrl(prev.blobUrl);
            return null;
          });
          setExtractedPayloadText(new TextDecoder().decode(restoredBytes));
        }

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
        // OMBRIX Quad-Hybrid / Stealth Matrix Payload
        setDetectedMethodName('OMBRIX Hyper-Matrix (Quad-Hybrid Frequency & Edge Scattered)');
        setDecryptionStatus('decrypted');
        setSignatureStatus('none');

        let contentBytes = extractedBytes;

        // Check if payload is encrypted with Passkey / 32-Byte Token
        if (isPasskeyEncrypted(contentBytes)) {
          if (!revealPassphrase.trim()) {
            setDecryptionStatus('failed');
            throw new Error(
              'Payload is locked with a Passkey / 32-Byte Token. Please enter your passkey or token above and extract.',
            );
          }
          try {
            contentBytes = decryptWithPasskey(contentBytes, revealPassphrase.trim());
            setDecryptionStatus('passkey_decrypted');
          } catch (passErr: unknown) {
            setDecryptionStatus('failed');
            throw new Error(
              passErr instanceof Error
                ? passErr.message
                : 'Incorrect passkey or 32-byte token. Poly1305 MAC verification failed.',
            );
          }
        }

        if (isChameleonContainer(contentBytes)) {
          if (!revealPassphrase.trim()) {
            throw new Error(
              'Chameleon Dual-Layer container detected. A passkey (Master or Decoy) is required to unlock the embedded payload.',
            );
          }
          const cham = unpackChameleonContainer(contentBytes, revealPassphrase.trim());
          setUnlockedChameleonLayer(cham.layer);
          contentBytes = cham.data;
        } else {
          setUnlockedChameleonLayer(null);
        }

        const restoredBytes = await smartDecompress(contentBytes);
        const secretFile = unpackFilePayload(restoredBytes);
        if (secretFile) {
          registerTrackedUrl(secretFile.blobUrl);
          setExtractedSecretFile((prev) => {
            if (prev?.blobUrl) revokeTrackedUrl(prev.blobUrl);
            return secretFile;
          });
          setExtractedPayloadText(null);
        } else {
          setExtractedSecretFile((prev) => {
            if (prev?.blobUrl) revokeTrackedUrl(prev.blobUrl);
            return null;
          });
          setExtractedPayloadText(new TextDecoder().decode(restoredBytes));
        }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0F172A]/85 backdrop-blur-xl border border-white/[0.08] shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-bold font-['Sora'] text-white tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-violet-400" />
              <span>OMBRIX Steganography Engine</span>
            </h2>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Undetectable Stealth • 100% Client-Side</span>
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Carrier-grade steganographic concealment with cryptographic scattering, edge-adaptive
            masking, and ±1 LSB matching.
          </p>
        </div>

        {/* Primary Studio Controls: Security Badge, Mode Switcher, & Zeroize RAM */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto shrink-0">
          {/* Security Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Argon2id Salted • Zero-Leakage</span>
          </div>

          {/* Primary Studio Segmented Controller */}
          <div
            className="inline-flex p-1 rounded-xl bg-[#0B0F19] border border-white/[0.08] shadow-inner"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'hide'}
              onClick={() => {
                setActiveTab('hide');
                studioDataBus.setCoreTab('hide');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'hide'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <EyeOff className="w-4 h-4 text-violet-300" />
              <span>Hide Secret (Encode)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'reveal'}
              onClick={() => {
                setActiveTab('reveal');
                studioDataBus.setCoreTab('reveal');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'reveal'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Eye className="w-4 h-4 text-sky-300" />
              <span>Reveal Secret (Decode)</span>
            </button>
          </div>

          {/* Zeroize RAM / Panic Scrub Button */}
          <button
            type="button"
            onClick={handlePanicZeroize}
            title="Forensic RAM Zeroization: Instantly wipes all in-memory carrier and payload buffers and purges object URLs"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-rose-500/30 text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 transition-all shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Zeroize RAM</span>
          </button>
        </div>
      </div>

      {/* Forensic Memory Scrubbed Alert Toast */}
      {memoryScrubbedToast && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-200 shadow-lg">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Forensic Memory Zeroized: All carrier buffers, decrypted secrets, and object URLs have
            been wiped from RAM.
          </span>
        </div>
      )}

      {/* Mode Content */}
      {activeTab === 'hide' ? (
        <div className="space-y-6">
          {/* Main 2-Column Studio Grid: Balanced Left & Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: Assets & Inputs Workshop */}
            <div className="lg:col-span-6 space-y-5">
              {/* Card 1: Carrier Cover Image */}
              <div className="p-5 rounded-2xl bg-[#0F172A]/85 backdrop-blur-xl border border-white/[0.08] shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-violet-400" />
                    <span>1. Carrier Image (Cover)</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    {carrierImageData && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleGenerateGhostCarrier();
                      }}
                      disabled={isGeneratingGhost}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1E293B] hover:bg-[#334155] border border-white/[0.08] text-xs font-medium text-slate-200 transition-colors"
                      title="Generate untraceable procedural carrier"
                    >
                      {isGeneratingGhost ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                          <span>Synthesizing...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3 h-3 text-violet-400" />
                          <span>Ghost-Gen Carrier</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Dropzone */}
                <label
                  htmlFor="carrier-input"
                  className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    carrierPreview
                      ? 'border-violet-500/40 bg-[#0B0F19]'
                      : 'border-slate-700/70 hover:border-violet-500/70 bg-[#0B0F19]/60 hover:bg-[#0B0F19]'
                  }`}
                >
                  {carrierPreview ? (
                    <div className="relative w-full max-h-56 flex items-center justify-center overflow-hidden rounded-lg">
                      <img
                        src={carrierPreview}
                        alt="Carrier Preview"
                        className="max-h-56 object-contain rounded-lg shadow-md"
                      />
                    </div>
                  ) : (
                    <div className="text-center space-y-3">
                      <div className="w-10 h-10 mx-auto rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm text-slate-200 font-medium">
                          Select or drop carrier image (PNG, JPG, WEBP, BMP)
                        </div>
                        <div className="text-xs text-slate-400">
                          Lossless RGB raster conversion with automatic capacity analysis
                        </div>
                      </div>
                      {/* Procedural Ghost Chips */}
                      <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          Or synthesize zero-provenance carrier:
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {(['nebula', 'cyber', 'quantum', 'aurora'] as const).map((theme) => (
                            <button
                              key={theme}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleGenerateGhostCarrier(theme);
                              }}
                              className="px-2.5 py-1 rounded-md bg-[#131B2E] hover:bg-[#1E293B] border border-white/[0.08] text-[11px] text-slate-300 capitalize transition-colors"
                            >
                              {theme}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <input
                    id="carrier-input"
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp, image/bmp"
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

                {/* Carrier Specs Grid */}
                {carrierImageData && capacity && (
                  <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Carrier Specifications
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-[#0B0F19] border border-white/[0.06]">
                        <div className="text-[10px] text-slate-400">Dimensions</div>
                        <div className="font-mono text-white font-semibold">
                          {carrierImageData.width} × {carrierImageData.height}
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0B0F19] border border-white/[0.06]">
                        <div className="text-[10px] text-slate-400">Pixels</div>
                        <div className="font-mono text-white font-semibold">
                          {(carrierImageData.width * carrierImageData.height).toLocaleString()}
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0B0F19] border border-white/[0.06]">
                        <div className="text-[10px] text-slate-400">Usable Capacity</div>
                        <div className="font-mono text-emerald-400 font-semibold">
                          {capacity.usableBytes.toLocaleString()} B
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0B0F19] border border-white/[0.06]">
                        <div className="text-[10px] text-slate-400">Format</div>
                        <div className="font-mono text-slate-300 font-semibold truncate">
                          {validationResult?.colorTypeName || 'RGBA Raster'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2: Secret Payload Input */}
              <div className="p-5 rounded-2xl bg-[#0F172A]/85 backdrop-blur-xl border border-white/[0.08] shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-400" />
                    <span>2. Secret Payload</span>
                  </h3>
                  <div className="inline-flex p-0.5 rounded-lg bg-[#0B0F19] border border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => setPayloadMode('text')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        payloadMode === 'text'
                          ? 'bg-violet-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Text</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayloadMode('image')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        payloadMode === 'image'
                          ? 'bg-violet-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Secret Image</span>
                    </button>
                  </div>
                </div>

                {payloadMode === 'text' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Confidential Message</span>
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        {compressionSavings && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            -{compressionSavings.percent}% compressed
                          </span>
                        )}
                        <span className="text-slate-300">
                          {rawPayloadBytes.length.toLocaleString()} bytes
                        </span>
                      </div>
                    </div>
                    <textarea
                      id="payload-textarea"
                      value={payloadText}
                      onChange={(e) => setPayloadText(e.target.value)}
                      rows={4}
                      className="w-full p-3 rounded-xl bg-[#0B0F19] border border-white/[0.08] text-slate-200 text-xs font-mono focus:outline-none focus:border-violet-500/70 focus:ring-1 focus:ring-violet-500/40 resize-y min-h-[96px] max-h-[260px]"
                      placeholder="Enter secret message to conceal..."
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Covert Image to Embed</span>
                      {secretImageBytes && (
                        <span className="font-mono text-emerald-400 font-semibold text-[11px]">
                          {(secretImageBytes.length / 1024).toFixed(1)} KB
                          {secretImageDims
                            ? ` • ${secretImageDims.width}×${secretImageDims.height}`
                            : ''}
                        </span>
                      )}
                    </div>

                    {secretImagePreview ? (
                      <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-white/[0.08] space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={secretImagePreview}
                              alt="Secret Preview"
                              className="w-14 h-14 object-cover rounded-lg border border-slate-700 shrink-0 shadow"
                            />
                            <div className="min-w-0 space-y-0.5">
                              <div className="text-xs font-medium text-white truncate">
                                {secretImageFile?.name}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {(secretImageBytes ? secretImageBytes.length / 1024 : 0).toFixed(1)}{' '}
                                KB •{' '}
                                {secretImageDims
                                  ? `${secretImageDims.width}×${secretImageDims.height} px`
                                  : ''}
                              </div>
                              {optimizedSecretMeta && (
                                <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/30">
                                    Auto-fit: -
                                    {Math.round(
                                      ((optimizedSecretMeta.originalSize -
                                        optimizedSecretMeta.newSize) /
                                        optimizedSecretMeta.originalSize) *
                                        100,
                                    )}
                                    %
                                  </span>
                                  <span className="text-slate-500">
                                    ({(optimizedSecretMeta.originalSize / 1024).toFixed(0)} KB →{' '}
                                    {(optimizedSecretMeta.newSize / 1024).toFixed(0)} KB)
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSecretImageFile(null);
                              setSecretImageBytes(null);
                              setSecretImagePreview(null);
                              setSecretImageDims(null);
                              setRawSecretFile(null);
                              setOptimizedSecretMeta(null);
                            }}
                            className="px-2.5 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                          >
                            Remove
                          </button>
                        </div>

                        {/* Smart Optimization Switch */}
                        {rawSecretFile && (
                          <div className="pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-xs">
                            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                              <input
                                type="checkbox"
                                checked={autoScaleSecretPhoto}
                                onChange={handleToggleSecretPhotoOptimization}
                                disabled={isOptimizingSecretPhoto}
                                className="rounded bg-[#111827] border-slate-700 text-violet-600 focus:ring-violet-600"
                              />
                              <span className="text-[11px]">
                                Auto-Fit Photo to Carrier Capacity
                              </span>
                            </label>
                            {isOptimizingSecretPhoto && (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-700 hover:border-violet-500/70 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-[#0B0F19]/60 hover:bg-[#0B0F19]">
                        <ImageIcon className="w-7 h-7 text-violet-400" />
                        <span className="text-xs font-semibold text-slate-200">
                          Select or drop secret image to embed
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Large photos automatically scaled &amp; optimized to fit carrier
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleSecretImageSelect(f);
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* Card 3: Capacity Utilization Meter & Auto-Scale */}
              {capacity && (
                <div className="p-4 rounded-2xl bg-[#0F172A]/85 backdrop-blur-xl border border-white/[0.08] shadow-xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Carrier Capacity Budget</span>
                    <span
                      className={`font-mono font-semibold text-xs ${
                        capacityUsedPercent > 90 ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {effectivePayloadLength.toLocaleString()} /{' '}
                      {capacity.usableBytes.toLocaleString()} bytes ({capacityUsedPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#0B0F19] overflow-hidden border border-white/[0.04]">
                    <div
                      className={`h-full transition-all duration-300 ${
                        capacityUsedPercent > 90
                          ? 'bg-red-500'
                          : capacityUsedPercent > 50
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${capacityUsedPercent}%` }}
                    />
                  </div>
                  {/* Auto-Scale Suggestion if payload exceeds capacity */}
                  {carrierImageData && effectivePayloadLength > capacity.usableBytes && (
                    <div className="pt-2 flex items-center justify-between gap-3 text-xs">
                      <div className="text-red-400 text-[11px]">
                        Payload exceeds capacity by{' '}
                        {(effectivePayloadLength - capacity.usableBytes).toLocaleString()} bytes.
                      </div>
                      <button
                        type="button"
                        onClick={handleAutoScaleCarrier}
                        className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center gap-1.5 shrink-0"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Auto-Scale Carrier</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Steganography Engine, Security & Execution */}
            <div className="lg:col-span-6 space-y-5">
              {/* Card 1: Steganography Engine Selector */}
              <div className="p-5 rounded-2xl bg-[#0F172A]/85 backdrop-blur-xl border border-white/[0.08] shadow-xl space-y-3.5">
                <div className="flex items-center justify-between text-xs">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-violet-400" />
                    <span>3. Steganography Engine</span>
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono">
                    ±1 LSB Undetectable
                  </span>
                </div>

                {/* Flagship Option: Hyper-Matrix */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('stego-hyper-matrix')}
                  className={`w-full p-3.5 rounded-xl text-left border transition-all ${
                    selectedMethod === 'stego-hyper-matrix'
                      ? 'bg-violet-600/15 border-violet-500/70 ring-1 ring-violet-500/30'
                      : 'bg-[#0B0F19] border-white/[0.06] hover:border-white/[0.15]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">Hyper-Matrix</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-mono">
                        Quad-Hybrid
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
                      Recommended
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Wavelet frequency + edge masking + PRNG scatter + ±1 matching
                  </div>
                </button>

                {/* Flagship WhatsApp-Safe Option: Robust Messaging */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('stego-robust-resilient')}
                  className={`w-full p-3.5 rounded-xl text-left border transition-all ${
                    selectedMethod === 'stego-robust-resilient'
                      ? 'bg-emerald-600/15 border-emerald-500/70 ring-1 ring-emerald-500/30'
                      : 'bg-[#0B0F19] border-white/[0.06] hover:border-white/[0.15]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">Robust Messaging</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                        WhatsApp &amp; Social Safe
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                      JPEG Resilient
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Block differential modulation + 5x FEC (Survives WhatsApp compression &amp;
                    noise)
                  </div>
                </button>

                {/* Specialized Engines Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('stego-stealth-matrix')}
                    className={`p-2.5 rounded-xl text-left border transition-all ${
                      selectedMethod === 'stego-stealth-matrix'
                        ? 'bg-emerald-500/15 border-emerald-500/70 ring-1 ring-emerald-500/30'
                        : 'bg-[#0B0F19] border-white/[0.06] hover:border-white/[0.15]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">Stealth Matrix</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                        ±1
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      PRNG scatter &amp; ±1 matching
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('stego-dwt')}
                    className={`p-2.5 rounded-xl text-left border transition-all ${
                      selectedMethod === 'stego-dwt'
                        ? 'bg-sky-500/15 border-sky-500/70 ring-1 ring-sky-500/30'
                        : 'bg-[#0B0F19] border-white/[0.06] hover:border-white/[0.15]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">Haar Wavelet</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-mono">
                        DWT
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Diagonal HH subband</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('stego-pvd')}
                    className={`p-2.5 rounded-xl text-left border transition-all ${
                      selectedMethod === 'stego-pvd'
                        ? 'bg-amber-500/15 border-amber-500/70 ring-1 ring-amber-500/30'
                        : 'bg-[#0B0F19] border-white/[0.06] hover:border-white/[0.15]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">PVD Differencing</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">
                        PVD
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Contrast-adaptive masking
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('png-lsb-sequential')}
                    className={`p-2.5 rounded-xl text-left border transition-all ${
                      selectedMethod === 'png-lsb-sequential'
                        ? 'bg-slate-700/30 border-slate-500 ring-1 ring-slate-500/30'
                        : 'bg-[#0B0F19] border-white/[0.06] hover:border-white/[0.15]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">Sequential LSB</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">
                        Raster
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Deterministic raster scan
                    </div>
                  </button>
                </div>

                {/* Technical defense status bar */}
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0B0F19] border border-white/[0.06] text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Defense:</span>
                    <span className="text-slate-200 font-medium">
                      {selectedMethod === 'stego-hyper-matrix'
                        ? 'Wavelet-PVD Hybrid + CSPRNG Permutation'
                        : selectedMethod === 'stego-robust-resilient'
                          ? 'Block Luminance Differential + 5x FEC (WhatsApp Safe)'
                          : selectedMethod === 'stego-stealth-matrix'
                            ? 'ChaCha20 Coordinate Scatter + ±1 Matching'
                            : selectedMethod === 'stego-dwt'
                              ? '2D Haar Integer HH Subband Isolation'
                              : selectedMethod === 'stego-pvd'
                                ? 'Human Visual System Range Masking'
                                : 'Sequential Raster Bit-Plane Scan'}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-sky-400">
                    {selectedMethod === 'stego-hyper-matrix'
                      ? 'PSNR >52 dB'
                      : selectedMethod === 'stego-robust-resilient'
                        ? 'WhatsApp Safe'
                        : selectedMethod === 'stego-stealth-matrix'
                          ? 'PSNR >50 dB'
                          : selectedMethod === 'stego-dwt'
                            ? 'Frequency'
                            : selectedMethod === 'stego-pvd'
                              ? 'Edge-Bound'
                              : 'Linear'}
                  </span>
                </div>
              </div>

              {/* Card 2: Passkey Protection */}
              <div className="p-5 rounded-2xl bg-[#0F172A]/85 backdrop-blur-xl border border-white/[0.08] shadow-xl">
                <SmartPasskeyAssistant
                  idPrefix="encode-passkey"
                  value={passphrase}
                  onChange={(newKey) => setPassphrase(newKey)}
                  mode="encode"
                  placeholder="Enter passkey, or pick Memorable Words, Photo Key, 32-Byte Token, or Biometrics..."
                />
              </div>

              {/* Card 3: Advanced Cryptography & Anti-Coercion (Progressive Disclosure Accordion) */}
              <div className="p-5 rounded-2xl bg-[#0F172A]/85 backdrop-blur-xl border border-white/[0.08] shadow-xl space-y-4">
                <button
                  type="button"
                  onClick={() => setIsAdvancedOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between text-left focus:outline-none cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-violet-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Advanced Security &amp; Anti-Coercion
                    </span>
                    {(isChameleonEnabled || cryptoSuite !== 'NONE' || !signMessage) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-mono">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span>{isAdvancedOpen ? 'Collapse' : 'Configure'}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isAdvancedOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {isAdvancedOpen && (
                  <div className="space-y-4 pt-3 border-t border-white/[0.06] text-xs">
                    {/* Chameleon Dual-Layer (Anti-Coercion Plausible Deniability) - DEDUPLICATED SINGLE INSTANCE */}
                    <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-white/[0.06] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-semibold text-slate-200">
                            Chameleon Dual-Layer (Anti-Coercion)
                          </span>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChameleonEnabled}
                            onChange={(e) => setIsChameleonEnabled(e.target.checked)}
                            className="rounded bg-[#111827] border-slate-700 text-amber-500 focus:ring-amber-500"
                          />
                          <span>Enable Deniability</span>
                        </label>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Embeds an authentic decoy payload. If forced to surrender a passkey under
                        duress, the decoy passkey reveals only the harmless decoy, leaving zero
                        mathematical trace of the master secret.
                      </p>

                      {isChameleonEnabled && (
                        <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                          <div className="space-y-1">
                            <label
                              htmlFor="decoy-payload-input"
                              className="text-slate-400 flex items-center justify-between text-[11px]"
                            >
                              <span>Decoy Message (Surrendered under Duress)</span>
                              <span className="font-mono text-slate-500">
                                {decoyText.length} chars
                              </span>
                            </label>
                            <textarea
                              id="decoy-payload-input"
                              value={decoyText}
                              onChange={(e) => setDecoyText(e.target.value)}
                              rows={2}
                              className="w-full p-2.5 rounded-lg bg-[#111827] border border-white/[0.08] text-slate-200 text-xs font-mono focus:outline-none focus:border-amber-500 resize-y"
                              placeholder="Enter harmless decoy message..."
                            />
                          </div>

                          <div className="space-y-1">
                            <label
                              htmlFor="decoy-passkey-input"
                              className="text-slate-400 block text-[11px]"
                            >
                              Decoy Passkey (Surrender this if coerced)
                            </label>
                            <input
                              id="decoy-passkey-input"
                              type="text"
                              value={decoyPassphrase}
                              onChange={(e) => setDecoyPassphrase(e.target.value)}
                              placeholder="Enter decoy passkey..."
                              className="w-full p-2 rounded-lg bg-[#111827] border border-white/[0.08] text-slate-200 text-xs font-mono focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* OMB1 Protocol & Libsodium Cryptography */}
                    <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-white/[0.06] space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
                          <span className="font-semibold text-slate-200">
                            Binary Envelope &amp; Cryptography
                          </span>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useEnvelope}
                            onChange={(e) => setUseEnvelope(e.target.checked)}
                            className="rounded bg-[#111827] border-slate-700 text-violet-600 focus:ring-violet-600"
                          />
                          <span>OMB1 Protocol Framing</span>
                        </label>
                      </div>

                      {useEnvelope && (
                        <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                          <div className="space-y-1">
                            <label
                              htmlFor="cipher-suite-select"
                              className="text-slate-400 block text-[11px]"
                            >
                              Encryption Mode
                            </label>
                            <select
                              id="cipher-suite-select"
                              value={cryptoSuite}
                              onChange={(e) => setCryptoSuite(e.target.value as CryptoSuite)}
                              className="w-full p-2 rounded-lg bg-[#111827] border border-white/[0.08] text-slate-200 text-xs focus:outline-none focus:border-violet-500"
                            >
                              <option value="NONE">
                                Passkey / Stego-Symmetric Direct (Recommended with Passkey)
                              </option>
                              <option value="X25519_XSALSA20_POLY1305">
                                Libsodium Sealed Box (X25519) — Recipient Vault Public Key
                              </option>
                            </select>
                          </div>

                          {/* Recipient Selection for Sealed Box */}
                          {cryptoSuite === 'X25519_XSALSA20_POLY1305' && (
                            <div className="space-y-2 p-2.5 rounded-lg bg-[#111827] border border-white/[0.08]">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-200 font-medium flex items-center gap-1.5 text-[11px]">
                                  <Lock className="w-3.5 h-3.5 text-sky-400" />
                                  <span>Recipient Key</span>
                                </span>
                                {contacts.length > 0 && (
                                  <select
                                    value={selectedRecipientId}
                                    onChange={(e) => {
                                      setSelectedRecipientId(e.target.value);
                                      const found = contacts.find((c) => c.id === e.target.value);
                                      if (found) setRecipientPublicKeyBase64(found.encPublicKey);
                                    }}
                                    className="text-[10px] p-1 rounded bg-[#0B0F19] border border-slate-700 text-slate-400"
                                  >
                                    <option value="custom">Manual Key</option>
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
                                placeholder="Paste recipient 32-byte key (Base64, Hex, or 32-Byte Token)..."
                                className="w-full p-2 rounded bg-[#0B0F19] border border-white/[0.08] text-slate-200 font-mono text-[11px] focus:outline-none focus:border-sky-500"
                              />
                            </div>
                          )}

                          {/* Sender Detached Signature */}
                          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#111827] border border-white/[0.08]">
                            <input
                              type="checkbox"
                              id="sign-toggle"
                              checked={signMessage}
                              onChange={(e) => setSignMessage(e.target.checked)}
                              className="mt-0.5 rounded bg-[#0B0F19] border-slate-700 text-violet-600 focus:ring-violet-600"
                            />
                            <label
                              htmlFor="sign-toggle"
                              className="text-xs text-slate-300 cursor-pointer"
                            >
                              <div className="font-medium text-white flex items-center gap-1.5 text-[11px]">
                                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Attach Sender Ed25519 Detached Signature</span>
                              </div>
                              <div className="text-[10px] text-slate-400 pt-0.5">
                                Signs canonical SignDoc with active Vault identity (
                                <span className="text-violet-400 font-mono">
                                  {activeIdentity?.name || 'Active Identity'}
                                </span>
                                ) for provenance verification.
                              </div>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Card 4: Action Button */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleEmbed}
                    disabled={
                      !carrierImageData ||
                      isEmbedding ||
                      Boolean(validationError) ||
                      (payloadMode === 'image' && !secretImageBytes) ||
                      (Boolean(capacity) && effectivePayloadLength > (capacity?.usableBytes ?? 0))
                    }
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
                  >
                    {isEmbedding ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Embedding in Worker ({embedProgress}%)...</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-4 h-4" />
                        <span>Embed &amp; Conceal Payload</span>
                      </>
                    )}
                  </button>

                  {isEmbedding && (
                    <button
                      type="button"
                      onClick={() => embedAbortRef.current?.abort()}
                      className="px-4 py-3 rounded-xl bg-[#1E293B] hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-white/[0.08] transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {embedError && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{embedError}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stego Output Inspection Card (When embedded) */}
          {embeddedImageUrl && (
            <div className="p-6 rounded-2xl bg-[#0F172A]/90 backdrop-blur-xl border border-emerald-500/30 shadow-2xl space-y-5 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      Steganographic Concealment Complete
                    </h4>
                    <p className="text-xs text-slate-400">
                      Pristine lossless raster with concealed payload. Zero humanly perceivable
                      distortion.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {selectedMethod === 'stego-hyper-matrix'
                      ? 'Hyper-Matrix (Quad-Hybrid)'
                      : selectedMethod === 'stego-robust-resilient'
                        ? 'Robust Messaging (WhatsApp Safe)'
                        : selectedMethod === 'stego-stealth-matrix'
                          ? 'Stealth Matrix (±1)'
                          : selectedMethod === 'stego-dwt'
                            ? 'Haar DWT Wavelet'
                            : selectedMethod === 'stego-pvd'
                              ? 'PVD Differencing'
                              : 'Sequential RGB LSB'}
                  </span>
                </div>
              </div>

              {/* Interactive Split Comparison Slider */}
              {carrierPreview && (
                <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-[#0B0F19] p-3">
                  <SplitComparisonSlider
                    originalUrl={carrierPreview}
                    stegoUrl={embeddedImageUrl}
                    psnr={psnr}
                    mse={mse}
                  />
                </div>
              )}

              {/* Download & Verification Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRevealPreview(embeddedImageUrl);
                      setRevealFile(new File([], 'stego-output.png'));
                      setRevealPassphrase(passphrase);
                      setActiveTab('reveal');
                      studioDataBus.setCoreTab('reveal');
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Test Reveal in 1-Click</span>
                  </button>
                  <a
                    href={embeddedImageUrl}
                    download={`ombrix-stego-${Date.now()}.png`}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Stego PNG</span>
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!embeddedImageUrl) return;
                      try {
                        const blob = embeddedBlobRef.current;
                        if (blob) {
                          const file = new File([blob], `ombrix-carrier-${Date.now()}.png`, {
                            type: 'image/png',
                          });
                          if (navigator.canShare?.({ files: [file] })) {
                            await navigator.share({
                              title: 'OMBRIX Steganographic Carrier',
                              text: 'OMBRIX secure carrier. Send as Document in WhatsApp to preserve lossless steganography.',
                              files: [file],
                            });
                            return;
                          }
                        }
                      } catch {
                        // ignore cancelled share
                      }
                      // Fallback: download with document filename
                      const a = document.createElement('a');
                      a.href = embeddedImageUrl;
                      a.download = `ombrix-doc-carrier-${Date.now()}.png`;
                      a.click();
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share to WhatsApp / Mobile</span>
                  </button>
                </div>

                {/* Cross-Studio Forensic Handoff Bar */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-medium text-slate-400 mr-1">Handoff:</span>
                  <button
                    type="button"
                    onClick={() => {
                      studioDataBus.sendCarrierToModule('lens', {
                        dataUrl: embeddedImageUrl,
                        name: 'stego-embedded.png',
                        source: 'core-studio',
                      });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-[#1E293B] border border-white/[0.08] text-[11px] text-slate-300 transition-colors"
                  >
                    <ZoomIn className="w-3.5 h-3.5 text-sky-400" />
                    <span>Visual Lens</span>
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-[#1E293B] border border-white/[0.08] text-[11px] text-slate-300 transition-colors"
                  >
                    <Radar className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Forensic Scan</span>
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-[#1E293B] border border-white/[0.08] text-[11px] text-slate-300 transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5 text-violet-400" />
                    <span>Optical Air-Gap</span>
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-[#1E293B] border border-white/[0.08] text-[11px] text-slate-300 transition-colors"
                  >
                    <Radio className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Transit &amp; Trace</span>
                  </button>
                </div>
              </div>

              {/* WhatsApp & Social Media Transmission Guidance Callout */}
              <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/20 text-xs flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                  <Share2 className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span>Sending to Phone via WhatsApp or Telegram?</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                      Safe Transfer Tip
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    WhatsApp automatically recompresses standard photos and strips steganographic
                    bits. To preserve 100% lossless quality, attach as a{' '}
                    <strong className="text-emerald-300">Document</strong> (tap{' '}
                    <span className="font-mono bg-white/10 px-1 py-0.5 rounded text-white">
                      📎 ➔ Document
                    </span>{' '}
                    instead of Gallery/Photo). If sending as a normal photo, choose{' '}
                    <strong className="text-violet-300">Robust Messaging Mode</strong> above.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* REVEAL (DECODE) TAB - Balanced 2-Column Studio */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Carrier Ingestion & Keys */}
          <div className="lg:col-span-6 space-y-5">
            <div className="p-5 rounded-2xl bg-[#0F172A]/85 backdrop-blur-xl border border-white/[0.08] shadow-xl space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-sky-400" />
                <span>1. Upload Stego Carrier Image</span>
              </h3>

              <label
                htmlFor="reveal-input"
                className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  revealPreview
                    ? 'border-sky-500/40 bg-[#0B0F19]'
                    : 'border-slate-700/70 hover:border-sky-500/70 bg-[#0B0F19]/60 hover:bg-[#0B0F19]'
                }`}
              >
                {revealPreview ? (
                  <img
                    src={revealPreview}
                    alt="Stego Candidate"
                    className="max-h-56 object-contain rounded-lg shadow-md"
                  />
                ) : (
                  <div className="text-center space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                      <Eye className="w-5 h-5" />
                    </div>
                    <div className="text-sm text-slate-200 font-medium">
                      Select or drop stego carrier image (PNG, JPG, WEBP, BMP)
                    </div>
                    <div className="text-xs text-slate-400">
                      Universal decoder with automatic algorithm detection &amp; signature
                      verification
                    </div>
                  </div>
                )}
                <input
                  id="reveal-input"
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp, image/bmp"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleRevealSelect(f);
                  }}
                />
              </label>

              {revealValidationError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{revealValidationError}</span>
                </div>
              )}

              {/* Extraction Algorithm Selector (Auto-Detect Default + Manual Override) */}
              <div className="space-y-1.5 p-3.5 rounded-xl bg-[#0B0F19] border border-white/[0.06]">
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="reveal-method-select"
                    className="text-slate-400 flex items-center gap-1.5"
                  >
                    <Layers className="w-3.5 h-3.5 text-sky-400" />
                    <span>Steganography Algorithm</span>
                  </label>
                  <span className="text-[10px] font-mono text-sky-400">
                    {revealMethod === 'auto' ? 'Auto-Detect' : 'Manual Lock'}
                  </span>
                </div>
                <select
                  id="reveal-method-select"
                  value={revealMethod}
                  onChange={(e) => setRevealMethod(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-[#111827] border border-white/[0.08] text-slate-200 text-xs font-mono focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="auto">Auto-Detect Algorithm (Recommended)</option>
                  <option value="stego-hyper-matrix">
                    Hyper-Matrix (Quad-Hybrid Omni-Stealth)
                  </option>
                  <option value="stego-robust-resilient">
                    Robust Messaging (WhatsApp &amp; Social Safe)
                  </option>
                  <option value="stego-stealth-matrix">Stealth Matrix (CSPRNG Permutation)</option>
                  <option value="png-lsb-sequential">Sequential RGB LSB</option>
                  <option value="stego-pvd">Pixel Value Differencing (PVD)</option>
                  <option value="stego-dwt">Haar Wavelet Subband (DWT)</option>
                </select>
              </div>

              {/* Passkey Unlock Assistant */}
              <div className="pt-2 border-t border-white/[0.06]">
                <SmartPasskeyAssistant
                  idPrefix="decode-passkey"
                  value={revealPassphrase}
                  onChange={(newKey) => setRevealPassphrase(newKey)}
                  mode="decode"
                  placeholder="Enter unlock passkey, drop Photo Key, or scan Biometrics..."
                />
              </div>

              {/* Optional Sender Key for Signature Verification */}
              <div className="space-y-1.5 p-3.5 rounded-xl bg-[#0B0F19] border border-white/[0.06]">
                <label
                  htmlFor="sender-pubkey-verify"
                  className="text-xs text-slate-400 flex items-center gap-1.5"
                >
                  <Key className="w-3.5 h-3.5 text-sky-400" />
                  <span>Sender Signing Key (Optional)</span>
                </label>
                <input
                  id="sender-pubkey-verify"
                  type="text"
                  value={senderPublicKeyInput}
                  onChange={(e) => setSenderPublicKeyInput(e.target.value)}
                  placeholder="Auto-checks contacts and identity, or paste custom Base64 key..."
                  className="w-full p-2.5 rounded-lg bg-[#111827] border border-white/[0.08] text-slate-200 font-mono text-[11px] focus:outline-none focus:border-sky-500"
                />
                <div className="text-[10px] text-slate-500">
                  Leave blank to automatically check against your saved Vault contacts and session
                  identities.
                </div>
              </div>

              {/* Extract CTA */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleExtract}
                  disabled={!revealPreview || isExtracting || Boolean(revealValidationError)}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
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
                    className="px-4 py-3 rounded-xl bg-[#1E293B] hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-white/[0.08] transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {extractError && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
                    <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">Extraction Failed</div>
                      <div className="mt-0.5 leading-relaxed">{extractError}</div>
                    </div>
                  </div>

                  {(revealFile?.name.toLowerCase().includes('whatsapp') ||
                    revealFile?.name.toLowerCase().endsWith('.jpg') ||
                    revealFile?.name.toLowerCase().endsWith('.jpeg') ||
                    revealFile?.name.toLowerCase().endsWith('.webp') ||
                    revealFile?.type === 'image/jpeg' ||
                    revealFile?.type === 'image/webp') && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>WhatsApp / Social Media Compression Detected</span>
                      </div>
                      <p className="text-[11px] text-amber-200/90 leading-relaxed">
                        This image appears to have been saved from WhatsApp as a standard photo.
                        WhatsApp's lossy compression alters pixel values and discards standard
                        steganographic least-significant bits.
                      </p>
                      <div className="p-2.5 rounded-lg bg-black/40 border border-amber-500/20 text-[11px] space-y-1.5">
                        <div className="font-medium text-white flex items-center gap-1.5">
                          <span>💡 2 Ways to Transmit Without Issue:</span>
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                          <li>
                            <strong>Lossless Transfer (Best for photos &amp; files):</strong> Ask
                            the sender on WhatsApp to attach the carrier as a{' '}
                            <strong>Document</strong> (tap{' '}
                            <span className="font-mono bg-white/10 px-1 py-0.5 rounded text-white">
                              📎 ➔ Document
                            </span>{' '}
                            instead of Gallery/Photo). WhatsApp transfers documents with 100%
                            bit-exact quality.
                          </li>
                          <li>
                            <strong>Lossy-Resilient Mode:</strong> If sending as a normal photo,
                            have the sender select <strong>Robust Messaging Mode</strong> during
                            encoding, which survives WhatsApp lossy compression!
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Extracted Secret Inspector */}
          <div className="lg:col-span-6 space-y-5">
            <div className="p-5 rounded-2xl bg-[#0F172A]/85 backdrop-blur-xl border border-white/[0.08] shadow-xl space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>2. Extracted Secret Information</span>
              </h3>

              {extractedPayloadText !== null || extractedSecretFile !== null ? (
                <div className="space-y-4">
                  {/* Detected Algorithm Badge */}
                  {detectedMethodName && (
                    <div className="p-3 rounded-xl bg-[#0B0F19] border border-violet-500/30 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-violet-400" />
                        <span className="font-semibold text-white">Algorithm Detected:</span>
                        <span className="text-violet-300 font-mono">{detectedMethodName}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20">
                        Integrity Verified
                      </span>
                    </div>
                  )}

                  {/* Status Badges */}
                  <div className="space-y-2">
                    {/* Passkey Authenticated Status */}
                    {decryptionStatus === 'passkey_decrypted' && (
                      <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs flex items-center gap-2.5">
                        <Lock className="w-4 h-4 flex-shrink-0 text-violet-400" />
                        <div>
                          <div className="font-semibold text-white">
                            Passkey Decryption Successful
                          </div>
                          <div className="text-[11px] text-violet-300/80">
                            Payload unlocked using your secret passkey / 32-byte token.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Chameleon Multi-Layer Status */}
                    {unlockedChameleonLayer && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5">
                        <Shield className="w-4 h-4 flex-shrink-0 text-amber-400" />
                        <div>
                          <div className="font-semibold text-white">
                            Chameleon Multi-Layer Payload Unlocked (
                            {unlockedChameleonLayer.toUpperCase()} Layer)
                          </div>
                          <div className="text-[11px] text-amber-300/80">
                            {unlockedChameleonLayer === 'master'
                              ? 'Master vault payload unlocked with master secret.'
                              : 'Decoy layer revealed with plausible deniability key.'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Decryption Status */}
                    {decryptionStatus === 'decrypted' && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
                        <Lock className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                        <div>
                          <div className="font-semibold text-white">
                            Decryption Authenticated & Successful
                          </div>
                          <div className="text-[11px] text-emerald-300/80">
                            Payload unlocked using active Vault identity X25519 private key.
                          </div>
                        </div>
                      </div>
                    )}

                    {decryptionStatus === 'failed' && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2.5">
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
                      <div className="p-2.5 rounded-xl bg-[#0B0F19] border border-white/[0.06] text-slate-400 text-xs flex items-center gap-2">
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        <span>Unencrypted Plaintext Payload (No cryptographic seal applied)</span>
                      </div>
                    )}

                    {/* Signature Status */}
                    {signatureStatus === 'verified_contact' && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
                        <UserCheck className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                        <div>
                          <div className="font-semibold text-white">
                            Sender Verified: {verifiedContactName}
                          </div>
                          <div className="text-[11px] text-emerald-300/80">
                            Canonical SignDoc Ed25519 signature matches saved public key.
                          </div>
                        </div>
                      </div>
                    )}

                    {signatureStatus === 'verified_unknown' && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 flex-shrink-0 text-amber-400" />
                        <div>
                          <div className="font-semibold text-white">
                            Valid Ed25519 Signature (Unverified Key)
                          </div>
                          <div className="text-[11px] text-amber-300/80">
                            Signature is mathematically valid, but key is not in your saved
                            contacts.
                          </div>
                        </div>
                      </div>
                    )}

                    {signatureStatus === 'invalid' && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2.5">
                        <ShieldAlert className="w-4 h-4 flex-shrink-0 text-red-400" />
                        <div>
                          <div className="font-semibold">Signature Verification Rejected</div>
                          <div className="text-[11px] text-red-400/80">
                            Detached Ed25519 signature does not match or metadata was altered.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* OMB1 Protocol Metadata */}
                  {extractedEnvelope && (
                    <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-white/[0.06] space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-violet-400" />
                          <span>OMB1 Protocol Envelope</span>
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
                          Secure Envelope
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                        <div>
                          <span className="text-slate-500">Crypto Suite: </span>
                          <span className="text-slate-300 font-mono">
                            {extractedEnvelope.cryptoSuite}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Stego Method: </span>
                          <span className="text-slate-300 font-mono">
                            {extractedEnvelope.stegoMethod}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-500">Message ID: </span>
                          <span className="text-emerald-400 font-mono">
                            {Array.from(extractedEnvelope.messageId)
                              .map((b) => b.toString(16).padStart(2, '0'))
                              .join('')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Secret Image Result */}
                  {extractedSecretFile ? (
                    <div className="space-y-3 p-4 rounded-xl bg-[#0B0F19] border border-emerald-500/30 shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <ImageIcon className="w-4 h-4 text-emerald-400" />
                          <span>
                            {extractedSecretFile.isImage
                              ? 'Secret Image Revealed'
                              : 'Secret File Recovered'}
                          </span>
                        </span>
                        <a
                          href={extractedSecretFile.blobUrl}
                          download={extractedSecretFile.name}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download {extractedSecretFile.isImage ? 'Image' : 'File'}</span>
                        </a>
                      </div>

                      {extractedSecretFile.isImage && (
                        <div className="relative rounded-lg overflow-hidden border border-white/[0.06] bg-[#050811] flex items-center justify-center p-2 max-h-80">
                          <img
                            src={extractedSecretFile.blobUrl}
                            alt={extractedSecretFile.name}
                            className="max-h-72 w-auto object-contain rounded shadow-lg"
                          />
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                        <span className="px-2 py-0.5 rounded bg-[#111827] text-slate-300 border border-white/[0.06]">
                          {extractedSecretFile.name}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#111827] text-emerald-400 border border-white/[0.06]">
                          {(extractedSecretFile.size / 1024).toFixed(1)} KB
                        </span>
                        {extractedSecretFile.width && extractedSecretFile.height && (
                          <span className="px-2 py-0.5 rounded bg-[#111827] text-violet-300 border border-white/[0.06]">
                            {extractedSecretFile.width} × {extractedSecretFile.height} px
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-[#111827] text-sky-400 border border-white/[0.06]">
                          {extractedSecretFile.mime}
                        </span>
                      </div>
                    </div>
                  ) : extractedPayloadText !== null ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <label htmlFor="extracted-content-textarea" className="text-slate-400">
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
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1E293B] hover:bg-[#334155] text-[11px] text-slate-200 transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedPayload ? 'Copied!' : 'Copy'}</span>
                          </button>
                          <a
                            href={`data:text/plain;charset=utf-8,${encodeURIComponent(extractedPayloadText)}`}
                            download={`ombrix-extracted-${Date.now()}.txt`}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1E293B] hover:bg-[#334155] text-[11px] text-slate-200 transition-colors"
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
                        className="w-full p-3 rounded-xl bg-[#0B0F19] border border-white/[0.08] text-emerald-400 font-mono text-xs focus:outline-none resize-none"
                      />
                    </div>
                  ) : null}

                  <div className="p-3 rounded-xl bg-[#0B0F19] border border-white/[0.06] flex items-center gap-2 text-[11px] text-slate-500">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span>
                      Security Guarantee: Extracted payloads are isolated in memory and never
                      auto-executed.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-500 text-xs">
                  Upload an image and run extraction to inspect decoded payload contents and
                  envelope metadata.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
