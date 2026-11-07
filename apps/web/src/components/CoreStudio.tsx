import { validatePngOrThrow } from '@ombrix/image-validation';
import type { PngMetadata } from '@ombrix/image-validation';
import { parseEnvelope, serializeEnvelope } from '@ombrix/payload-protocol';
import type { Omb1Envelope } from '@ombrix/payload-protocol';
import type { CapacityReport } from '@ombrix/stego-interface';
import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import { StegoWorkerClient } from '@ombrix/stego-worker';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

export const CoreStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'hide' | 'reveal'>('hide');

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
  const [extractError, setExtractError] = useState<string | null>(null);
  const extractAbortRef = useRef<AbortController | null>(null);

  // Worker client ref
  const workerClientRef = useRef<StegoWorkerClient | null>(null);

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
    // 32 bytes header + payload length
    effectivePayloadLength = 32 + rawPayloadBytes.length;
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

        const envelope: Omb1Envelope = {
          version: 1,
          cryptoSuite: 'NONE',
          stegoMethod: 'PNG_LSB_SEQUENTIAL',
          flags: {},
          messageId: randomMsgId,
          payload: rawPayloadBytes,
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
        setExtractedPayloadText(new TextDecoder().decode(envelope.payload));
      } else {
        // Plain text fallback
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

              {/* Protocol Options */}
              <div className="p-3 rounded-lg bg-[#0B0F19] border border-[#1E293B] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#7C3AED]" />
                    <span className="text-xs font-medium text-white">
                      OMB1 Binary Envelope Framing
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={useEnvelope}
                    onChange={(e) => setUseEnvelope(e.target.checked)}
                    className="rounded bg-[#111827] border-[#334155] text-[#7C3AED] focus:ring-[#7C3AED]"
                  />
                </div>
                <p className="text-[11px] text-[#64748B]">
                  Encapsulates payload into standard OMB1 header with magic bytes, version 1,
                  128-bit message ID, and IEEE 802.3 CRC32 header verification.
                </p>
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

                  <div className="space-y-1.5">
                    <label htmlFor="extracted-content-textarea" className="text-xs text-[#94A3B8]">
                      Recovered Payload Text
                    </label>
                    <textarea
                      id="extracted-content-textarea"
                      readOnly
                      value={extractedPayloadText}
                      rows={5}
                      className="w-full p-3 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-[#14B8A6] font-mono text-xs focus:outline-none resize-none"
                    />
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
