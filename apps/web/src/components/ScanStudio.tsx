import { validatePngOrThrow } from '@ombrix/image-validation';
import { type ForensicsConsensusReport, analyzeConsensus } from '@ombrix/stego-forensics';
import type { CarrierImage } from '@ombrix/stego-interface';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Eye,
  FileSearch,
  Info,
  Layers,
  Loader2,
  Radar,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  Zap,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { studioDataBus } from '../services/studioDataBus.js';

export const ScanStudio: React.FC = () => {
  const [carrierData, setCarrierData] = useState<CarrierImage | null>(null);
  const [carrierMeta, setCarrierMeta] = useState<{
    width: number;
    height: number;
    name: string;
  } | null>(null);
  const [carrierPreview, setCarrierPreview] = useState<string | null>(null);
  const [carrierError, setCarrierError] = useState<string | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [scanReport, setScanReport] = useState<ForensicsConsensusReport | null>(null);

  const heatmapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render Noise Heatmap to Canvas when scanReport is available
  useEffect(() => {
    if (!scanReport || !heatmapCanvasRef.current || !carrierData) return;

    const canvas = heatmapCanvasRef.current;
    canvas.width = carrierData.width;
    canvas.height = carrierData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    import('@ombrix/stego-forensics').then(({ computeNoiseResidual }) => {
      const noise = computeNoiseResidual(carrierData);
      const imgData = ctx.createImageData(noise.width, noise.height);
      imgData.data.set(noise.heatmapData);
      ctx.putImageData(imgData, 0, 0);
    });
  }, [scanReport, carrierData]);

  // Load Clean Synthetic Image
  const loadSyntheticCarrier = useCallback((isStego: boolean) => {
    const width = 128;
    const height = 128;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        let r = Math.round((x / width) * 200 + 20);
        let g = Math.round((y / height) * 200 + 20);
        let b = Math.round(((x + y) / (width + height)) * 200 + 20);

        if (isStego) {
          // Embed pseudo-random LSB perturbations
          r = (r & ~1) | ((x * 13 + y * 7) & 1);
          g = (g & ~1) | ((x * 5 + y * 11) & 1);
          b = (b & ~1) | ((x + y * 3) & 1);
        }

        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
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

    const carrier: CarrierImage = { width, height, data };
    setCarrierData(carrier);
    setCarrierMeta({
      width,
      height,
      name: isStego ? 'synthetic-lsb-stego.png' : 'synthetic-clean-gradient.png',
    });
    setCarrierError(null);

    // Auto run scan
    runForensicsScan(carrier);
  }, []);

  // Handle User Uploaded Carrier
  const handleCarrierUpload = useCallback((file: File) => {
    setCarrierError(null);
    setScanReport(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer) return;

        const bytes = new Uint8Array(buffer);
        // Validate PNG integrity if file is PNG
        if (file.name.toLowerCase().endsWith('.png')) {
          validatePngOrThrow(bytes);
        }

        const blob = new Blob([bytes], { type: file.type || 'image/png' });
        const img = new Image();
        img.src = URL.createObjectURL(blob);

        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not obtain canvas 2D rendering context');

          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);

          const carrier: CarrierImage = {
            width: img.width,
            height: img.height,
            data: imageData.data,
          };

          setCarrierData(carrier);
          setCarrierMeta({ width: img.width, height: img.height, name: file.name });
          setCarrierPreview(img.src);

          runForensicsScan(carrier);
        };
      } catch (err) {
        setCarrierError((err as Error).message);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // Listen for incoming carriers from Studio Data Bus
  useEffect(() => {
    const unsubscribe = studioDataBus.subscribeCarrier(async (payload) => {
      if (!payload?.dataUrl) return;
      try {
        const res = await fetch(payload.dataUrl);
        const blob = await res.blob();
        const file = new File([blob], payload.name || 'carrier.png', { type: 'image/png' });
        handleCarrierUpload(file);
      } catch (_err) {
        // Fallback
      }
    });
    return unsubscribe;
  }, [handleCarrierUpload]);

  const runForensicsScan = (carrier: CarrierImage) => {
    setIsScanning(true);
    setTimeout(() => {
      try {
        const report = analyzeConsensus(carrier);
        setScanReport(report);
      } catch (err) {
        setCarrierError(`Forensics scan error: ${(err as Error).message}`);
      } finally {
        setIsScanning(false);
      }
    }, 50);
  };

  const getVerdictStyle = (verdict?: string) => {
    switch (verdict) {
      case 'CLEAN_BENIGN':
        return {
          border: 'border-emerald-500/30',
          bg: 'bg-emerald-950/20',
          text: 'text-emerald-400',
          badgeBg: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
          icon: ShieldCheck,
          label: 'Clean / Benign Carrier',
        };
      case 'INCONCLUSIVE':
        return {
          border: 'border-amber-500/30',
          bg: 'bg-amber-950/20',
          text: 'text-amber-400',
          badgeBg: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
          icon: AlertTriangle,
          label: 'Inconclusive Distributions',
        };
      case 'SUSPICIOUS_ANOMALY':
        return {
          border: 'border-orange-500/30',
          bg: 'bg-orange-950/20',
          text: 'text-orange-400',
          badgeBg: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
          icon: AlertCircle,
          label: 'Suspicious Statistical Anomaly',
        };
      default:
        return {
          border: 'border-rose-500/30',
          bg: 'bg-rose-950/20',
          text: 'text-rose-400',
          badgeBg: 'bg-rose-500/20 border-rose-500/40 text-rose-300',
          icon: ShieldAlert,
          label: 'Steganography Tampering Detected',
        };
    }
  };

  const verdictStyle = scanReport ? getVerdictStyle(scanReport.verdict) : null;
  const VerdictIcon = verdictStyle?.icon ?? Radar;

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#111827] border border-[#1E293B]">
        <div>
          <h2 className="text-xl font-bold font-['Sora'] text-white flex items-center gap-2">
            <span>OMBRIX Scan</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#06B6D4]/20 border border-[#06B6D4]/40 text-[#06B6D4] font-mono">
              Milestone 18 • Forensics Workbench
            </span>
          </h2>
          <p className="text-sm text-[#94A3B8]">
            Multi-detector statistical steganalysis: RS (Fridrich), SPA (Dumitrescu), Chi-Square
            (Westfeld), and Spatial Noise Residuals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadSyntheticCarrier(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#1E293B] border border-[#1E293B] text-xs text-[#E2E8F0] font-medium transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Load Clean</span>
          </button>
          <button
            type="button"
            onClick={() => loadSyntheticCarrier(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#1E293B] border border-[#1E293B] text-xs text-[#E2E8F0] font-medium transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Load Stego</span>
          </button>
        </div>
      </div>

      {/* Carrier Dropzone & Preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <label
            htmlFor="carrier-scan-upload"
            className="flex flex-col items-center justify-center border-2 border-dashed border-[#1E293B] hover:border-[#06B6D4]/60 rounded-xl p-8 bg-[#111827]/60 cursor-pointer transition-all duration-200 group text-center"
          >
            <UploadCloud className="w-10 h-10 text-[#64748B] group-hover:text-[#06B6D4] mb-3 transition-colors" />
            <span className="text-sm font-medium text-white group-hover:text-[#06B6D4] transition-colors">
              Drop suspect image to perform forensic analysis
            </span>
            <span className="text-xs text-[#64748B] mt-1">
              Supports PNG, JPEG, WebP • Zero telemetry local processing
            </span>
            <input
              id="carrier-scan-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCarrierUpload(file);
              }}
              className="hidden"
            />
          </label>
        </div>

        {/* Carrier Info Card */}
        <div className="p-4 rounded-xl bg-[#111827] border border-[#1E293B] flex flex-col justify-between">
          <div className="flex items-center gap-3">
            {carrierPreview ? (
              <img
                src={carrierPreview}
                alt="Carrier preview"
                className="w-16 h-16 rounded object-cover border border-[#1E293B]"
              />
            ) : (
              <div className="w-16 h-16 rounded bg-[#0B0F19] border border-[#1E293B] flex items-center justify-center">
                <FileSearch className="w-6 h-6 text-[#64748B]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono text-white truncate">
                {carrierMeta?.name ?? 'No image selected'}
              </div>
              <div className="text-[11px] text-[#64748B] mt-0.5">
                {carrierMeta ? `${carrierMeta.width} × ${carrierMeta.height} px` : 'Awaiting input'}
              </div>
              {carrierData && (
                <div className="text-[11px] text-[#06B6D4] mt-0.5 font-mono">
                  {(carrierData.width * carrierData.height).toLocaleString()} pixels
                </div>
              )}
            </div>
          </div>

          {carrierData && (
            <button
              type="button"
              disabled={isScanning}
              onClick={() => runForensicsScan(carrierData)}
              className="mt-4 flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Computing Forensics...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-scan Image</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {carrierError && (
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-400 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{carrierError}</span>
        </div>
      )}

      {/* Main Forensic Analysis Report */}
      {scanReport && verdictStyle && (
        <div className="space-y-6">
          {/* Verdict Banner */}
          <div
            className={`p-6 rounded-xl border ${verdictStyle.border} ${verdictStyle.bg} flex flex-col md:flex-row md:items-center justify-between gap-6`}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <VerdictIcon className={`w-6 h-6 ${verdictStyle.text}`} />
                <span className={`text-lg font-bold font-['Sora'] ${verdictStyle.text}`}>
                  {verdictStyle.label}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium border ${verdictStyle.badgeBg}`}
                >
                  {Math.round(scanReport.confidence * 100)}% Confidence
                </span>
              </div>
              <p className="text-sm text-[#CBD5E1] max-w-2xl leading-relaxed">
                {scanReport.summary}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-[#0B0F19]/80 border border-[#1E293B] shrink-0 min-w-[180px]">
              <span className="text-[11px] font-mono text-[#94A3B8] uppercase tracking-wider">
                Anomaly Score
              </span>
              <div className={`text-3xl font-extrabold font-mono mt-1 ${verdictStyle.text}`}>
                {scanReport.overallAnomalyScore}%
              </div>
              <div className="w-full bg-[#1E293B] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full ${scanReport.overallAnomalyScore > 35 ? 'bg-rose-500' : scanReport.overallAnomalyScore > 15 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, scanReport.overallAnomalyScore)}%` }}
                />
              </div>
            </div>
          </div>

          {/* 4-Detector Scientific Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 1. RS Steganalysis */}
            <div className="p-4 rounded-xl bg-[#111827] border border-[#1E293B] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#06B6D4]" />
                  <span className="text-xs font-bold text-white font-['Sora']">
                    RS Steganalysis
                  </span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono ${scanReport.detectors.rs.classification === 'stego_detected' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}
                >
                  {scanReport.detectors.rs.classification}
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[#94A3B8]">Est. Hidden Ratio:</span>
                  <span className="font-mono text-white font-semibold">
                    {Math.round(scanReport.detectors.rs.estimatedPayloadRatio * 100)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#94A3B8]">Regular R_M:</span>
                  <span className="font-mono text-[#CBD5E1]">{scanReport.detectors.rs.rm}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#94A3B8]">Singular S_M:</span>
                  <span className="font-mono text-[#CBD5E1]">{scanReport.detectors.rs.sm}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#94A3B8]">Dual R_-M:</span>
                  <span className="font-mono text-[#CBD5E1]">
                    {scanReport.detectors.rs.rMinusM}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-[#64748B] pt-1">
                Fridrich et al. dual-mask local variation quadratic curve root.
              </p>
            </div>

            {/* 2. Sample Pair Analysis (SPA) */}
            <div className="p-4 rounded-xl bg-[#111827] border border-[#1E293B] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#14B8A6]" />
                  <span className="text-xs font-bold text-white font-['Sora']">
                    Sample Pair (SPA)
                  </span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono ${scanReport.detectors.spa.classification === 'stego_detected' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}
                >
                  {scanReport.detectors.spa.classification}
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[#94A3B8]">Est. Payload Ratio:</span>
                  <span className="font-mono text-white font-semibold">
                    {Math.round(scanReport.detectors.spa.estimatedPayloadRatio * 100)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#94A3B8]">Primary Set P:</span>
                  <span className="font-mono text-[#CBD5E1]">
                    {scanReport.detectors.spa.primarySetCounts.p.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#94A3B8]">Odd-Even Set X:</span>
                  <span className="font-mono text-[#CBD5E1]">
                    {scanReport.detectors.spa.primarySetCounts.x.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#94A3B8]">Confidence:</span>
                  <span className="font-mono text-[#CBD5E1]">
                    {Math.round(scanReport.detectors.spa.confidence * 100)}%
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-[#64748B] pt-1">
                Dumitrescu et al. closed-form algebraic sample pair analysis.
              </p>
            </div>

            {/* 3. Chi-Square (PoVs) */}
            <div className="p-4 rounded-xl bg-[#111827] border border-[#1E293B] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#F59E0B]" />
                  <span className="text-xs font-bold text-white font-['Sora']">
                    Chi-Square (PoVs)
                  </span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono ${scanReport.detectors.chiSquare.tamperingDetected ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}
                >
                  {scanReport.detectors.chiSquare.tamperingDetected ? 'tampering' : 'clean'}
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[#94A3B8]">Empirical p-value:</span>
                  <span className="font-mono text-white font-semibold">
                    {scanReport.detectors.chiSquare.pValue}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#94A3B8]">Degrees of Freedom:</span>
                  <span className="font-mono text-[#CBD5E1]">
                    {scanReport.detectors.chiSquare.degreesOfFreedom}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#94A3B8]">Equalized Pairs:</span>
                  <span className="font-mono text-[#CBD5E1]">
                    {scanReport.detectors.chiSquare.tamperingDetected ? 'Elevated' : 'Natural'}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-[#64748B] pt-1">
                Westfeld Pairs-of-Values equalization statistical hypothesis test.
              </p>
            </div>

            {/* 4. Spatial Noise Residual */}
            <div className="p-4 rounded-xl bg-[#111827] border border-[#1E293B] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#EC4899]" />
                  <span className="text-xs font-bold text-white font-['Sora']">Noise Residual</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-[#1E293B] text-[#94A3B8]">
                  Laplacian ∇²
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[#94A3B8]">Residual Variance:</span>
                  <span className="font-mono text-white font-semibold">
                    {scanReport.detectors.noiseResidual.variance}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#94A3B8]">HFPI Perturbation:</span>
                  <span className="font-mono text-[#CBD5E1]">
                    {scanReport.detectors.noiseResidual.hfpi} / 100
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-[#64748B] pt-1">
                High-frequency spatial derivative filtering isolating perturbations.
              </p>
            </div>
          </div>

          {/* Noise Residual 2D Spatial Heatmap */}
          <div className="p-5 rounded-xl bg-[#111827] border border-[#1E293B] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white font-['Sora'] flex items-center gap-2">
                  <span>High-Frequency Spatial Noise Heatmap</span>
                  <span className="text-[11px] text-[#64748B] font-mono font-normal">
                    (2nd-Derivative 4-Neighbor Laplacian Filter)
                  </span>
                </h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Visualizes high-frequency variance anomalies across pixel neighborhoods. Warm
                  colors indicate elevated localized noise.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center p-4 bg-[#0B0F19] rounded-lg border border-[#1E293B] overflow-hidden">
              <canvas
                ref={heatmapCanvasRef}
                className="max-h-72 max-w-full rounded object-contain border border-[#1E293B]/60 shadow-lg"
              />
            </div>
          </div>

          {/* Scientific Caveats & Threat Boundary Disclosure */}
          <div className="p-5 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#CBD5E1]">
              <Info className="w-4 h-4 text-[#06B6D4]" />
              <span>Scientific Caveats & Forensic Limitations Disclosure</span>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[#94A3B8] list-disc list-inside">
              {scanReport.caveats.map((caveat) => (
                <li key={caveat} className="leading-relaxed">
                  {caveat}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
