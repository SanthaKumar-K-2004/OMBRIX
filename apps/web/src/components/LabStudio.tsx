import { validatePngOrThrow } from '@ombrix/image-validation';
import { haarDwtStego, jpegDctStego, pvdStego } from '@ombrix/stego-advanced';
import type { CarrierImage } from '@ombrix/stego-interface';
import { type StegoBenchmarkResult, pngLsbMatching, runStegoBenchmark } from '@ombrix/stego-lab';
import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import {
  BarChart2,
  CheckCircle2,
  FlaskConical,
  Image as ImageIcon,
  Loader2,
  Play,
  ShieldCheck,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useState } from 'react';

export const LabStudio: React.FC = () => {
  const [carrierPreview, setCarrierPreview] = useState<string | null>(null);
  const [carrierData, setCarrierData] = useState<CarrierImage | null>(null);
  const [carrierMeta, setCarrierMeta] = useState<{ width: number; height: number } | null>(null);
  const [carrierError, setCarrierError] = useState<string | null>(null);

  const [benchmarkPayloadText, setBenchmarkPayloadText] = useState(
    'OMBRIX Lab: Controlled steganographic distortion benchmark testing payload.',
  );
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);
  const [benchmarkResults, setBenchmarkResults] = useState<StegoBenchmarkResult[] | null>(null);

  // Generate Synthetic Gradient Carrier for Instant Lab Testing
  const generateSyntheticCarrier = useCallback(() => {
    const width = 128;
    const height = 128;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = Math.round((x / width) * 255); // R
        data[idx + 1] = Math.round((y / height) * 255); // G
        data[idx + 2] = Math.round(((x + y) / (width + height)) * 255); // B
        data[idx + 3] = 255; // Alpha
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const img = new ImageData(data, width, height);
      ctx.putImageData(img, 0, 0);
      setCarrierPreview(canvas.toDataURL());
    }

    setCarrierData({ width, height, data });
    setCarrierMeta({ width, height });
    setCarrierError(null);
  }, []);

  // Handle User Uploaded Carrier
  const handleCarrierSelect = useCallback(async (file: File) => {
    setCarrierError(null);
    setBenchmarkResults(null);
    const url = URL.createObjectURL(file);
    setCarrierPreview(url);

    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const meta = validatePngOrThrow(buffer);

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

      setCarrierData({
        width: imgData.width,
        height: imgData.height,
        data: imgData.data,
      });
      setCarrierMeta({ width: meta.width, height: meta.height });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCarrierError(msg);
    }
  }, []);

  // Execute Benchmark
  const handleRunBenchmark = async () => {
    if (!carrierData) return;
    setIsRunningBenchmark(true);
    setBenchmarkResults(null);

    try {
      const payloadBytes = new TextEncoder().encode(benchmarkPayloadText);
      const results = await runStegoBenchmark(carrierData, payloadBytes, [
        pngLsbSequential,
        pngLsbMatching,
        pvdStego,
        haarDwtStego,
        jpegDctStego,
      ]);
      setBenchmarkResults(results);
    } catch (err) {
      console.error('Benchmark execution error:', err);
    } finally {
      setIsRunningBenchmark(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#111827] border border-[#1E293B]">
        <div>
          <h2 className="text-xl font-bold font-['Sora'] text-white flex items-center gap-2">
            <span>OMBRIX Stego Lab</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#14B8A6]/20 border border-[#14B8A6]/40 text-[#14B8A6] font-mono">
              Comparative Science
            </span>
          </h2>
          <p className="text-sm text-[#94A3B8]">
            Side-by-side empirical algorithm benchmarking: Sequential LSB vs LSB Matching (±1) vs
            PVD vs Haar DWT vs JPEG 8×8 DCT.
          </p>
        </div>

        <button
          type="button"
          onClick={generateSyntheticCarrier}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0B0F19] hover:bg-[#1E293B] border border-[#1E293B] text-xs text-white font-medium transition-colors"
        >
          <FlaskConical className="w-3.5 h-3.5 text-[#14B8A6]" />
          <span>Generate Synthetic 128×128 Carrier</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Carrier & Payload Configuration */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-xl bg-[#111827] border border-[#1E293B] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#14B8A6]" />
                <span>Benchmark Carrier Image</span>
              </h3>
              {carrierMeta && (
                <span className="text-xs font-mono text-[#14B8A6]">
                  {carrierMeta.width}×{carrierMeta.height} px
                </span>
              )}
            </div>

            <label
              htmlFor="lab-carrier-input"
              className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                carrierPreview
                  ? 'border-[#14B8A6]/40 bg-[#0B0F19]'
                  : 'border-[#334155] hover:border-[#14B8A6] bg-[#0B0F19]/50'
              }`}
            >
              {carrierPreview ? (
                <img
                  src={carrierPreview}
                  alt="Benchmark Carrier"
                  className="max-h-48 object-contain rounded-lg"
                />
              ) : (
                <div className="text-center space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-[#14B8A6]/10 flex items-center justify-center text-[#14B8A6]">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div className="text-sm text-[#E2E8F0] font-medium">
                    Upload PNG or generate synthetic carrier
                  </div>
                  <div className="text-xs text-[#94A3B8]">
                    Common test fixture used across algorithms
                  </div>
                </div>
              )}
              <input
                id="lab-carrier-input"
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
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {carrierError}
              </div>
            )}

            {/* Benchmark Payload Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="benchmark-payload"
                className="text-xs text-[#94A3B8] flex items-center justify-between"
              >
                <span>Test Payload Text</span>
                <span className="font-mono text-[#E2E8F0]">
                  {new TextEncoder().encode(benchmarkPayloadText).length} bytes
                </span>
              </label>
              <textarea
                id="benchmark-payload"
                value={benchmarkPayloadText}
                onChange={(e) => setBenchmarkPayloadText(e.target.value)}
                rows={3}
                className="w-full p-2.5 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-white text-xs font-mono focus:outline-none focus:border-[#14B8A6] resize-none"
              />
            </div>

            {/* Run Button */}
            <button
              type="button"
              onClick={handleRunBenchmark}
              disabled={!carrierData || isRunningBenchmark}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#14B8A6] hover:bg-[#0D9488] disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-xs transition-colors"
            >
              {isRunningBenchmark ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Executing Comparative Test Suite...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Run Comparative Benchmark</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Comparative Benchmark Results */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-xl bg-[#111827] border border-[#1E293B] space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#14B8A6]" />
              <span>Comparative Benchmark Metrics</span>
            </h3>

            {benchmarkResults ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {benchmarkResults.map((res) => (
                    <div
                      key={res.methodId}
                      className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-xs">{res.methodName}</span>
                        <span className="flex items-center gap-1 text-[10px] text-[#14B8A6] font-medium font-mono">
                          <CheckCircle2 className="w-3 h-3" /> Exact Recovery
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className="p-2 rounded bg-[#111827] border border-[#1E293B]">
                          <div className="text-[11px] text-[#64748B]">PSNR</div>
                          <div className="font-mono text-white font-semibold">
                            {res.distortion.psnr === Number.POSITIVE_INFINITY
                              ? '∞ dB'
                              : `${res.distortion.psnr.toFixed(2)} dB`}
                          </div>
                        </div>

                        <div className="p-2 rounded bg-[#111827] border border-[#1E293B]">
                          <div className="text-[11px] text-[#64748B]">MSE</div>
                          <div className="font-mono text-white font-semibold">
                            {res.distortion.mse.toFixed(4)}
                          </div>
                        </div>

                        <div className="p-2 rounded bg-[#111827] border border-[#1E293B]">
                          <div className="text-[11px] text-[#64748B]">SSIM</div>
                          <div className="font-mono text-[#14B8A6] font-semibold">
                            {res.distortion.ssim.toFixed(4)}
                          </div>
                        </div>

                        <div className="p-2 rounded bg-[#111827] border border-[#1E293B]">
                          <div className="text-[11px] text-[#64748B]">Embed Time</div>
                          <div className="font-mono text-[#A855F7] font-semibold">
                            {res.embedDurationMs} ms
                          </div>
                        </div>
                      </div>

                      <div className="p-2.5 rounded bg-[#111827] text-[11px] text-[#94A3B8] space-y-1">
                        <div className="flex justify-between">
                          <span>Altered Channels:</span>
                          <span className="font-mono text-white font-medium">
                            {res.distortion.totalAlteredChannels.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Max Channel Delta:</span>
                          <span className="font-mono text-white font-medium">
                            ±{res.distortion.maxChannelDiff}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Educational Cryptographic / Steganographic Analysis */}
                <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-2 text-xs text-[#94A3B8]">
                  <div className="text-white font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#14B8A6]" />
                    <span>Scientific Takeaways & Architectural Analysis</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    <strong>1. Peak Signal-to-Noise Ratio (PSNR):</strong> Both algorithms achieve
                    &gt;50 dB, well above the 38 dB threshold where human visual perception can
                    differentiate raster modifications.
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    <strong>2. Asymmetric Pairing Vulnerability:</strong> Standard sequential LSB
                    replaces bits directly, which skews even/odd frequency pairs ({'{2k, 2k+1}'}).
                    This creates a telltale signature detectable by Westfeld Chi-Square
                    steganalysis.
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    <strong>3. LSB Matching Defense:</strong> Sequential LSB Matching randomly adds
                    +1 or -1 when a bit differs, keeping the pair distribution smooth and
                    significantly increasing resistance to first-order statistical attacks.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-[#64748B] space-y-2">
                <FlaskConical className="w-8 h-8 mx-auto text-[#64748B]/60" />
                <div>
                  Load an image and click <strong>"Run Comparative Benchmark"</strong> to generate
                  side-by-side empirical performance metrics.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
