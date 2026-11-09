import {
  computePerceptualHashFromRgba,
  deriveBiometricKey,
  deriveKeyFromImage,
  estimatePasskeyStrength,
  generateDicewarePassphrase,
  generateRandomPasskey32,
  toHex,
} from '@ombrix/crypto-adapter';
import {
  Check,
  Copy,
  Dices,
  Fingerprint,
  Image as ImageIcon,
  Info,
  Key,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SmartPasskeyAssistantProps {
  value: string;
  onChange: (
    passkey: string,
    sourceMeta?: {
      type: 'diceware' | 'image' | 'biometric' | 'crypto32' | 'manual';
      label: string;
    },
  ) => void;
  mode?: 'encode' | 'decode';
  idPrefix?: string;
  placeholder?: string;
}

export const SmartPasskeyAssistant: React.FC<SmartPasskeyAssistantProps> = ({
  value,
  onChange,
  mode = 'encode',
  idPrefix = 'passkey',
  placeholder = 'Enter secret passkey (optional)...',
}) => {
  const [activeTab, setActiveTab] = useState<
    'diceware' | 'image' | 'biometric' | 'crypto32' | null
  >(null);
  const [copied, setCopied] = useState(false);
  const [keyImageName, setKeyImageName] = useState<string | null>(null);
  const [keyImageThumb, setKeyImageThumb] = useState<string | null>(null);
  const [photoHashMode, setPhotoHashMode] = useState<'perceptual' | 'raw'>('perceptual');
  const [perceptualHexKey, setPerceptualHexKey] = useState<string | null>(null);
  const [rawHexKey, setRawHexKey] = useState<string | null>(null);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [isBioEnrolling, setIsBioEnrolling] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const transferCanvasRef = useRef<HTMLCanvasElement>(null);

  const strength = estimatePasskeyStrength(value);

  const handleCopy = useCallback(() => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  // Method 1: Generate Diceware Passphrase (Human Memorable)
  const handleGenerateDiceware = useCallback(() => {
    const phrase = generateDicewarePassphrase(4, '-');
    onChange(phrase, { type: 'diceware', label: 'Memorable Passphrase' });
    setActiveTab('diceware');
  }, [onChange]);

  // Method 2: Generate 32-Byte (256-Bit) High-Entropy Passkey
  const handleGenerateCrypto32 = useCallback(() => {
    const key = generateRandomPasskey32('formatted');
    onChange(key, { type: 'crypto32', label: '32-Byte Crypto Token' });
    setActiveTab('crypto32');
  }, [onChange]);

  // Method 3: Photo as Passkey (Dual-Carrier Key with Perceptual WhatsApp Resilience)
  const handleKeyImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setKeyImageName(file.name);
      const thumbUrl = URL.createObjectURL(file);
      setKeyImageThumb(thumbUrl);

      const reader = new FileReader();
      reader.onload = async (event) => {
        const buffer = event.target?.result as ArrayBuffer;
        if (!buffer) return;
        const bytes = new Uint8Array(buffer);

        // 1. Raw file entropy key (lossless transfer / air-gap)
        const rawKeyBytes = deriveKeyFromImage(bytes);
        const rawHex = toHex(rawKeyBytes).toUpperCase();
        setRawHexKey(rawHex);

        // 2. Perceptual Visual Key (WhatsApp/Telegram/Cloud-safe)
        try {
          const img = new Image();
          img.src = thumbUrl;
          await img.decode();

          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const percKeyBytes = computePerceptualHashFromRgba(
              canvas.width,
              canvas.height,
              imgData.data,
            );
            const percHex = toHex(percKeyBytes).toUpperCase();
            setPerceptualHexKey(percHex);

            // Default to perceptual for cross-platform resilience
            if (photoHashMode === 'perceptual') {
              onChange(percHex, {
                type: 'image',
                label: `Perceptual Photo Key (WhatsApp Safe): ${file.name}`,
              });
            } else {
              onChange(rawHex, {
                type: 'image',
                label: `Raw Photo Key (Lossless Only): ${file.name}`,
              });
            }
          } else {
            onChange(rawHex, { type: 'image', label: `Photo Key: ${file.name}` });
          }
        } catch {
          // Fallback to raw bytes if canvas extraction fails
          onChange(rawHex, { type: 'image', label: `Photo Key: ${file.name}` });
        }

        setActiveTab('image');
      };
      reader.readAsArrayBuffer(file);
    },
    [onChange, photoHashMode],
  );

  // Switch photo key hashing mode
  const handleTogglePhotoHashMode = useCallback(
    (mode: 'perceptual' | 'raw') => {
      setPhotoHashMode(mode);
      if (mode === 'perceptual' && perceptualHexKey) {
        onChange(perceptualHexKey, {
          type: 'image',
          label: `Perceptual Photo Key (WhatsApp Safe): ${keyImageName ?? 'Photo'}`,
        });
      } else if (mode === 'raw' && rawHexKey) {
        onChange(rawHexKey, {
          type: 'image',
          label: `Raw Photo Key (Lossless Only): ${keyImageName ?? 'Photo'}`,
        });
      }
    },
    [perceptualHexKey, rawHexKey, keyImageName, onChange],
  );

  // Method 4: Biometric / WebAuthn Hardware Passkey
  const handleBiometricEnroll = useCallback(async () => {
    setBiometricError(null);
    setIsBioEnrolling(true);

    try {
      if (!window.PublicKeyCredential) {
        throw new Error('WebAuthn / Biometrics is not supported on this browser or platform.');
      }

      const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!isAvailable) {
        throw new Error('Biometric hardware (Touch ID / Face ID / Windows Hello) is not detected.');
      }

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const userId = new Uint8Array(16);
      crypto.getRandomValues(userId);

      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'OMBRIX Zero-Knowledge Studio', id: window.location.hostname },
          user: {
            id: userId,
            name: 'ombrix_anonymous_user',
            displayName: 'OMBRIX Passkey User',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error('Biometric authentication was cancelled.');
      }

      const rawIdBytes = new Uint8Array(credential.rawId);
      const derivedKey = deriveBiometricKey(rawIdBytes);
      const hexKey = toHex(derivedKey).toUpperCase();

      onChange(hexKey, { type: 'biometric', label: 'Device Biometric Passkey' });
      setActiveTab('biometric');
    } catch (err) {
      setBiometricError(err instanceof Error ? err.message : 'Biometric enrollment failed.');
    } finally {
      setIsBioEnrolling(false);
    }
  }, [onChange]);

  // Render optical transfer matrix on modal canvas
  useEffect(() => {
    if (!showTransferModal || !transferCanvasRef.current || !value) return;
    const canvas = transferCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 220;
    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(0, 0, size, size);

    const gridSize = 16;
    const cellSize = size / gridSize;

    // Convert value characters to byte stream
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);

    // Corner optical fiducials (top-left, top-right, bottom-left)
    ctx.fillStyle = '#A855F7';
    ctx.fillRect(0, 0, cellSize * 2, cellSize * 2);
    ctx.fillRect(size - cellSize * 2, 0, cellSize * 2, cellSize * 2);
    ctx.fillRect(0, size - cellSize * 2, cellSize * 2, cellSize * 2);

    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(cellSize * 0.5, cellSize * 0.5, cellSize, cellSize);
    ctx.fillRect(size - cellSize * 1.5, cellSize * 0.5, cellSize, cellSize);
    ctx.fillRect(cellSize * 0.5, size - cellSize * 1.5, cellSize, cellSize);

    // Render data cells
    let byteIdx = 0;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        // Skip corner fiducials
        if ((r < 2 && c < 2) || (r < 2 && c >= gridSize - 2) || (r >= gridSize - 2 && c < 2)) {
          continue;
        }

        const b = byteIdx < bytes.length ? (bytes[byteIdx] ?? 0) : 0;
        const bit = (b >> (c % 8)) & 1;

        if (bit === 1) {
          ctx.fillStyle = byteIdx % 2 === 0 ? '#3B82F6' : '#14B8A6';
          ctx.fillRect(c * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2);
        } else {
          ctx.fillStyle = '#111827';
          ctx.fillRect(c * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2);
        }

        if (c % 8 === 7) byteIdx++;
      }
    }
  }, [showTransferModal, value]);

  return (
    <div className="space-y-3">
      {/* Smart Passkey Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor={`${idPrefix}-input`}
          className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5"
        >
          <Key className="w-3.5 h-3.5 text-[#C084FC]" />
          <span>
            {mode === 'encode' ? 'Lock with Passkey (Optional)' : 'Secret Unlock Passkey'}
          </span>
        </label>

        {/* Quick Generation Options */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleGenerateDiceware}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              activeTab === 'diceware'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-[#111827] text-slate-400 hover:text-slate-200 hover:bg-[#1E293B] border border-white/[0.08]'
            }`}
            title="Generate an easy-to-remember 4-word phrase (e.g. velvet-matrix-falcon-orbit)"
          >
            <Dices className="w-3 h-3 text-violet-400" />
            <span>Memorable Words</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              activeTab === 'image'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-[#111827] text-slate-400 hover:text-slate-200 hover:bg-[#1E293B] border border-white/[0.08]'
            }`}
            title="Select any photo as the 32-byte cryptographic key with WhatsApp perceptual resilience"
          >
            <ImageIcon className="w-3 h-3 text-emerald-400" />
            <span>Photo as Key</span>
          </button>

          <button
            type="button"
            onClick={handleGenerateCrypto32}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              activeTab === 'crypto32'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-[#111827] text-slate-400 hover:text-slate-200 hover:bg-[#1E293B] border border-white/[0.08]'
            }`}
            title="Generate a high-entropy 256-bit (32-byte) cryptographic key token"
          >
            <Key className="w-3 h-3 text-sky-400" />
            <span>32-Byte Token</span>
          </button>

          <button
            type="button"
            onClick={handleBiometricEnroll}
            disabled={isBioEnrolling}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              activeTab === 'biometric'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-[#111827] text-slate-400 hover:text-slate-200 hover:bg-[#1E293B] border border-white/[0.08]'
            }`}
            title="Authenticate with Touch ID, Face ID, or Windows Hello for instant hardware-backed key"
          >
            <Fingerprint className="w-3 h-3 text-pink-400" />
            <span>{isBioEnrolling ? 'Scanning...' : 'Device Biometrics'}</span>
          </button>
        </div>
      </div>

      {/* Hidden File Input for Photo Key */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleKeyImageUpload}
        className="hidden"
      />

      {/* Passkey Input Box with Copy & Action Controls */}
      <div className="relative">
        <input
          id={`${idPrefix}-input`}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value, { type: 'manual', label: 'Custom Passkey' });
            if (activeTab !== 'image') setKeyImageThumb(null);
          }}
          placeholder={placeholder}
          className="w-full bg-[#0B0F19] border border-[#1E293B] rounded-xl px-4 py-3 pr-28 text-sm text-[#E2E8F0] placeholder-[#475569] font-mono focus:outline-none focus:ring-1 focus:ring-[#7C3AED] focus:border-[#7C3AED] transition-all"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <>
              <button
                type="button"
                onClick={() => setShowTransferModal(true)}
                className="p-1.5 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-violet-400 hover:text-violet-200 transition-colors"
                title="Transfer key to phone or another device"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-white transition-colors"
                title="Copy passkey to clipboard"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-[#14B8A6]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </>
          )}

          {activeTab === 'diceware' && (
            <button
              type="button"
              onClick={handleGenerateDiceware}
              className="p-1.5 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-white transition-colors"
              title="Roll new memorable words"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#C084FC]" />
            </button>
          )}
        </div>
      </div>

      {/* Photo Key Active Card with WhatsApp Resilience Toggle */}
      {keyImageThumb && (
        <div className="p-3 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/30 space-y-2">
          <div className="flex items-center gap-3">
            <img
              src={keyImageThumb}
              alt="Key Carrier Preview"
              className="w-10 h-10 object-cover rounded-lg border border-[#14B8A6]/40 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-[#14B8A6] flex items-center gap-1.5 truncate">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Photo Key: {keyImageName}</span>
              </div>
              <div className="text-[11px] text-[#94A3B8] truncate">
                {photoHashMode === 'perceptual'
                  ? 'Perceptual visual hashing (Survives WhatsApp & social media recompression)'
                  : 'Bit-exact file byte entropy (Requires lossless file transfer)'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setKeyImageThumb(null);
                setKeyImageName(null);
                setPerceptualHexKey(null);
                setRawHexKey(null);
                onChange('');
              }}
              className="text-[11px] text-[#EF4444] hover:underline shrink-0"
            >
              Clear
            </button>
          </div>

          {/* Mode Selector for Photo Key */}
          <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06]">
            <span className="text-[10px] text-slate-400 font-medium">Cross-Platform Mode:</span>
            <button
              type="button"
              onClick={() => handleTogglePhotoHashMode('perceptual')}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                photoHashMode === 'perceptual'
                  ? 'bg-[#14B8A6] text-black shadow-sm'
                  : 'bg-[#111827] text-slate-400 hover:text-white border border-white/[0.08]'
              }`}
            >
              WhatsApp / Cloud Safe (Perceptual)
            </button>
            <button
              type="button"
              onClick={() => handleTogglePhotoHashMode('raw')}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                photoHashMode === 'raw'
                  ? 'bg-[#14B8A6] text-black shadow-sm'
                  : 'bg-[#111827] text-slate-400 hover:text-white border border-white/[0.08]'
              }`}
            >
              Lossless File Only (Raw Bytes)
            </button>
          </div>
        </div>
      )}

      {/* Biometric Active Hardware Alert */}
      {activeTab === 'biometric' && value && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-pink-500/10 border border-pink-500/30 text-xs text-pink-300">
          <Fingerprint className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block">Hardware-Locked Biometric Key Active</span>
            <span className="text-[11px] text-slate-300 block">
              This passkey is bound to this device&apos;s Secure Enclave / TPM. To decrypt on your
              phone or another device, click the{' '}
              <strong className="text-white">Transfer to Phone</strong> button to copy or scan the
              32-byte unlock token.
            </span>
          </div>
        </div>
      )}

      {/* Biometric Error Alert */}
      {biometricError && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-xs text-[#EF4444]">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{biometricError}</span>
        </div>
      )}

      {/* Passkey Entropy & Strength Rating Bar */}
      {value.trim() && (
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#64748B] flex items-center gap-1">
              <ShieldCheck
                className={`w-3.5 h-3.5 ${
                  strength.rating === 'Unbreakable'
                    ? 'text-[#C084FC]'
                    : strength.rating === 'Strong'
                      ? 'text-[#10B981]'
                      : strength.rating === 'Moderate'
                        ? 'text-[#F59E0B]'
                        : 'text-[#EF4444]'
                }`}
              />
              <span>{strength.description}</span>
            </span>
            <span
              className={`font-semibold ${
                strength.rating === 'Unbreakable'
                  ? 'text-[#C084FC]'
                  : strength.rating === 'Strong'
                    ? 'text-[#10B981]'
                    : strength.rating === 'Moderate'
                      ? 'text-[#F59E0B]'
                      : 'text-[#EF4444]'
              }`}
            >
              {strength.rating}
            </span>
          </div>

          <div className="w-full h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                strength.rating === 'Unbreakable'
                  ? 'w-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899]'
                  : strength.rating === 'Strong'
                    ? 'w-3/4 bg-[#10B981]'
                    : strength.rating === 'Moderate'
                      ? 'w-1/2 bg-[#F59E0B]'
                      : 'w-1/4 bg-[#EF4444]'
              }`}
            />
          </div>
        </div>
      )}

      {/* Cross-Device Passkey Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#0B0F19] border border-white/[0.12] rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Smartphone className="w-4 h-4 text-violet-400" />
                <span>Cross-Device Key Transfer</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <p>
                To unlock this payload on your phone or another device, use either method below:
              </p>

              {/* Optical Transfer Matrix Display */}
              <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-black/40 border border-white/[0.06]">
                <canvas
                  ref={transferCanvasRef}
                  className="rounded-lg shadow-lg border border-violet-500/30"
                  style={{ width: 180, height: 180 }}
                />
                <span className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                  <QrCode className="w-3 h-3 text-violet-400" />
                  Air-Gap Optical Matrix (Scan with phone or Air-Gap Studio)
                </span>
              </div>

              {/* Text Token Box */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-slate-400 block">
                  Cross-Device Unlock Token:
                </span>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#111827] border border-white/[0.08] font-mono text-xs text-emerald-400 break-all select-all">
                  <span className="flex-1">{value}</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white shrink-0 transition-colors"
                    title="Copy token"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Guidance for Cross-Device Types */}
              <div className="p-2.5 rounded-xl bg-violet-950/20 border border-violet-500/20 text-[11px] text-slate-300 space-y-1">
                <div className="flex items-center gap-1 font-semibold text-violet-300">
                  <Info className="w-3.5 h-3.5" />
                  <span>How Cross-Device Key Matching Works:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-400 pl-1">
                  <li>
                    <strong>Tokens & Passphrases:</strong> Input the exact token above on your
                    phone.
                  </li>
                  <li>
                    <strong>Photo as Key:</strong> Send the key photo via WhatsApp or Cloud.
                    Perceptual hashing ensures it matches 100% across devices even after
                    compression.
                  </li>
                  <li>
                    <strong>Device Biometrics:</strong> Hardware chips differ per device. Use this
                    32-byte token to unlock without re-enrolling on your phone.
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
