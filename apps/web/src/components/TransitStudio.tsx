import { validatePngOrThrow } from '@ombrix/image-validation';
import type { CarrierImage } from '@ombrix/stego-interface';
import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import {
  type ChiSquareReport,
  type TransitSimulationResult,
  type TransitTransformType,
  analyzeChiSquare,
  runTransitSimulation,
} from '@ombrix/transit-trace';
import {
  CheckCircle2,
  FileSearch,
  Image as ImageIcon,
  Loader2,
  Play,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useState } from 'react';

export const TransitStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'transit' | 'trace'>('transit');

  // Carrier State
  const [carrierPreview, setCarrierPreview] = useState<string | null>(null);
  const [carrierData, setCarrierData] = useState<CarrierImage | null>(null);
  const [_carrierMeta, setCarrierMeta] = useState<{ width: number; height: number } | null>(null);
  const [carrierError, setCarrierError] = useState<string | null>(null);

  // Transit Simulation State
  const [transformType, setTransformType] = useState<TransitTransformType>('JPEG');
  const [jpegQuality, setJpegQuality] = useState<number>(75);
  const [scaleFactor, setScaleFactor] = useState<number>(0.75);
  const [errorRate, setErrorRate] = useState<number>(0.01);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<TransitSimulationResult | null>(null);
  const [simPreviewUrl, setSimPreviewUrl] = useState<string | null>(null);

  // Trace (Chi-Square) State
  const [isAnalyzingTrace, setIsAnalyzingTrace] = useState<boolean>(false);
  const [traceReport, setTraceReport] = useState<ChiSquareReport | null>(null);

  // Generate Synthetic Stego Carrier for Instant Testing
  const generateSampleStegoCarrier = useCallback(async () => {
    const width = 120;
    const height = 120;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < data.length; i += 4) {
      data[i] = (i * 3) % 256;
      data[i + 1] = (i * 5) % 256;
      data[i + 2] = (i * 7) % 256;
      data[i + 3] = 255;
    }

    const carrier = { width, height, data };
    const samplePayload = new TextEncoder().encode(
      'OMBRIX Transit Resilience Verification: Testing survival against lossy channels.',
    );

    // Embed using standard sequential LSB
    const stego = await pngLsbSequential.embed(carrier, samplePayload);

    // Render to data url for preview
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(new ImageData(new Uint8ClampedArray(stego.data), width, height), 0, 0);
      setCarrierPreview(canvas.toDataURL());
    }

    setCarrierData(stego);
    setCarrierMeta({ width, height });
    setCarrierError(null);
    setSimResult(null);
    setTraceReport(null);
  }, []);

  // Handle User Uploaded Carrier
  const handleCarrierSelect = useCallback(async (file: File) => {
    setCarrierError(null);
    setSimResult(null);
    setTraceReport(null);
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

  // Run Transit Transformation Simulation
  const handleRunSimulation = async () => {
    if (!carrierData) return;
    setIsSimulating(true);
    setSimResult(null);
    setSimPreviewUrl(null);

    try {
      const result = await runTransitSimulation(carrierData, pngLsbSequential, transformType, {
        jpegQuality,
        scaleFactor,
        errorRate,
      });

      setSimResult(result);

      // Create preview URL for transformed image
      const canvas = document.createElement('canvas');
      canvas.width = result.transformedCarrier.width;
      canvas.height = result.transformedCarrier.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(
          new ImageData(
            new Uint8ClampedArray(result.transformedCarrier.data),
            result.transformedCarrier.width,
            result.transformedCarrier.height,
          ),
          0,
          0,
        );
        setSimPreviewUrl(canvas.toDataURL());
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Run Trace Chi-Square Analysis
  const handleRunTraceAnalysis = () => {
    if (!carrierData) return;
    setIsAnalyzingTrace(true);
    try {
      const report = analyzeChiSquare(carrierData);
      setTraceReport(report);
    } catch (err) {
      console.error('Trace analysis error:', err);
    } finally {
      setIsAnalyzingTrace(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#111827] border border-[#1E293B]">
        <div>
          <h2 className="text-xl font-bold font-['Sora'] text-white flex items-center gap-2">
            <span>OMBRIX Transit & Trace</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#EF4444]/20 border border-[#EF4444]/40 text-[#EF4444] font-mono">
              Resilience & Forensics
            </span>
          </h2>
          <p className="text-sm text-[#94A3B8]">
            Simulated lossy transmission channels, survival testing, and Westfeld Chi-Square
            steganalysis.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="inline-flex p-1 rounded-lg bg-[#0B0F19] border border-[#1E293B]">
          <button
            type="button"
            onClick={() => setActiveTab('transit')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'transit'
                ? 'bg-[#3B82F6] text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Transit Simulator</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('trace')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'trace'
                ? 'bg-[#EF4444] text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Trace Forensics (χ²)</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Carrier Selector & Configuration */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-xl bg-[#111827] border border-[#1E293B] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#3B82F6]" />
                <span>Stego Carrier Candidate</span>
              </h3>
              <button
                type="button"
                onClick={generateSampleStegoCarrier}
                className="text-[11px] text-[#3B82F6] hover:underline"
              >
                Use Sample Stego Carrier
              </button>
            </div>

            <label
              htmlFor="transit-carrier-input"
              className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                carrierPreview
                  ? 'border-[#3B82F6]/40 bg-[#0B0F19]'
                  : 'border-[#334155] hover:border-[#3B82F6] bg-[#0B0F19]/50'
              }`}
            >
              {carrierPreview ? (
                <img
                  src={carrierPreview}
                  alt="Stego Carrier Candidate"
                  className="max-h-48 object-contain rounded-lg"
                />
              ) : (
                <div className="text-center space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-[#3B82F6]/10 flex items-center justify-center text-[#3B82F6]">
                    <FileSearch className="w-5 h-5" />
                  </div>
                  <div className="text-sm text-[#E2E8F0] font-medium">
                    Upload PNG carrier to stress test
                  </div>
                  <div className="text-xs text-[#94A3B8]">
                    Or click sample above for instant demonstration
                  </div>
                </div>
              )}
              <input
                id="transit-carrier-input"
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

            {/* TAB 1: Transit Simulation Configuration */}
            {activeTab === 'transit' && (
              <div className="space-y-4 pt-2 border-t border-[#1E293B]">
                <div className="space-y-1.5">
                  <label htmlFor="pipeline-transform-type" className="text-xs text-[#94A3B8]">
                    Transmission Pipeline Transformation
                  </label>
                  <select
                    id="pipeline-transform-type"
                    value={transformType}
                    onChange={(e) => setTransformType(e.target.value as TransitTransformType)}
                    className="w-full p-2.5 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-white text-xs focus:outline-none focus:border-[#3B82F6]"
                  >
                    <option value="JPEG">Lossy JPEG Compression (Quantization)</option>
                    <option value="RESIZE">
                      Canvas Resizing (Downsampling & Bilinear Upsampling)
                    </option>
                    <option value="NOISE">Channel Noise Injection (Random Bitflips)</option>
                    <option value="SOCIAL_MEDIA">
                      Simulated Social Media Pipeline (Resize + JPEG)
                    </option>
                  </select>
                </div>

                {/* Sub-parameters */}
                {transformType === 'JPEG' && (
                  <div className="space-y-1.5 p-3 rounded-lg bg-[#0B0F19] border border-[#1E293B]">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#94A3B8]">JPEG Quality Factor:</span>
                      <span className="font-mono text-white font-semibold">{jpegQuality}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="95"
                      value={jpegQuality}
                      onChange={(e) => setJpegQuality(Number(e.target.value))}
                      className="w-full accent-[#3B82F6]"
                    />
                  </div>
                )}

                {transformType === 'RESIZE' && (
                  <div className="space-y-1.5 p-3 rounded-lg bg-[#0B0F19] border border-[#1E293B]">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#94A3B8]">Scale Factor:</span>
                      <span className="font-mono text-white font-semibold">
                        {(scaleFactor * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="0.9"
                      step="0.05"
                      value={scaleFactor}
                      onChange={(e) => setScaleFactor(Number(e.target.value))}
                      className="w-full accent-[#3B82F6]"
                    />
                  </div>
                )}

                {transformType === 'NOISE' && (
                  <div className="space-y-1.5 p-3 rounded-lg bg-[#0B0F19] border border-[#1E293B]">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#94A3B8]">Bit Error Rate:</span>
                      <span className="font-mono text-white font-semibold">
                        {(errorRate * 100).toFixed(2)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.001"
                      max="0.05"
                      step="0.002"
                      value={errorRate}
                      onChange={(e) => setErrorRate(Number(e.target.value))}
                      className="w-full accent-[#3B82F6]"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleRunSimulation}
                  disabled={!carrierData || isSimulating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs transition-colors"
                >
                  {isSimulating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Simulating Transformation & Testing Recovery...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Simulate Transit & Test Recovery</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* TAB 2: Trace Forensics Runner */}
            {activeTab === 'trace' && (
              <div className="space-y-4 pt-2 border-t border-[#1E293B]">
                <p className="text-xs text-[#94A3B8]">
                  Runs Westfeld &amp; Pfitzmann (1999) Chi-Square attack across 128 Pairs of Values
                  ({'{2k, 2k+1}'}) to detect artificial LSB equalization.
                </p>

                <button
                  type="button"
                  onClick={handleRunTraceAnalysis}
                  disabled={!carrierData || isAnalyzingTrace}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs transition-colors"
                >
                  {isAnalyzingTrace ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Computing χ² Pair Frequency Statistics...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Run Chi-Square (χ²) Steganalysis</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Results & Forensics Analysis */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-xl bg-[#111827] border border-[#1E293B] space-y-4">
            {activeTab === 'transit' ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-[#3B82F6]" />
                  <span>Transit Resilience &amp; Survival Report</span>
                </h3>

                {simResult ? (
                  <div className="space-y-4">
                    {/* Survival Outcome Banner */}
                    {simResult.payloadRecovered ? (
                      <div className="p-4 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/30 text-[#14B8A6] space-y-1">
                        <div className="font-semibold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Payload Survived Transformation</span>
                        </div>
                        <div className="text-xs text-[#14B8A6]/80">
                          Steganographic envelope successfully extracted and verified with zero bit
                          errors.
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 space-y-1.5">
                        <div className="font-semibold flex items-center gap-2">
                          <XCircle className="w-4 h-4" />
                          <span>Payload Destroyed by Transformation</span>
                        </div>
                        <div className="text-xs text-red-400/80 leading-relaxed">
                          {simResult.errorSummary}
                        </div>
                      </div>
                    )}

                    {/* Transformed Image Preview */}
                    {simPreviewUrl && (
                      <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-2">
                        <div className="text-xs text-[#94A3B8]">
                          Post-Transformation Carrier Appearance:
                        </div>
                        <div className="flex items-center justify-center">
                          <img
                            src={simPreviewUrl}
                            alt="Transformed Carrier"
                            className="max-h-56 object-contain rounded-lg"
                          />
                        </div>
                      </div>
                    )}

                    {/* Scientific Explanation */}
                    <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs space-y-2 text-[#94A3B8]">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        <span>Empirical Scientific Fact: Spatial LSB is Fragile</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        Lossy operations (JPEG cosine quantization, bilinear interpolation, or
                        social media downsampling) intentionally discard low-order pixel bit
                        variances. Because spatial LSB encodes payload bits directly into these
                        low-order bits without error-correcting codes or frequency-domain
                        watermarks, lossy transit guarantees payload destruction.
                      </p>
                      <p className="text-[11px] leading-relaxed text-[#64748B]">
                        OMBRIX makes zero false claims of &quot;indestructible&quot; steganography.
                        Transformation resilience must always be proven through empirical
                        simulation.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center text-xs text-[#64748B]">
                    Configure transit parameters and click{' '}
                    <strong>&quot;Simulate Transit&quot;</strong> to observe whether steganographic
                    bytes survive.
                  </div>
                )}
              </div>
            ) : (
              /* TAB 2: Trace Forensics View */
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-[#EF4444]" />
                  <span>Westfeld Chi-Square (χ²) Steganalysis Report</span>
                </h3>

                {traceReport ? (
                  <div className="space-y-4">
                    {/* Verdict Card */}
                    <div
                      className={`p-4 rounded-xl border space-y-1 ${
                        traceReport.anomalyDetected
                          ? 'bg-red-500/10 border-red-500/30 text-red-400'
                          : 'bg-[#14B8A6]/10 border-[#14B8A6]/30 text-[#14B8A6]'
                      }`}
                    >
                      <div className="font-semibold flex items-center gap-2 text-sm">
                        {traceReport.anomalyDetected ? (
                          <>
                            <ShieldAlert className="w-4 h-4 text-red-400" />
                            <span>
                              Steganographic Anomaly Flagged ({traceReport.confidence} Confidence)
                            </span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4 text-[#14B8A6]" />
                            <span>Natural Carrier Distribution (Clean)</span>
                          </>
                        )}
                      </div>
                      <div className="text-xs opacity-85">
                        {traceReport.anomalyDetected
                          ? `Adjacent Pairs of Values demonstrate unnatural frequency equalization (p-value: ${traceReport.pValue}). High statistical likelihood of LSB replacement embedding.`
                          : `Adjacent Pairs of Values maintain natural variance (p-value: ${traceReport.pValue}). No LSB replacement signature detected.`}
                      </div>
                    </div>

                    {/* Statistical Metrics Table */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                        <div className="text-[#64748B]">χ² Statistic</div>
                        <div className="font-mono text-white font-semibold">
                          {traceReport.chiSquare}
                        </div>
                      </div>
                      <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                        <div className="text-[#64748B]">Degrees of Freedom</div>
                        <div className="font-mono text-white font-semibold">
                          {traceReport.degreesOfFreedom}
                        </div>
                      </div>
                      <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B]">
                        <div className="text-[#64748B]">Stego Probability (p)</div>
                        <div
                          className={`font-mono font-semibold ${traceReport.pValue > 0.8 ? 'text-red-400' : 'text-[#14B8A6]'}`}
                        >
                          {(traceReport.pValue * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* Top Deviating Pairs Table */}
                    {traceReport.topDeviatingPairs.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-[#94A3B8]">
                          Sample Pair Frequencies ({'{2k, 2k+1}'})
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-[#1E293B]">
                          <table className="w-full text-left font-mono text-[11px]">
                            <thead className="bg-[#0B0F19] text-[#64748B] border-b border-[#1E293B]">
                              <tr>
                                <th className="p-2">Pair Index (k)</th>
                                <th className="p-2">Even 2k Count</th>
                                <th className="p-2">Odd 2k+1 Count</th>
                                <th className="p-2">Expected Avg</th>
                                <th className="p-2">χ² Contrib</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1E293B]/40">
                              {traceReport.topDeviatingPairs.map((p) => (
                                <tr key={p.pairIndex} className="hover:bg-[#1E293B]/20">
                                  <td className="p-2 text-white">
                                    k={p.pairIndex} ({2 * p.pairIndex}, {2 * p.pairIndex + 1})
                                  </td>
                                  <td className="p-2 text-[#3B82F6]">{p.countEven}</td>
                                  <td className="p-2 text-[#A855F7]">{p.countOdd}</td>
                                  <td className="p-2 text-[#94A3B8]">{p.expected}</td>
                                  <td className="p-2 text-amber-400">{p.chiSquareContribution}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-12 text-center text-xs text-[#64748B]">
                    Click <strong>&quot;Run Chi-Square Steganalysis&quot;</strong> to compute
                    statistical PoV anomalies.
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
