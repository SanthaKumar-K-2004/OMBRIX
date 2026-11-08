import {
  type BitIndex,
  type ColorChannel,
  type DifferenceMapResult,
  type ImageHistogram,
  computeDifferenceMap,
  computeHistogram,
  extractBitplane,
} from '@ombrix/carrier-lens';
import { validatePngOrThrow } from '@ombrix/image-validation';
import type { PngMetadata } from '@ombrix/image-validation';
import type { CarrierImage } from '@ombrix/stego-interface';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileSearch,
  Image as ImageIcon,
  Layers,
  ZoomIn,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { studioDataBus } from '../services/studioDataBus.js';

export const LensStudio: React.FC = () => {
  const [_carrierFile, setCarrierFile] = useState<File | null>(null);
  const [carrierPreview, setCarrierPreview] = useState<string | null>(null);
  const [carrierMeta, setCarrierMeta] = useState<PngMetadata | null>(null);
  const [carrierError, setCarrierError] = useState<string | null>(null);
  const [carrierImageData, setCarrierImageData] = useState<CarrierImage | null>(null);

  // Comparison / Stego image for difference mapping
  const [_compareFile, setCompareFile] = useState<File | null>(null);
  const [comparePreview, setComparePreview] = useState<string | null>(null);
  const [compareImageData, setCompareImageData] = useState<CarrierImage | null>(null);

  // Lens Sub-tools
  const [activeTool, setActiveTool] = useState<'bitplane' | 'histogram' | 'diffmap'>('bitplane');

  // Bitplane Tool State
  const [selectedChannel, setSelectedChannel] = useState<ColorChannel>('r');
  const [selectedBit, setSelectedBit] = useState<BitIndex>(0);
  const [invertBitplane, setInvertBitplane] = useState<boolean>(false);
  const bitplaneCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Histogram Tool State
  const [histogramData, setHistogramData] = useState<ImageHistogram | null>(null);
  const [activeHistogramChannel, setActiveHistogramChannel] = useState<
    'r' | 'g' | 'b' | 'luminance'
  >('luminance');

  // Difference Map State
  const [amplification, setAmplification] = useState<number>(100);
  const [diffResult, setDiffResult] = useState<DifferenceMapResult | null>(null);
  const diffCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Clean up object URLs when previews change or unmount
  useEffect(() => {
    return () => {
      if (carrierPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(carrierPreview);
      }
    };
  }, [carrierPreview]);

  useEffect(() => {
    return () => {
      if (comparePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(comparePreview);
      }
    };
  }, [comparePreview]);

  // Handle Primary Carrier Load
  const handleCarrierSelect = useCallback(async (file: File) => {
    setCarrierFile(file);
    setCarrierError(null);
    setCarrierMeta(null);
    setCarrierImageData(null);
    setHistogramData(null);

    const url = URL.createObjectURL(file);
    setCarrierPreview(url);

    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const meta = validatePngOrThrow(buffer);
      setCarrierMeta(meta);

      const img = new Image();
      img.src = url;
      await img.decode();

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Could not acquire 2D canvas context.');

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const carrier: CarrierImage = {
        width: imgData.width,
        height: imgData.height,
        data: imgData.data,
      };

      setCarrierImageData(carrier);

      // Compute histograms
      const hist = computeHistogram(carrier);
      setHistogramData(hist);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCarrierError(msg);
    }
  }, []);

  // Listen for incoming carriers from Studio Data Bus
  useEffect(() => {
    const unsubscribe = studioDataBus.subscribeCarrier(async (payload) => {
      if (!payload?.dataUrl) return;
      try {
        const res = await fetch(payload.dataUrl);
        const blob = await res.blob();
        const file = new File([blob], payload.name || 'carrier.png', { type: 'image/png' });
        await handleCarrierSelect(file);
      } catch (_err) {
        // Ignore fallback
      }
    });
    return unsubscribe;
  }, [handleCarrierSelect]);

  // Handle Secondary Comparison Carrier Load
  const handleCompareSelect = useCallback(async (file: File) => {
    setCompareFile(file);
    const url = URL.createObjectURL(file);
    setComparePreview(url);

    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      validatePngOrThrow(buffer);

      const img = new Image();
      img.src = url;
      await img.decode();

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Could not acquire 2D canvas context.');

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setCompareImageData({
        width: imgData.width,
        height: imgData.height,
        data: imgData.data,
      });
    } catch (err) {
      console.error('Failed to load comparison image:', err);
    }
  }, []);

  // Render Bitplane on Canvas
  useEffect(() => {
    if (!carrierImageData || !bitplaneCanvasRef.current || activeTool !== 'bitplane') return;

    const result = extractBitplane(carrierImageData, {
      channel: selectedChannel,
      bitIndex: selectedBit,
      invert: invertBitplane,
    });

    const canvas = bitplaneCanvasRef.current;
    canvas.width = result.width;
    canvas.height = result.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const newImg = new ImageData(new Uint8ClampedArray(result.data), result.width, result.height);
      ctx.putImageData(newImg, 0, 0);
    }
  }, [carrierImageData, selectedChannel, selectedBit, invertBitplane, activeTool]);

  // Render Difference Map on Canvas
  useEffect(() => {
    if (
      !carrierImageData ||
      !compareImageData ||
      !diffCanvasRef.current ||
      activeTool !== 'diffmap'
    )
      return;

    try {
      const result = computeDifferenceMap(carrierImageData, compareImageData, {
        amplification,
      });
      setDiffResult(result);

      const canvas = diffCanvasRef.current;
      canvas.width = result.width;
      canvas.height = result.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const newImg = new ImageData(
          new Uint8ClampedArray(result.data),
          result.width,
          result.height,
        );
        ctx.putImageData(newImg, 0, 0);
      }
    } catch (err) {
      console.error('Diffmap error:', err);
    }
  }, [carrierImageData, compareImageData, amplification, activeTool]);

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#111827] border border-[#1E293B]">
        <div>
          <h2 className="text-xl font-bold font-['Sora'] text-white flex items-center gap-2">
            <span>OMBRIX Lens</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#3B82F6]/20 border border-[#3B82F6]/40 text-[#3B82F6] font-mono">
              Visual Forensics
            </span>
          </h2>
          <p className="text-sm text-[#94A3B8]">
            Multi-channel bitplane analysis, RGB frequency histograms, and amplified pixel
            difference mapping.
          </p>
        </div>

        {/* Sub-tool switcher */}
        <div className="inline-flex p-1 rounded-lg bg-[#0B0F19] border border-[#1E293B]">
          <button
            type="button"
            onClick={() => setActiveTool('bitplane')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTool === 'bitplane'
                ? 'bg-[#3B82F6] text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Bitplanes</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('histogram')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTool === 'histogram'
                ? 'bg-[#3B82F6] text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Histograms</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('diffmap')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTool === 'diffmap'
                ? 'bg-[#3B82F6] text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>Difference Map</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Carrier Selector & Inspection */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-xl bg-[#111827] border border-[#1E293B] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#3B82F6]" />
                <span>Source Image to Inspect</span>
              </h3>
              {carrierMeta && (
                <span className="flex items-center gap-1 text-xs text-[#14B8A6] font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Validated PNG
                </span>
              )}
            </div>

            <label
              htmlFor="lens-carrier-input"
              className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                carrierPreview
                  ? 'border-[#3B82F6]/40 bg-[#0B0F19]'
                  : 'border-[#334155] hover:border-[#3B82F6] bg-[#0B0F19]/50'
              }`}
            >
              {carrierPreview ? (
                <img
                  src={carrierPreview}
                  alt="Source Carrier"
                  className="max-h-52 object-contain rounded-lg"
                />
              ) : (
                <div className="text-center space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-[#3B82F6]/10 flex items-center justify-center text-[#3B82F6]">
                    <FileSearch className="w-5 h-5" />
                  </div>
                  <div className="text-sm text-[#E2E8F0] font-medium">
                    Upload PNG for bitplane inspection
                  </div>
                  <div className="text-xs text-[#94A3B8]">
                    Strict header verification & bomb defense
                  </div>
                </div>
              )}
              <input
                id="lens-carrier-input"
                type="file"
                accept="image/png"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCarrierSelect(f);
                }}
              />
            </label>

            {carrierError && (
              <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{carrierError}</span>
              </div>
            )}

            {carrierMeta && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
                <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                  <div className="text-[#64748B]">Resolution</div>
                  <div className="font-mono text-white font-semibold">
                    {carrierMeta.width}×{carrierMeta.height}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                  <div className="text-[#64748B]">Bit Depth</div>
                  <div className="font-mono text-white font-semibold">
                    {carrierMeta.bitDepth}-bit
                  </div>
                </div>
                <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                  <div className="text-[#64748B]">Color Type</div>
                  <div className="font-mono text-white font-semibold">
                    {carrierMeta.colorTypeName}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Secondary comparison carrier selector (Active only in DiffMap mode) */}
          {activeTool === 'diffmap' && (
            <div className="p-5 rounded-xl bg-[#111827] border border-[#1E293B] space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ZoomIn className="w-4 h-4 text-[#A855F7]" />
                <span>Modified / Stego Candidate to Compare</span>
              </h3>

              <label
                htmlFor="lens-compare-input"
                className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  comparePreview
                    ? 'border-[#A855F7]/40 bg-[#0B0F19]'
                    : 'border-[#334155] hover:border-[#A855F7] bg-[#0B0F19]/50'
                }`}
              >
                {comparePreview ? (
                  <img
                    src={comparePreview}
                    alt="Compare Candidate"
                    className="max-h-40 object-contain rounded-lg"
                  />
                ) : (
                  <div className="text-center space-y-1">
                    <div className="text-xs text-[#E2E8F0] font-medium">
                      Select modified or stego PNG
                    </div>
                    <div className="text-[11px] text-[#94A3B8]">
                      Must match original image dimensions exactly
                    </div>
                  </div>
                )}
                <input
                  id="lens-compare-input"
                  type="file"
                  accept="image/png"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCompareSelect(f);
                  }}
                />
              </label>

              {/* Amplification factor slider */}
              <div className="space-y-1.5 p-3 rounded-lg bg-[#0B0F19] border border-[#1E293B]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#94A3B8]">Difference Amplification Factor</span>
                  <span className="font-mono text-[#A855F7] font-semibold">{amplification}×</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="255"
                  value={amplification}
                  onChange={(e) => setAmplification(Number(e.target.value))}
                  className="w-full accent-[#A855F7]"
                />
                <div className="flex justify-between text-[10px] text-[#64748B]">
                  <span>1× (Subtle)</span>
                  <span>100× (Recommended)</span>
                  <span>255× (Max Contrast)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Visualizer Viewport */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-xl bg-[#111827] border border-[#1E293B] space-y-4">
            {/* TOOL 1: Bitplane Visualizer */}
            {activeTool === 'bitplane' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#3B82F6]" />
                    <span className="text-sm font-semibold text-white">Bitplane Slice Viewer</span>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-[#94A3B8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={invertBitplane}
                      onChange={(e) => setInvertBitplane(e.target.checked)}
                      className="rounded bg-[#0B0F19] border-[#334155] text-[#3B82F6]"
                    />
                    <span>Invert Polarity</span>
                  </label>
                </div>

                {/* Channel Selector Buttons */}
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {(['r', 'g', 'b', 'a'] as ColorChannel[]).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setSelectedChannel(ch)}
                      className={`py-2 px-3 rounded-lg font-semibold uppercase tracking-wider transition-all ${
                        selectedChannel === ch
                          ? ch === 'r'
                            ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                            : ch === 'g'
                              ? 'bg-green-500/20 border border-green-500/50 text-green-400'
                              : ch === 'b'
                                ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400'
                                : 'bg-slate-500/20 border border-slate-500/50 text-slate-300'
                          : 'bg-[#0B0F19] border border-[#1E293B] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {ch === 'r' ? 'Red' : ch === 'g' ? 'Green' : ch === 'b' ? 'Blue' : 'Alpha'}
                    </button>
                  ))}
                </div>

                {/* Bit Index Selector (0 to 7) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                    <span>Bit Depth Slice (Bit 0 = LSB, Bit 7 = MSB)</span>
                    <span className="font-mono text-white font-semibold">
                      Bit {selectedBit}{' '}
                      {selectedBit === 0
                        ? '(LSB - Noise Layer)'
                        : selectedBit === 7
                          ? '(MSB - Structural Layer)'
                          : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-8 gap-1.5">
                    {([0, 1, 2, 3, 4, 5, 6, 7] as BitIndex[]).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setSelectedBit(b)}
                        className={`py-2 rounded font-mono text-xs font-semibold transition-all ${
                          selectedBit === b
                            ? 'bg-[#3B82F6] text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                            : 'bg-[#0B0F19] border border-[#1E293B] text-[#94A3B8] hover:text-white'
                        }`}
                      >
                        b{b}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Canvas Display */}
                <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] flex items-center justify-center min-h-[320px] overflow-auto">
                  {carrierImageData ? (
                    <canvas
                      ref={bitplaneCanvasRef}
                      className="max-h-[420px] object-contain rounded shadow-lg"
                    />
                  ) : (
                    <div className="text-center text-xs text-[#64748B]">
                      Upload a PNG carrier image on the left to extract and render its bitplanes.
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-[11px] text-[#64748B] flex items-start gap-2">
                  <Eye className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#3B82F6]" />
                  <span>
                    Educational Insight: Bit 0 (LSB) contains high-entropy sensor noise. In an
                    LSB-steganographic carrier, embedded ciphertext appears as pure pseudo-random
                    static in Bit 0 while higher bitplanes (Bits 4-7) preserve the image contours.
                  </span>
                </div>
              </div>
            )}

            {/* TOOL 2: Histogram Visualization */}
            {activeTool === 'histogram' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#3B82F6]" />
                    <span className="text-sm font-semibold text-white">
                      RGB Frequency Distribution (256 Bins)
                    </span>
                  </div>

                  {/* Channel Toggle */}
                  <div className="inline-flex p-1 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-xs">
                    {(['luminance', 'r', 'g', 'b'] as const).map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setActiveHistogramChannel(ch)}
                        className={`px-3 py-1 rounded capitalize font-medium transition-all ${
                          activeHistogramChannel === ch
                            ? 'bg-[#3B82F6] text-white'
                            : 'text-[#94A3B8] hover:text-white'
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SVG Histogram Chart */}
                <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] min-h-[320px] flex items-center justify-center">
                  {histogramData ? (
                    <div className="w-full space-y-2">
                      <svg
                        viewBox="0 0 256 120"
                        className="w-full h-64 overflow-visible"
                        aria-label="Color Channel Histogram"
                      >
                        <title>Color Channel Histogram</title>
                        {(() => {
                          const counts = histogramData[activeHistogramChannel];
                          let maxVal = 1;
                          for (let i = 0; i < 256; i++) {
                            const c = counts[i] ?? 0;
                            if (c > maxVal) maxVal = c;
                          }

                          const color =
                            activeHistogramChannel === 'r'
                              ? '#EF4444'
                              : activeHistogramChannel === 'g'
                                ? '#22C55E'
                                : activeHistogramChannel === 'b'
                                  ? '#3B82F6'
                                  : '#A855F7';

                          return (
                            <>
                              {Array.from({ length: 256 }).map((_, i) => {
                                const c = counts[i] ?? 0;
                                const barHeight = (c / maxVal) * 110;
                                const barKey = `bar-${activeHistogramChannel}-${i}`;
                                return (
                                  <rect
                                    key={barKey}
                                    x={i}
                                    y={120 - barHeight}
                                    width={1}
                                    height={barHeight}
                                    fill={color}
                                    opacity={0.85}
                                  />
                                );
                              })}
                            </>
                          );
                        })()}
                      </svg>
                      <div className="flex justify-between text-[11px] font-mono text-[#64748B] pt-2 border-t border-[#1E293B]">
                        <span>Level 0 (Dark)</span>
                        <span>Level 128 (Midtone)</span>
                        <span>Level 255 (Highlights)</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-xs text-[#64748B]">
                      Upload a PNG carrier image to compute 256-bin channel histograms.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TOOL 3: Difference Map */}
            {activeTool === 'diffmap' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ZoomIn className="w-4 h-4 text-[#A855F7]" />
                    <span className="text-sm font-semibold text-white">
                      Amplified Pixel Difference Map
                    </span>
                  </div>
                  {diffResult && (
                    <span className="text-xs font-mono text-[#14B8A6]">
                      Altered Pixels: {diffResult.totalDiffPixels.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] flex items-center justify-center min-h-[320px] overflow-auto">
                  {carrierImageData && compareImageData ? (
                    <canvas
                      ref={diffCanvasRef}
                      className="max-h-[420px] object-contain rounded shadow-lg"
                    />
                  ) : (
                    <div className="text-center text-xs text-[#64748B] max-w-sm">
                      Upload both an original PNG carrier and a modified stego image to visualize
                      altered pixel channels with {amplification}× amplification.
                    </div>
                  )}
                </div>

                {diffResult && (
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                      <div className="text-[#64748B]">Max Channel Diff</div>
                      <div className="font-mono text-white font-semibold">
                        {diffResult.maxDiff} / 255
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                      <div className="text-[#64748B]">Altered Pixels</div>
                      <div className="font-mono text-[#A855F7] font-semibold">
                        {diffResult.totalDiffPixels.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                      <div className="text-[#64748B]">Average Perturbation</div>
                      <div className="font-mono text-[#14B8A6] font-semibold">
                        {diffResult.averageDiff.toFixed(4)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
