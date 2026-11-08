import {
  type ContactEntry,
  type VaultIdentityData,
  buildSignDoc,
  computeKeyId,
  fromBase64,
  initCrypto,
  openSeal,
  parseAnyKey32,
  seal,
  signDetached,
  verifyDetached,
} from '@ombrix/crypto-adapter';
import { validatePngOrThrow } from '@ombrix/image-validation';
import type { PngMetadata } from '@ombrix/image-validation';
import { parseEnvelope, serializeEnvelope } from '@ombrix/payload-protocol';
import type { CryptoSuite, Omb1Envelope } from '@ombrix/payload-protocol';
import {
  haarDwtStego,
  hyperMatrixMethod,
  pvdStego,
  stealthMatrixMethod,
} from '@ombrix/stego-advanced';
import type { CapacityReport, CarrierImage } from '@ombrix/stego-interface';
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
  Maximize2,
  Radar,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
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
  const [secretImageBytes, setSecretImageBytes] = useState<Uint8Array | null>(null);
  const [secretImagePreview, setSecretImagePreview] = useState<string | null>(null);
  const [secretImageDims, setSecretImageDims] = useState<{ width: number; height: number } | null>(
    null,
  );
  // Chameleon Anti-Coercion (Dual-Layer) State
  const [isChameleonEnabled, setIsChameleonEnabled] = useState(false);
  const [decoyText, setDecoyText] = useState(
    'Team sync notes: Design sprint postponed to Thursday 3:00 PM.',
  );
  const [decoyPassphrase, setDecoyPassphrase] = useState('decoy-safe-pass');
  const [useEnvelope, setUseEnvelope] = useState(true);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [embedProgress, setEmbedProgress] = useState(0);
  const [embeddedImageUrl, setEmbeddedImageUrl] = useState<string | null>(null);
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
      setCarrierPreview(previewUrl);

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
        // Ensure opaque alpha across all pixels so canvas premultiplication never truncates RGB values
        for (let i = 3; i < imgData.data.length; i += 4) {
          imgData.data[i] = 255;
        }
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
    [selectedMethod],
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

  // Handle Secret Image selection
  const handleSecretImageSelect = useCallback(async (file: File) => {
    setSecretImageFile(file);
    const url = URL.createObjectURL(file);
    setSecretImagePreview(url);
    const buf = await file.arrayBuffer();
    setSecretImageBytes(new Uint8Array(buf));

    const img = new Image();
    img.src = url;
    img.onload = () => {
      setSecretImageDims({ width: img.naturalWidth, height: img.naturalHeight });
    };
  }, []);

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
    return () => {
      active = false;
    };
  }, [rawPayloadBytes]);

  const activePayloadBytes = compressedPayloadBytes ?? rawPayloadBytes;
  let effectivePayloadLength = activePayloadBytes.length;
  if (isChameleonEnabled) {
    const decoyBytesLength = new TextEncoder().encode(decoyText).length;
    effectivePayloadLength += decoyBytesLength + 28; // 28-byte Chameleon container header & MAC tags
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

      // Calculate empirical PSNR & MSE between original carrier and stego result
      let sumSq = 0;
      const totalBytes = carrierImageData.data.length;
      for (let i = 0; i < totalBytes; i++) {
        const d = (carrierImageData.data[i] ?? 0) - (stegoCarrier.data[i] ?? 0);
        sumSq += d * d;
      }
      const calculatedMse = sumSq / totalBytes;
      const calculatedPsnr =
        calculatedMse === 0 ? 99.9 : 10 * Math.log10((255 * 255) / calculatedMse);
      setMse(Math.round(calculatedMse * 10000) / 10000);
      setPsnr(Math.round(calculatedPsnr * 10) / 10);

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
    setExtractedSecretFile(null);
    setExtractedEnvelope(null);
    setUnlockedChameleonLayer(null);
    setDecryptionStatus(null);
    setSignatureStatus('none');
    setVerifiedContactName(null);
    setExtractError(null);
    setDetectedMethodName(null);

    const previewUrl = URL.createObjectURL(file);
    setRevealPreview(previewUrl);

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
      // Ensure opaque alpha across all pixels so canvas premultiplication never truncates RGB values
      for (let i = 3; i < imgData.data.length; i += 4) {
        imgData.data[i] = 255;
      }

      const extractedBytes = await workerClientRef.current.extract(
        {
          width: imgData.width,
          height: imgData.height,
          data: imgData.data,
        },
        {
          methodId: 'auto',
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
          setExtractedSecretFile(secretFile);
          setExtractedPayloadText(null);
        } else {
          setExtractedSecretFile(null);
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
          setExtractedSecretFile(secretFile);
          setExtractedPayloadText(null);
        } else {
          setExtractedSecretFile(null);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#111827]/90 via-[#0F172A]/90 to-[#111827]/90 backdrop-blur-xl border border-[#1E293B]/80 shadow-2xl">
        <div>
          <h2 className="text-xl font-bold font-['Sora'] text-white flex items-center gap-2.5">
            <span>OMBRIX Steganography Engine</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#14B8A6]/20 border border-[#14B8A6]/40 text-[#14B8A6] font-mono">
              Undetectable Stealth
            </span>
          </h2>
          <p className="text-xs text-[#94A3B8] mt-1">
            Universal carrier encoding with cryptographic scattering, edge-adaptive masking, and ±1
            LSB matching.
          </p>
        </div>

        <div
          className="inline-flex p-1 rounded-xl bg-[#0B0F19] border border-[#1E293B]"
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
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'hide'
                ? 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <EyeOff className="w-4 h-4 text-[#C084FC]" />
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
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'reveal'
                ? 'bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4 text-[#38BDF8]" />
            <span>Reveal Secret (Decode)</span>
          </button>
        </div>
      </div>

      {/* Mode Content */}
      {activeTab === 'hide' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Carrier Upload & Inspection */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-5 rounded-xl bg-[#111827]/85 backdrop-blur-xl border border-[#1E293B]/80 shadow-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#A855F7]" />
                  <span>1. Carrier Image (PNG, JPG, WEBP, BMP)</span>
                </h3>
                <div className="flex items-center gap-2">
                  {carrierImageData && (
                    <span className="flex items-center gap-1 text-xs text-[#14B8A6] font-medium mr-1">
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
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#7C3AED]/30 to-[#3B82F6]/30 hover:from-[#7C3AED]/50 hover:to-[#3B82F6]/50 border border-[#7C3AED]/40 text-xs font-medium text-white transition-all shadow-[0_0_10px_rgba(124,58,237,0.25)]"
                  >
                    {isGeneratingGhost ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C084FC]" />
                        <span>Synthesizing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-[#C084FC]" />
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
                  <div className="text-center space-y-3">
                    <div className="w-10 h-10 mx-auto rounded-full bg-[#7C3AED]/10 flex items-center justify-center text-[#A855F7]">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-sm text-[#E2E8F0] font-medium">
                        Select or drop any carrier image (PNG, JPG, WEBP, BMP)
                      </div>
                      <div className="text-xs text-[#94A3B8]">
                        Automatic lossless RGB raster conversion & high-capacity analysis
                      </div>
                    </div>
                    {/* Instant Ghost Carrier Synthesis Bar */}
                    <div className="pt-2 border-t border-[#1E293B] space-y-1.5">
                      <div className="text-[10px] text-[#64748B] uppercase tracking-wider font-semibold">
                        Or synthesize untraceable zero-provenance carrier:
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
                            className="px-2.5 py-1 rounded-md bg-[#111827] hover:bg-[#1E293B] border border-[#334155] hover:border-[#7C3AED] text-[11px] text-[#E2E8F0] capitalize transition-all"
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

              {/* Carrier Inspection Specs */}
              {carrierImageData && capacity && (
                <div className="space-y-3 pt-2 border-t border-[#1E293B]">
                  <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Carrier Specifications
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                      <div className="text-[#64748B]">Resolution</div>
                      <div className="font-mono text-white font-semibold">
                        {carrierImageData.width} × {carrierImageData.height}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                      <div className="text-[#64748B]">Pixel Count</div>
                      <div className="font-mono text-white font-semibold">
                        {(carrierImageData.width * carrierImageData.height).toLocaleString()} px
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                      <div className="text-[#64748B]">Security Tier</div>
                      <div className="font-mono text-[#14B8A6] font-semibold">
                        {selectedMethod === 'stego-stealth-matrix'
                          ? 'Undetectable (±1)'
                          : 'Standard'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                      <div className="text-[#64748B]">Usable Capacity</div>
                      <div className="font-mono text-[#14B8A6] font-semibold">
                        {capacity.usableBytes.toLocaleString()} bytes
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                      <div className="text-[#64748B]">Channels Used</div>
                      <div className="font-mono text-[#94A3B8] font-semibold">
                        RGB (3 bits/pixel)
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                      <div className="text-[#64748B]">Format</div>
                      <div className="font-mono text-[#94A3B8] font-semibold">
                        {validationResult?.colorTypeName || 'RGBA Raster'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Payload Input, Protocol Framing & Embedding */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-5 rounded-xl bg-[#111827]/85 backdrop-blur-xl border border-[#1E293B]/80 shadow-2xl space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#3B82F6]" />
                <span>2. Stego Algorithm & Payload Configuration</span>
              </h3>

              {/* Steganography Algorithm Engine Selector */}
              <div className="space-y-3 p-3.5 rounded-xl bg-[#0B0F19] border border-[#1E293B]">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-white font-semibold">
                    <Sparkles className="w-3.5 h-3.5 text-[#A855F7]" />
                    <span>Steganography Engine</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/30 text-[#14B8A6] font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6]" />
                    <span>Undetectable</span>
                  </span>
                </div>

                {/* Flagship Quad-Hybrid Option */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('stego-hyper-matrix')}
                  className={`w-full p-3 rounded-lg text-left border transition-all ${
                    selectedMethod === 'stego-hyper-matrix'
                      ? 'bg-gradient-to-r from-[#7C3AED]/20 to-[#3B82F6]/20 border-[#7C3AED] shadow-[0_0_15px_rgba(124,58,237,0.25)]'
                      : 'bg-[#111827] border-[#1E293B] hover:border-[#334155]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-[#C084FC]" />
                      <span className="text-xs font-semibold text-white">Hyper-Matrix</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#7C3AED]/20 text-[#C084FC] font-medium font-mono">
                        Quad-Hybrid
                      </span>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
                      Recommended
                    </span>
                  </div>
                  <div className="text-[11px] text-[#94A3B8] mt-1 pl-6">
                    Wavelet frequency + edge masking + PRNG scatter + ±1 matching
                  </div>
                </button>

                {/* Specialized Engines Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('stego-stealth-matrix')}
                    className={`p-2.5 rounded-lg text-left border transition-all ${
                      selectedMethod === 'stego-stealth-matrix'
                        ? 'bg-[#14B8A6]/15 border-[#14B8A6] shadow-[0_0_12px_rgba(20,184,166,0.2)]'
                        : 'bg-[#111827] border-[#1E293B] hover:border-[#334155]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">Stealth Matrix</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#14B8A6]/20 text-[#14B8A6] font-mono">
                        ±1
                      </span>
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-0.5">
                      PRNG scatter &amp; ±1 matching
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('stego-dwt')}
                    className={`p-2.5 rounded-lg text-left border transition-all ${
                      selectedMethod === 'stego-dwt'
                        ? 'bg-[#3B82F6]/15 border-[#3B82F6] shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                        : 'bg-[#111827] border-[#1E293B] hover:border-[#334155]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">Haar Wavelet</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#3B82F6]/20 text-[#3B82F6] font-mono">
                        DWT
                      </span>
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-0.5">
                      Diagonal high-frequency subband
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('stego-pvd')}
                    className={`p-2.5 rounded-lg text-left border transition-all ${
                      selectedMethod === 'stego-pvd'
                        ? 'bg-[#F59E0B]/15 border-[#F59E0B] shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                        : 'bg-[#111827] border-[#1E293B] hover:border-[#334155]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">PVD Differencing</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B] font-mono">
                        PVD
                      </span>
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-0.5">
                      Edge-adaptive contrast masking
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('png-lsb-sequential')}
                    className={`p-2.5 rounded-lg text-left border transition-all ${
                      selectedMethod === 'png-lsb-sequential'
                        ? 'bg-[#94A3B8]/15 border-[#94A3B8] shadow-[0_0_12px_rgba(148,163,184,0.2)]'
                        : 'bg-[#111827] border-[#1E293B] hover:border-[#334155]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">Sequential LSB</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#64748B]/20 text-[#94A3B8] font-mono">
                        Raster
                      </span>
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-0.5">
                      Deterministic sequential scan
                    </div>
                  </button>
                </div>

                {/* Single-line Dynamic Technical Status Bar */}
                <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1E293B] text-[11px]">
                  <div className="flex items-center gap-1.5 text-[#94A3B8]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#14B8A6]" />
                    <span>Defense:</span>
                    <span className="text-white font-medium">
                      {selectedMethod === 'stego-hyper-matrix'
                        ? 'Wavelet-PVD Hybrid + CSPRNG Permutation'
                        : selectedMethod === 'stego-stealth-matrix'
                          ? 'ChaCha20 Coordinate Scatter + ±1 Matching'
                          : selectedMethod === 'stego-dwt'
                            ? '2D Haar Integer HH Subband Isolation'
                            : selectedMethod === 'stego-pvd'
                              ? 'Human Visual System Range Masking'
                              : 'Sequential Raster Bit-Plane Scan'}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[#38BDF8]">
                    {selectedMethod === 'stego-hyper-matrix'
                      ? 'PSNR >52 dB'
                      : selectedMethod === 'stego-stealth-matrix'
                        ? 'PSNR >50 dB'
                        : selectedMethod === 'stego-dwt'
                          ? 'Frequency'
                          : selectedMethod === 'stego-pvd'
                            ? 'Edge-Bound'
                            : 'Linear'}
                  </span>
                </div>

                {/* Smart Passkey Assistant for Encode */}
                <div className="pt-2 border-t border-[#1E293B]">
                  <SmartPasskeyAssistant
                    idPrefix="encode-passkey"
                    value={passphrase}
                    onChange={(newKey) => setPassphrase(newKey)}
                    mode="encode"
                    placeholder="Enter passkey, or pick Memorable Words, Photo Key, 32-Byte Token, or Biometrics..."
                  />
                </div>
              </div>

              {/* Secret Payload Mode Selector & Inputs */}
              <div className="space-y-3 p-3.5 rounded-xl bg-[#0B0F19] border border-[#1E293B]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#C084FC]" />
                    <span className="text-xs font-semibold text-white">Secret Payload Type</span>
                  </div>
                  <div className="inline-flex p-0.5 rounded-lg bg-[#111827] border border-[#1E293B]">
                    <button
                      type="button"
                      onClick={() => setPayloadMode('text')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        payloadMode === 'text'
                          ? 'bg-[#7C3AED] text-white shadow-[0_0_10px_rgba(124,58,237,0.4)]'
                          : 'text-[#94A3B8] hover:text-[#E2E8F0]'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Text Message</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayloadMode('image')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        payloadMode === 'image'
                          ? 'bg-gradient-to-r from-[#A855F7] to-[#3B82F6] text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                          : 'text-[#94A3B8] hover:text-[#E2E8F0]'
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Secret Image</span>
                    </button>
                  </div>
                </div>

                {payloadMode === 'text' ? (
                  <div className="space-y-1.5 pt-1">
                    <label
                      htmlFor="payload-textarea"
                      className="text-xs text-[#94A3B8] flex items-center justify-between"
                    >
                      <span>Confidential Text Message</span>
                      <div className="flex items-center gap-2">
                        {compressionSavings && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-medium flex items-center gap-1 border border-emerald-500/30">
                            <Sparkles className="w-3 h-3" />
                            <span>Compressed -{compressionSavings.percent}%</span>
                          </span>
                        )}
                        <span className="font-mono text-[#E2E8F0]">
                          {rawPayloadBytes.length.toLocaleString()} bytes
                          {compressionSavings &&
                            ` (${compressionSavings.compressed.toLocaleString()} on wire)`}
                        </span>
                      </div>
                    </label>
                    <textarea
                      id="payload-textarea"
                      value={payloadText}
                      onChange={(e) => setPayloadText(e.target.value)}
                      rows={5}
                      className="w-full p-3 rounded-lg bg-[#111827] border border-[#1E293B] text-white text-xs font-mono focus:outline-none focus:border-[#7C3AED] resize-y min-h-[96px] max-h-[300px]"
                      placeholder="Enter confidential message to hide inside image (no character limits)..."
                    />
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                      <span>Secret Image to Conceal</span>
                      {secretImageBytes && (
                        <span className="font-mono text-[#14B8A6] font-semibold">
                          {(secretImageBytes.length / 1024).toFixed(1)} KB
                          {secretImageDims
                            ? ` • ${secretImageDims.width}×${secretImageDims.height}`
                            : ''}
                        </span>
                      )}
                    </div>

                    {secretImagePreview ? (
                      <div className="p-3 rounded-xl bg-[#111827] border border-[#1E293B] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={secretImagePreview}
                            alt="Secret Preview"
                            className="w-14 h-14 object-cover rounded-lg border border-[#334155] shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-white truncate">
                              {secretImageFile?.name}
                            </div>
                            <div className="text-[11px] text-[#94A3B8]">
                              {(secretImageBytes ? secretImageBytes.length / 1024 : 0).toFixed(1)}{' '}
                              KB • {secretImageFile?.type || 'Image'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSecretImageFile(null);
                            setSecretImageBytes(null);
                            setSecretImagePreview(null);
                            setSecretImageDims(null);
                          }}
                          className="px-2.5 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-[#334155] hover:border-[#A855F7]/70 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-[#111827]/70 hover:bg-[#111827]">
                        <ImageIcon className="w-8 h-8 text-[#A855F7]" />
                        <span className="text-xs font-semibold text-white">
                          Select or drop secret image to embed
                        </span>
                        <span className="text-[11px] text-[#64748B]">
                          PNG, JPG, WebP, GIF, or SVG
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

              {/* Chameleon Dual-Layer (Anti-Coercion Plausible Deniability) */}
              <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#F59E0B]" />
                    <span className="text-xs font-semibold text-white">
                      Chameleon Dual-Layer (Anti-Coercion)
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[#94A3B8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChameleonEnabled}
                      onChange={(e) => setIsChameleonEnabled(e.target.checked)}
                      className="rounded bg-[#111827] border-[#334155] text-[#F59E0B] focus:ring-[#F59E0B]"
                    />
                    <span>Enable Dual-Layer Deniability</span>
                  </label>
                </div>
                <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                  Embeds an authentic decoy payload alongside your confidential secret. If forced to
                  surrender a passkey under duress, the decoy passkey reveals only the harmless
                  decoy, leaving no mathematical trace of the master layer.
                </p>

                {isChameleonEnabled && (
                  <div className="space-y-3 pt-2 border-t border-[#1E293B] text-xs">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="decoy-payload-input"
                        className="text-[#94A3B8] flex items-center justify-between"
                      >
                        <span>Decoy Message (Surrendered under Duress)</span>
                        <span className="font-mono text-[#64748B]">{decoyText.length} chars</span>
                      </label>
                      <textarea
                        id="decoy-payload-input"
                        value={decoyText}
                        onChange={(e) => setDecoyText(e.target.value)}
                        rows={2}
                        className="w-full p-2.5 rounded-lg bg-[#111827] border border-[#1E293B] text-white text-xs font-mono focus:outline-none focus:border-[#F59E0B] resize-y"
                        placeholder="Enter harmless decoy message..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="decoy-passkey-input" className="text-[#94A3B8] block">
                        Decoy Passkey (Surrender this if coerced)
                      </label>
                      <input
                        id="decoy-passkey-input"
                        type="text"
                        value={decoyPassphrase}
                        onChange={(e) => setDecoyPassphrase(e.target.value)}
                        placeholder="Enter decoy passkey..."
                        className="w-full p-2 rounded-lg bg-[#111827] border border-[#1E293B] text-white text-xs font-mono focus:outline-none focus:border-[#F59E0B]"
                      />
                      <div className="text-[10px] text-[#64748B]">
                        Your confidential payload uses your primary passkey above. The decoy payload
                        uses this decoy passkey.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chameleon Dual-Layer (Anti-Coercion Plausible Deniability) */}
              <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#F59E0B]" />
                    <span className="text-xs font-semibold text-white">
                      Chameleon Dual-Layer (Anti-Coercion)
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[#94A3B8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChameleonEnabled}
                      onChange={(e) => setIsChameleonEnabled(e.target.checked)}
                      className="rounded bg-[#111827] border-[#334155] text-[#F59E0B] focus:ring-[#F59E0B]"
                    />
                    <span>Enable Dual-Layer Deniability</span>
                  </label>
                </div>
                <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                  Embeds an authentic decoy payload alongside your confidential secret. If forced to
                  surrender a passkey under duress, the decoy passkey reveals only the harmless
                  decoy, leaving no mathematical trace of the master layer.
                </p>

                {isChameleonEnabled && (
                  <div className="space-y-3 pt-2 border-t border-[#1E293B] text-xs">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="decoy-payload-input"
                        className="text-[#94A3B8] flex items-center justify-between"
                      >
                        <span>Decoy Message (Surrendered under Duress)</span>
                        <span className="font-mono text-[#64748B]">{decoyText.length} chars</span>
                      </label>
                      <textarea
                        id="decoy-payload-input"
                        value={decoyText}
                        onChange={(e) => setDecoyText(e.target.value)}
                        rows={2}
                        className="w-full p-2.5 rounded-lg bg-[#111827] border border-[#1E293B] text-white text-xs font-mono focus:outline-none focus:border-[#F59E0B] resize-y"
                        placeholder="Enter harmless decoy message..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="decoy-passkey-input" className="text-[#94A3B8] block">
                        Decoy Passkey (Surrender this if coerced)
                      </label>
                      <input
                        id="decoy-passkey-input"
                        type="text"
                        value={decoyPassphrase}
                        onChange={(e) => setDecoyPassphrase(e.target.value)}
                        placeholder="Enter decoy passkey..."
                        className="w-full p-2 rounded-lg bg-[#111827] border border-[#1E293B] text-white text-xs font-mono focus:outline-none focus:border-[#F59E0B]"
                      />
                      <div className="text-[10px] text-[#64748B]">
                        Your confidential payload uses your primary passkey above. The decoy payload
                        uses this decoy passkey.
                      </div>
                    </div>
                  </div>
                )}
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
                        <option value="NONE">
                          Passkey / Stego-Symmetric Direct (Recommended when using Passkey)
                        </option>
                        <option value="X25519_XSALSA20_POLY1305">
                          Libsodium Sealed Box (X25519) — Recipient Vault Public Key
                        </option>
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
                          placeholder="Paste recipient's 32-byte key (Base64, Hex, or 32-Byte Token format)..."
                          className="w-full p-2.5 rounded bg-[#0B0F19] border border-[#1E293B] text-white font-mono text-[11px] focus:outline-none focus:border-[#3B82F6]"
                        />

                        <div className="text-[10px] text-[#64748B]">
                          Accepts Base64, raw 64-char Hex, or 32-Byte Token (ACD7-AE04-...).
                          {!recipientPublicKeyBase64.trim() && activeIdentity && (
                            <span className="text-[#14B8A6] ml-1">
                              (Auto-using your active Vault key: {activeIdentity.name})
                            </span>
                          )}
                        </div>

                        {(recipientPublicKeyBase64.trim() ||
                          activeIdentity?.encryptionKeyPair?.publicKey) && (
                          <div className="flex items-center justify-between text-[10px] text-[#64748B] font-mono">
                            <span>Key Status:</span>
                            <span className="text-[#3B82F6]">
                              {(() => {
                                try {
                                  const raw =
                                    recipientPublicKeyBase64.trim() ||
                                    activeIdentity?.encryptionKeyPair?.publicKey ||
                                    '';
                                  const bytes = parseAnyKey32(raw);
                                  if (bytes.length === 32) {
                                    return `Valid 32-byte Key (ID: ${Array.from(computeKeyId(bytes))
                                      .map((b) => b.toString(16).padStart(2, '0'))
                                      .join('')})`;
                                  }
                                  return 'Invalid length';
                                } catch {
                                  return 'Invalid key format';
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

              {/* Auto-Scale Carrier Suggestion when payload exceeds capacity */}
              {carrierImageData && capacity && effectivePayloadLength > capacity.usableBytes && (
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#3B82F6]/15 via-[#7C3AED]/15 to-[#3B82F6]/15 border border-[#3B82F6]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-lg">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-white">
                        Payload Exceeds Carrier Capacity
                      </div>
                      <div className="text-[#94A3B8] text-[11px] mt-0.5">
                        Current carrier ({carrierImageData.width}×{carrierImageData.height}) holds{' '}
                        {capacity.usableBytes.toLocaleString()} bytes. Payload requires{' '}
                        {effectivePayloadLength.toLocaleString()} bytes.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoScaleCarrier}
                    className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#3B82F6] to-[#7C3AED] hover:from-[#2563EB] hover:to-[#6D28D9] text-white font-medium text-xs shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Auto-Scale Carrier to Fit</span>
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-3">
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
                <div className="p-4 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#14B8A6]">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Steganographic Embedding Complete</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#14B8A6]/20 text-[#14B8A6]">
                      {selectedMethod === 'stego-hyper-matrix'
                        ? 'Hyper-Matrix (Quad-Hybrid)'
                        : selectedMethod === 'stego-stealth-matrix'
                          ? 'Stealth Matrix (±1)'
                          : selectedMethod === 'stego-dwt'
                            ? 'Haar DWT Wavelet'
                            : selectedMethod === 'stego-pvd'
                              ? 'PVD (Wu & Tsai)'
                              : 'Sequential RGB LSB'}
                    </span>
                  </div>

                  {/* Interactive Before vs After Split Slider */}
                  {carrierPreview && (
                    <SplitComparisonSlider
                      originalUrl={carrierPreview}
                      stegoUrl={embeddedImageUrl}
                      psnr={psnr}
                      mse={mse}
                    />
                  )}

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-[#94A3B8]">
                      Pristine lossless raster with embedded payload. No visual distortion.
                    </div>
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
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold text-xs transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Test Reveal</span>
                      </button>
                      <a
                        href={embeddedImageUrl}
                        download={`ombrix-stego-${Date.now()}.png`}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#14B8A6] text-black font-semibold text-xs hover:bg-[#0D9488] transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download PNG</span>
                      </a>
                    </div>
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
            <div className="p-5 rounded-xl bg-[#111827]/85 backdrop-blur-xl border border-[#1E293B]/80 shadow-2xl space-y-4">
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
                      Select or drop stego carrier image (PNG, JPG, WEBP, BMP)
                    </div>
                    <div className="text-xs text-[#94A3B8]">
                      Universal decoder with automatic algorithm detection
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
                <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{revealValidationError}</span>
                </div>
              )}

              {/* Smart Passkey Assistant for Decode */}
              <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-[#1E293B]">
                <SmartPasskeyAssistant
                  idPrefix="decode-passkey"
                  value={revealPassphrase}
                  onChange={(newKey) => setRevealPassphrase(newKey)}
                  mode="decode"
                  placeholder="Enter unlock passkey, or drop the Photo Key / scan Biometrics..."
                />
              </div>

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
            <div className="p-5 rounded-xl bg-[#111827]/85 backdrop-blur-xl border border-[#1E293B]/80 shadow-2xl space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#14B8A6]" />
                <span>Extracted Secret Information</span>
              </h3>

              {extractedPayloadText !== null || extractedSecretFile !== null ? (
                <div className="space-y-4">
                  {/* Detected Algorithm Badge */}
                  {detectedMethodName && (
                    <div className="p-3 rounded-lg bg-[#7C3AED]/15 border border-[#7C3AED]/40 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#A855F7]" />
                        <span className="font-semibold text-white">Algorithm Detected:</span>
                        <span className="text-[#C084FC] font-mono">{detectedMethodName}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#14B8A6]/20 text-[#14B8A6] text-[10px] font-mono">
                        Integrity Verified
                      </span>
                    </div>
                  )}

                  {/* Status Badges */}
                  <div className="space-y-2">
                    {/* Chameleon Dual-Layer Status */}
                    {unlockedChameleonLayer === 'master' && (
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div>
                            <div className="font-semibold text-emerald-300">
                              Chameleon Confidential Layer Unlocked
                            </div>
                            <div className="text-[11px] text-emerald-400/80">
                              Master passkey authenticated. Confidential secret decrypted with zero
                              decoy residue.
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] shrink-0">
                          Master Layer
                        </span>
                      </div>
                    )}

                    {unlockedChameleonLayer === 'decoy' && (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                          <div>
                            <div className="font-semibold text-amber-300">
                              Chameleon Decoy Layer Unlocked (Anti-Coercion)
                            </div>
                            <div className="text-[11px] text-amber-400/80">
                              Decoy passkey verified. Plausible deniability active — Master layer
                              remains mathematically undetectable.
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] shrink-0">
                          Decoy Layer
                        </span>
                      </div>
                    )}

                    {/* Chameleon Dual-Layer Status */}
                    {unlockedChameleonLayer === 'master' && (
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div>
                            <div className="font-semibold text-emerald-300">
                              Chameleon Confidential Layer Unlocked
                            </div>
                            <div className="text-[11px] text-emerald-400/80">
                              Master passkey authenticated. Confidential secret decrypted with zero
                              decoy residue.
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] shrink-0">
                          Master Layer
                        </span>
                      </div>
                    )}

                    {unlockedChameleonLayer === 'decoy' && (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                          <div>
                            <div className="font-semibold text-amber-300">
                              Chameleon Decoy Layer Unlocked (Anti-Coercion)
                            </div>
                            <div className="text-[11px] text-amber-400/80">
                              Decoy passkey verified. Plausible deniability active — Master layer
                              remains mathematically undetectable.
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] shrink-0">
                          Decoy Layer
                        </span>
                      </div>
                    )}

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
                          OMB1 Secure Envelope
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

                  {extractedSecretFile ? (
                    <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-[#111827] via-[#0F172A] to-[#111827] border border-[#14B8A6]/40 shadow-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#14B8A6]" />
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            {extractedSecretFile.isImage
                              ? 'Secret Image Revealed'
                              : 'Secret File Recovered'}
                          </span>
                        </div>
                        <a
                          href={extractedSecretFile.blobUrl}
                          download={extractedSecretFile.name}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#14B8A6] to-[#06B6D4] text-white text-xs font-semibold shadow-md hover:brightness-110 transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>
                            Download {extractedSecretFile.isImage ? 'Secret Image' : 'File'}
                          </span>
                        </a>
                      </div>

                      {/* Secret Image Preview */}
                      {extractedSecretFile.isImage && (
                        <div className="relative rounded-lg overflow-hidden border border-[#1E293B] bg-[#050811] flex items-center justify-center p-2 max-h-80">
                          <img
                            src={extractedSecretFile.blobUrl}
                            alt={extractedSecretFile.name}
                            className="max-h-72 w-auto object-contain rounded shadow-lg"
                          />
                        </div>
                      )}

                      {/* File Details Badges */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                        <span className="px-2 py-0.5 rounded bg-[#1E293B] text-[#E2E8F0]">
                          {extractedSecretFile.name}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#1E293B] text-[#14B8A6]">
                          {(extractedSecretFile.size / 1024).toFixed(1)} KB
                        </span>
                        {extractedSecretFile.width && extractedSecretFile.height && (
                          <span className="px-2 py-0.5 rounded bg-[#1E293B] text-[#A855F7]">
                            {extractedSecretFile.width} × {extractedSecretFile.height} px
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-[#1E293B] text-[#3B82F6]">
                          {extractedSecretFile.mime}
                        </span>
                      </div>
                    </div>
                  ) : extractedPayloadText !== null ? (
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
                  ) : null}

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
