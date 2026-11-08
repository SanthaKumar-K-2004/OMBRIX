import {
  type LinkContainer,
  type OpenedLink,
  createLinkContainer,
  deserializeLinkUri,
  exportLinkBundle,
  importLinkBundle,
  openLinkContainer,
  serializeLinkUri,
} from '@ombrix/link-sharing';
import { stealthMatrixMethod } from '@ombrix/stego-advanced';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileCheck,
  FileWarning,
  Flame,
  ImageIcon,
  Link as LinkIcon,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { SmartPasskeyAssistant } from './SmartPasskeyAssistant.js';

export const LinkStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'open'>('create');

  // Create state
  const [carrierFile, setCarrierFile] = useState<File | null>(null);
  const [carrierBytes, setCarrierBytes] = useState<Uint8Array | null>(null);
  const [secretMessage, setSecretMessage] = useState(
    'Top secret rendezvous coordinates: 37.7749° N, 122.4194° W. Verification code: OMBRIX-LINK-99.',
  );
  const [ttlSeconds, setTtlSeconds] = useState<number>(86400); // default 24h
  const [passphrase, setPassphrase] = useState<string>('');
  const [burnAfterReading, setBurnAfterReading] = useState<boolean>(false);
  const [createdContainer, setCreatedContainer] = useState<LinkContainer | null>(null);
  const [generatedUri, setGeneratedUri] = useState<string>('');
  const [stegoCarrierUrl, setStegoCarrierUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Open state
  const [inputUri, setInputUri] = useState<string>('');
  const [verifyCarrierFile, setVerifyCarrierFile] = useState<File | null>(null);
  const [verifyCarrierBytes, setVerifyCarrierBytes] = useState<Uint8Array | null>(null);
  const [openPassphrase, setOpenPassphrase] = useState<string>('');
  const [openedResult, setOpenedResult] = useState<OpenedLink | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [openMethodNote, setOpenMethodNote] = useState<string | null>(null);

  // Handle carrier upload for create
  const handleCarrierUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCarrierFile(file);
    const buf = await file.arrayBuffer();
    setCarrierBytes(new Uint8Array(buf));
    setCreateError(null);
    setStegoCarrierUrl(null);
  };

  // Handle carrier upload for verify
  const handleVerifyCarrierUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVerifyCarrierFile(file);
    const buf = await file.arrayBuffer();
    setVerifyCarrierBytes(new Uint8Array(buf));
    setOpenError(null);
  };

  // Create OMBRIX Link & Steganographic Carrier
  const handleCreateLink = async () => {
    try {
      setIsProcessing(true);
      setCreateError(null);
      setStegoCarrierUrl(null);

      let activeCarrier = carrierBytes;
      let activeFile = carrierFile;

      // If user did not upload a carrier image, synthesize a high-resolution gradient carrier
      if (!activeCarrier || !activeFile) {
        const synthCanvas = document.createElement('canvas');
        synthCanvas.width = 400;
        synthCanvas.height = 400;
        const sCtx = synthCanvas.getContext('2d');
        if (sCtx) {
          const grad = sCtx.createLinearGradient(0, 0, 400, 400);
          grad.addColorStop(0, '#1E1B4B');
          grad.addColorStop(0.5, '#4C1D95');
          grad.addColorStop(1, '#0F172A');
          sCtx.fillStyle = grad;
          sCtx.fillRect(0, 0, 400, 400);
        }
        const blob = await new Promise<Blob>((resolve) =>
          synthCanvas.toBlob((b) => resolve(b ?? new Blob()), 'image/png'),
        );
        const buf = await blob.arrayBuffer();
        activeCarrier = new Uint8Array(buf);
        activeFile = new File([blob], 'synthetic-carrier.png', { type: 'image/png' });
        setCarrierBytes(activeCarrier);
        setCarrierFile(activeFile);
      }

      const payloadBytes = new TextEncoder().encode(secretMessage);

      // Step 1: Create cryptographic ephemeral container with BLAKE2b carrier hash ring
      const container = await createLinkContainer({
        expiresInSeconds: ttlSeconds,
        carrierBytes: activeCarrier,
        payloadBytes,
        carrierName: activeFile.name,
        passphrase: passphrase.trim() ? passphrase : undefined,
        burnAfterReading,
      });

      const uri = serializeLinkUri(container, window.location.origin);
      setCreatedContainer(container);
      setGeneratedUri(uri);

      // Step 2: Embed container directly into carrier image using Stealth Matrix (±1 LSB matching)
      try {
        const img = new Image();
        const objUrl = URL.createObjectURL(activeFile);
        img.src = objUrl;
        await img.decode();

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          for (let i = 3; i < imgData.data.length; i += 4) {
            imgData.data[i] = 255; // Ensure full opacity
          }

          const containerJsonBytes = new TextEncoder().encode(JSON.stringify(container));
          const stegoCarrier = await stealthMatrixMethod.embed(
            { width: imgData.width, height: imgData.height, data: imgData.data },
            containerJsonBytes,
            { passphrase: passphrase.trim() ? passphrase : undefined },
          );

          const stegoCanvas = document.createElement('canvas');
          stegoCanvas.width = stegoCarrier.width;
          stegoCanvas.height = stegoCarrier.height;
          const stegoCtx = stegoCanvas.getContext('2d');
          if (stegoCtx) {
            const clamped = new Uint8ClampedArray(stegoCarrier.data);
            const newImgData = new ImageData(clamped, stegoCarrier.width, stegoCarrier.height);
            stegoCtx.putImageData(newImgData, 0, 0);
            stegoCanvas.toBlob((b) => {
              if (b) {
                setStegoCarrierUrl(URL.createObjectURL(b));
              }
            }, 'image/png');
          }
        }
      } catch (stegoErr) {
        console.warn('Steganographic carrier embedding note:', stegoErr);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Open & Verify Link
  const handleOpenLink = async () => {
    try {
      setIsOpening(true);
      setOpenError(null);
      setOpenedResult(null);
      setOpenMethodNote(null);

      let container: LinkContainer | null = null;

      // Mode A: Direct extraction from dropped Stego Carrier Image
      if (verifyCarrierFile) {
        try {
          const img = new Image();
          const objUrl = URL.createObjectURL(verifyCarrierFile);
          img.src = objUrl;
          await img.decode();

          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            for (let i = 3; i < imgData.data.length; i += 4) {
              imgData.data[i] = 255;
            }

            const extractedBytes = await stealthMatrixMethod.extract(
              { width: imgData.width, height: imgData.height, data: imgData.data },
              { passphrase: openPassphrase.trim() ? openPassphrase : undefined },
            );

            const jsonStr = new TextDecoder().decode(extractedBytes);
            if (jsonStr.includes('OMBRIX_LINK')) {
              container = JSON.parse(jsonStr) as LinkContainer;
              setOpenMethodNote(
                'Directly unpacked from Steganographic Carrier Image via OMBRIX Stealth Matrix',
              );
            }
          }
        } catch {
          // If carrier did not contain embedded stego container, fall through to text input
        }
      }

      // Mode B: Parse from text URI or JSON bundle
      if (!container) {
        if (!inputUri.trim()) {
          throw new Error(
            'Please upload a stego carrier image or enter an OMBRIX Link URI / container JSON.',
          );
        }

        if (inputUri.trim().startsWith('{')) {
          container = importLinkBundle(inputUri.trim());
          setOpenMethodNote('Unpacked from .ombrix-link JSON bundle');
        } else {
          container = deserializeLinkUri(inputUri.trim());
          setOpenMethodNote('Unpacked from OMBRIX URL fragment');
        }
      }

      const opened = await openLinkContainer(container, {
        passphrase: openPassphrase.trim() ? openPassphrase : undefined,
        carrierBytes: verifyCarrierBytes ?? undefined,
      });

      setOpenedResult(opened);
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsOpening(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const downloadBundle = (container: LinkContainer) => {
    const json = exportLinkBundle(container);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ombrix-link-${container.metadata.id.slice(0, 8)}.ombrix-link`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Studio Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#111827] via-[#0F172A] to-[#111827] border border-[#1E293B] shadow-xl">
        <div>
          <h2 className="text-xl font-bold font-['Sora'] text-white flex items-center gap-2.5">
            <LinkIcon className="w-5 h-5 text-[#A855F7]" />
            <span>OMBRIX Link: Ephemeral Steganographic Sharing</span>
          </h2>
          <p className="text-xs text-[#94A3B8] mt-1">
            Time-bounded steganographic containers with strict TTL expiration, BLAKE2b carrier hash
            rings, and zero-server local verification.
          </p>
        </div>

        <div className="flex items-center p-1 bg-[#0B0F19] border border-[#1E293B] rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'create'
                ? 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white shadow-md'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            Create Stego Link
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('open')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'open'
                ? 'bg-gradient-to-r from-[#14B8A6] to-[#0D9488] text-white shadow-md'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            Open &amp; Verify Link
          </button>
        </div>
      </div>

      {/* Threat Model & Architectural Disclosure */}
      <div className="p-4 rounded-xl bg-[#0B0F19]/60 border border-[#1E293B] flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#14B8A6] shrink-0 mt-0.5" />
        <div className="text-xs text-[#94A3B8] leading-relaxed">
          <span className="font-semibold text-[#E2E8F0]">
            Dual Carrier Steganography &amp; TTL Integrity:
          </span>{' '}
          Secrets are embedded directly into the carrier image pixels using OMBRIX Stealth Matrix
          (±1 LSB matching). The BLAKE2b carrier hash ring cryptographically binds the carrier image
          to the container, rejecting modified carriers. Expiration is enforced mathematically
          without servers.
        </div>
      </div>

      {activeTab === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create Form */}
          <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-4">
            <h3 className="text-base font-bold font-['Sora'] text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#A855F7]" />
              <span>Container Configuration</span>
            </h3>

            {/* Carrier Image Input */}
            <div className="space-y-2">
              <label
                htmlFor="carrier-upload"
                className="block text-xs font-semibold text-[#E2E8F0]"
              >
                Carrier Image (PNG/JPG/WEBP)
              </label>
              <div className="relative border border-dashed border-[#334155] rounded-xl p-4 text-center hover:border-[#7C3AED] transition-colors cursor-pointer bg-[#0B0F19]/50">
                <input
                  id="carrier-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleCarrierUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-1.5 pointer-events-none">
                  <Upload className="w-5 h-5 text-[#94A3B8]" />
                  <span className="text-xs text-[#E2E8F0]">
                    {carrierFile ? carrierFile.name : 'Drop carrier image or click to select'}
                  </span>
                  <span className="text-[10px] text-[#64748B]">
                    {carrierFile
                      ? `${(carrierFile.size / 1024).toFixed(1)} KB`
                      : 'Leave blank to generate an automatic cryptographic gradient carrier'}
                  </span>
                </div>
              </div>
            </div>

            {/* Payload Content */}
            <div className="space-y-2">
              <label
                htmlFor="secret-message"
                className="block text-xs font-semibold text-[#E2E8F0]"
              >
                Steganographic Secret Payload
              </label>
              <textarea
                id="secret-message"
                value={secretMessage}
                onChange={(e) => setSecretMessage(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs text-white font-mono focus:border-[#7C3AED] focus:outline-none resize-none"
                placeholder="Enter secret text payload to package..."
              />
            </div>

            {/* TTL Expiration Selector */}
            <div className="space-y-2">
              <label
                htmlFor="ttl-selector"
                className="text-xs font-semibold text-[#E2E8F0] flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span>Time-to-Live (TTL) Policy</span>
              </label>
              <div id="ttl-selector" className="grid grid-cols-4 gap-2">
                {[
                  { label: '1 Hour', seconds: 3600 },
                  { label: '24 Hours', seconds: 86400 },
                  { label: '7 Days', seconds: 604800 },
                  { label: '30 Days', seconds: 2592000 },
                ].map((item) => (
                  <button
                    key={item.seconds}
                    type="button"
                    onClick={() => setTtlSeconds(item.seconds)}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                      ttlSeconds === item.seconds
                        ? 'bg-[#7C3AED]/20 border-[#7C3AED] text-white shadow-sm'
                        : 'bg-[#0B0F19] border-[#1E293B] text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Smart Passkey Assistant */}
            <div className="pt-2 border-t border-[#1E293B]">
              <SmartPasskeyAssistant
                idPrefix="link-create-passkey"
                value={passphrase}
                onChange={(newKey) => setPassphrase(newKey)}
                mode="encode"
                placeholder="Leave blank for open link, or enter passphrase / photo key..."
              />
            </div>

            {/* Burn Policy */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="burn"
                checked={burnAfterReading}
                onChange={(e) => setBurnAfterReading(e.target.checked)}
                className="w-4 h-4 rounded bg-[#0B0F19] border-[#1E293B] text-[#7C3AED] focus:ring-0"
              />
              <label
                htmlFor="burn"
                className="text-xs text-[#94A3B8] cursor-pointer flex items-center gap-1"
              >
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>Flag container as Single-Access (&ldquo;Burn After Reading&rdquo;)</span>
              </label>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleCreateLink}
              className="w-full py-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-[#7C3AED]/20 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Embedding Steganographic Container...</span>
                </>
              ) : (
                <>
                  <LinkIcon className="w-4 h-4" />
                  <span>Generate Stego Carrier &amp; Link</span>
                </>
              )}
            </button>
          </div>

          {/* Result Output Panel */}
          <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <h3 className="text-base font-bold font-['Sora'] text-white flex items-center justify-between">
                <span>Generated Ephemeral Package</span>
                {createdContainer && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#14B8A6]/10 text-[#14B8A6] border border-[#14B8A6]/30">
                    STEGO READY
                  </span>
                )}
              </h3>

              {createdContainer ? (
                <div className="space-y-4">
                  {/* Stego Carrier Download Preview */}
                  {stegoCarrierUrl && (
                    <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#14B8A6]/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#14B8A6] flex items-center gap-1.5">
                          <ImageIcon className="w-4 h-4" />
                          <span>Steganographic Carrier Image</span>
                        </span>
                        <span className="text-[10px] text-[#64748B]">
                          Payload hidden inside pixels
                        </span>
                      </div>
                      <div className="relative rounded-lg overflow-hidden border border-[#1E293B] h-36 bg-[#000]">
                        <img
                          src={stegoCarrierUrl}
                          alt="Stego Link Carrier"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <a
                        href={stegoCarrierUrl}
                        download={`stego-link-${createdContainer.metadata.id.slice(0, 8)}.png`}
                        className="w-full py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#14B8A6]/20"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Stego Carrier Image</span>
                      </a>
                    </div>
                  )}

                  {/* Metadata Card */}
                  <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-2 text-xs font-mono">
                    <div className="flex justify-between items-center text-[#94A3B8]">
                      <span>Link ID:</span>
                      <span className="text-white">{createdContainer.metadata.id}</span>
                    </div>
                    <div className="flex justify-between items-center text-[#94A3B8]">
                      <span>Expires At:</span>
                      <span className="text-[#3B82F6]">
                        {new Date(createdContainer.metadata.expiresAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[#94A3B8]">
                      <span>Carrier BLAKE2b Hash:</span>
                      <span
                        className="text-[#14B8A6] truncate max-w-[200px]"
                        title={createdContainer.metadata.carrierHash}
                      >
                        {createdContainer.metadata.carrierHash.slice(0, 16)}...
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[#94A3B8]">
                      <span>Passphrase Protection:</span>
                      <span
                        className={
                          createdContainer.metadata.hasPassphrase
                            ? 'text-[#14B8A6]'
                            : 'text-[#64748B]'
                        }
                      >
                        {createdContainer.metadata.hasPassphrase
                          ? 'Enabled (Argon2id + SecretBox)'
                          : 'Disabled'}
                      </span>
                    </div>
                  </div>

                  {/* Shareable URL */}
                  <div className="space-y-2">
                    <label
                      htmlFor="shareable-link-url"
                      className="block text-xs font-semibold text-[#E2E8F0]"
                    >
                      Shareable URL Fragment
                    </label>
                    <div className="relative">
                      <input
                        id="shareable-link-url"
                        readOnly
                        value={generatedUri}
                        className="w-full p-2.5 pr-20 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-[11px] font-mono text-[#94A3B8] focus:outline-none select-all"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(generatedUri)}
                        className="absolute right-1 top-1 bottom-1 px-3 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[10px] font-bold transition-all flex items-center gap-1.5"
                      >
                        {copiedLink ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Download Bundle */}
                  <button
                    type="button"
                    onClick={() => downloadBundle(createdContainer)}
                    className="w-full py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 border border-[#334155]"
                  >
                    <Download className="w-4 h-4 text-[#3B82F6]" />
                    <span>Download .ombrix-link Container File</span>
                  </button>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#1E293B] rounded-xl text-[#64748B] space-y-2">
                  <LinkIcon className="w-8 h-8 opacity-40 text-[#7C3AED]" />
                  <p className="text-xs">
                    Configure parameters on the left and click Generate to create a stego link.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Open & Verify Tab */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-4">
            <h3 className="text-base font-bold font-['Sora'] text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#14B8A6]" />
              <span>Unpack Stego Carrier or Link</span>
            </h3>

            {/* Stego Carrier Image Upload */}
            <div className="space-y-2">
              <label
                htmlFor="verify-carrier-upload"
                className="block text-xs font-semibold text-[#E2E8F0]"
              >
                Stego Carrier Image (Drop here for Direct Unpacking)
              </label>
              <div className="relative border border-dashed border-[#334155] rounded-xl p-3 text-center hover:border-[#14B8A6] transition-colors cursor-pointer bg-[#0B0F19]/50">
                <input
                  id="verify-carrier-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleVerifyCarrierUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-1 pointer-events-none">
                  <Upload className="w-4 h-4 text-[#14B8A6]" />
                  <span className="text-xs text-[#E2E8F0]">
                    {verifyCarrierFile
                      ? verifyCarrierFile.name
                      : 'Drop Stego Carrier Image or click to select'}
                  </span>
                  <span className="text-[10px] text-[#64748B]">
                    Automatically extracts embedded link container from carrier pixels
                  </span>
                </div>
              </div>
            </div>

            {/* URI or JSON Input (Fallback) */}
            <div className="space-y-2">
              <label
                htmlFor="link-uri-input"
                className="block text-xs font-semibold text-[#E2E8F0]"
              >
                OR Paste OMBRIX Link URI / Container JSON
              </label>
              <textarea
                id="link-uri-input"
                value={inputUri}
                onChange={(e) => setInputUri(e.target.value)}
                rows={3}
                placeholder="Paste https://ombrix.local/#link=... or container JSON..."
                className="w-full p-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs text-white font-mono focus:border-[#7C3AED] focus:outline-none resize-none"
              />
            </div>

            {/* Smart Passkey Assistant for Open */}
            <div className="pt-2 border-t border-[#1E293B]">
              <SmartPasskeyAssistant
                idPrefix="link-open-passkey"
                value={openPassphrase}
                onChange={(newKey) => setOpenPassphrase(newKey)}
                mode="decode"
                placeholder="Enter container passphrase or drop photo key..."
              />
            </div>

            {openError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{openError}</span>
              </div>
            )}

            <button
              type="button"
              disabled={isOpening}
              onClick={handleOpenLink}
              className="w-full py-3 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-[#14B8A6]/20 flex items-center justify-center gap-2"
            >
              {isOpening ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Unpacking &amp; Verifying Container...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Verify &amp; Unpack Secret Container</span>
                </>
              )}
            </button>
          </div>

          {/* Verification Results Panel */}
          <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <h3 className="text-base font-bold font-['Sora'] text-white">
                Verification &amp; Extracted Secret
              </h3>

              {openedResult ? (
                <div className="space-y-4">
                  {/* Status Badges */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-[#14B8A6]" />
                      <div>
                        <div className="text-[10px] text-[#64748B]">TTL Policy</div>
                        <div className="text-xs font-bold text-[#14B8A6]">Valid Window</div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] flex items-center gap-2.5">
                      {openedResult.carrierVerified ? (
                        <FileCheck className="w-4 h-4 text-[#14B8A6]" />
                      ) : (
                        <FileWarning className="w-4 h-4 text-[#EAB308]" />
                      )}
                      <div>
                        <div className="text-[10px] text-[#64748B]">Carrier Integrity</div>
                        <div
                          className={`text-xs font-bold ${openedResult.carrierVerified ? 'text-[#14B8A6]' : 'text-[#EAB308]'}`}
                        >
                          {openedResult.carrierVerified
                            ? 'BLAKE2b Verified'
                            : 'Carrier Not Supplied'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {openMethodNote && (
                    <div className="p-2.5 rounded-lg bg-[#14B8A6]/10 border border-[#14B8A6]/30 text-xs text-[#14B8A6] flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>{openMethodNote}</span>
                    </div>
                  )}

                  {/* Secret Payload Viewer */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="unpacked-secret-payload"
                        className="text-xs font-semibold text-[#E2E8F0]"
                      >
                        Unpacked Secret Payload
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(new TextDecoder().decode(openedResult.payloadBytes))
                        }
                        className="text-[10px] text-[#A855F7] hover:underline flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy Secret</span>
                      </button>
                    </div>
                    <textarea
                      id="unpacked-secret-payload"
                      readOnly
                      rows={5}
                      value={new TextDecoder().decode(openedResult.payloadBytes)}
                      className="w-full p-3 rounded-xl bg-[#0B0F19] border border-[#14B8A6]/40 text-xs font-mono text-[#E2E8F0] focus:outline-none resize-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#1E293B] rounded-xl text-[#64748B] space-y-2">
                  <ShieldAlert className="w-8 h-8 opacity-40 text-[#14B8A6]" />
                  <p className="text-xs">
                    Drop a Stego Carrier Image or paste an OMBRIX Link URI / JSON bundle to unpack.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
