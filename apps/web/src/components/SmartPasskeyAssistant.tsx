import {
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
  Key,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';

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
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [isBioEnrolling, setIsBioEnrolling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Method 3: Photo as Passkey (Dual-Carrier Key)
  const handleKeyImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setKeyImageName(file.name);
      const thumbUrl = URL.createObjectURL(file);
      setKeyImageThumb(thumbUrl);

      const reader = new FileReader();
      reader.onload = (event) => {
        const buffer = event.target?.result as ArrayBuffer;
        if (!buffer) return;
        const bytes = new Uint8Array(buffer);
        const derivedKeyBytes = deriveKeyFromImage(bytes);
        // Convert to uppercase hex for clean transport & input compatibility
        const hexKey = toHex(derivedKeyBytes).toUpperCase();
        onChange(hexKey, { type: 'image', label: `Photo Key: ${file.name}` });
        setActiveTab('image');
      };
      reader.readAsArrayBuffer(file);
    },
    [onChange],
  );

  // Method 4: Biometric / WebAuthn Hardware Passkey
  const handleBiometricEnroll = useCallback(async () => {
    setBiometricError(null);
    setIsBioEnrolling(true);

    try {
      if (!window.PublicKeyCredential) {
        throw new Error('WebAuthn / Biometrics is not supported on this browser or platform.');
      }

      // Check if user-verifying platform authenticator is available
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
                ? 'bg-[#7C3AED] text-white shadow-[0_0_10px_rgba(124,58,237,0.4)]'
                : 'bg-[#1E293B] text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#334155]'
            }`}
            title="Generate an easy-to-remember 4-word phrase (e.g. velvet-matrix-falcon-orbit)"
          >
            <Dices className="w-3 h-3 text-[#A855F7]" />
            <span>Memorable Words</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              activeTab === 'image'
                ? 'bg-[#14B8A6] text-white shadow-[0_0_10px_rgba(20,184,166,0.4)]'
                : 'bg-[#1E293B] text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#334155]'
            }`}
            title="Select any photo as the 32-byte cryptographic key (Zero typing required!)"
          >
            <ImageIcon className="w-3 h-3 text-[#14B8A6]" />
            <span>Photo as Key</span>
          </button>

          <button
            type="button"
            onClick={handleGenerateCrypto32}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              activeTab === 'crypto32'
                ? 'bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.4)]'
                : 'bg-[#1E293B] text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#334155]'
            }`}
            title="Generate a high-entropy 256-bit (32-byte) cryptographic key token"
          >
            <Sparkles className="w-3 h-3 text-[#3B82F6]" />
            <span>32-Byte Token</span>
          </button>

          <button
            type="button"
            onClick={handleBiometricEnroll}
            disabled={isBioEnrolling}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              activeTab === 'biometric'
                ? 'bg-[#EC4899] text-white shadow-[0_0_10px_rgba(236,72,153,0.4)]'
                : 'bg-[#1E293B] text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#334155]'
            }`}
            title="Authenticate with Touch ID, Face ID, or Windows Hello for instant hardware-backed key"
          >
            <Fingerprint className="w-3 h-3 text-[#EC4899]" />
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
          className="w-full bg-[#0B0F19] border border-[#1E293B] rounded-xl px-4 py-3 pr-20 text-sm text-[#E2E8F0] placeholder-[#475569] font-mono focus:outline-none focus:ring-1 focus:ring-[#7C3AED] focus:border-[#7C3AED] transition-all"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
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

      {/* Photo Key Active Card */}
      {keyImageThumb && (
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/30">
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
              256-bit cryptographic passkey derived from raw photo sensor entropy.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setKeyImageThumb(null);
              setKeyImageName(null);
              onChange('');
            }}
            className="text-[11px] text-[#EF4444] hover:underline shrink-0"
          >
            Clear
          </button>
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
    </div>
  );
};
