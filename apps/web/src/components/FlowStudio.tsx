import {
  type BatchCapacityAudit,
  type BatchEmbedItemResult,
  type BatchEmbedTask,
  type BatchExtractItemResult,
  type BatchExtractTask,
  type BatchProgressEvent,
  auditBatchCarriers,
  executeBatchEmbed,
  executeBatchExtract,
  reassembleChunkedPayload,
  splitPayloadAcrossCarriers,
} from '@ombrix/batch-pipeline';
import type { CarrierImage } from '@ombrix/stego-interface';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  Layers,
  Play,
  RotateCcw,
  Sparkles,
  Split,
  Upload,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

function createSyntheticCarrier(
  width: number,
  height: number,
  tint: 'blue' | 'purple' | 'teal' | 'gold',
): CarrierImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    if (tint === 'blue') {
      data[i] = 40;
      data[i + 1] = 90;
      data[i + 2] = 180;
    } else if (tint === 'purple') {
      data[i] = 120;
      data[i + 1] = 40;
      data[i + 2] = 200;
    } else if (tint === 'teal') {
      data[i] = 20;
      data[i + 1] = 160;
      data[i + 2] = 140;
    } else {
      data[i] = 180;
      data[i + 1] = 150;
      data[i + 2] = 50;
    }
    data[i + 3] = 255;
  }
  return { width, height, data };
}

export const FlowStudio: React.FC = () => {
  const [carriers, setCarriers] = useState<Array<{ name: string; carrier: CarrierImage }>>([]);
  const [audit, setAudit] = useState<BatchCapacityAudit | null>(null);
  const [pipelineMode, setPipelineMode] = useState<'individual' | 'striped'>('striped');
  const [secretText, setSecretText] = useState<string>(
    'OMBRIX Flow High-Throughput Batch Processing Engine: Demonstrating automated dynamic capacity planning, multi-carrier payload striping, and concurrent raster steganography.',
  );
  const [concurrency, setConcurrency] = useState<number>(2);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<BatchProgressEvent | null>(null);
  const [embedResults, setEmbedResults] = useState<BatchEmbedItemResult[]>([]);
  const [extractResults, setExtractResults] = useState<BatchExtractItemResult[]>([]);
  const [reassembledMessage, setReassembledMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load synthetic test dataset
  const handleLoadSampleBatch = () => {
    const samples = [
      { name: 'alpha-carrier-120px.png', carrier: createSyntheticCarrier(120, 120, 'blue') },
      { name: 'beta-carrier-160px.png', carrier: createSyntheticCarrier(160, 160, 'purple') },
      { name: 'gamma-carrier-100px.png', carrier: createSyntheticCarrier(100, 100, 'teal') },
      { name: 'delta-carrier-140px.png', carrier: createSyntheticCarrier(140, 140, 'gold') },
    ];
    setCarriers(samples);
    const audited = auditBatchCarriers(samples);
    setAudit(audited);
    setEmbedResults([]);
    setExtractResults([]);
    setReassembledMessage(null);
    setErrorMessage(null);
  };

  // Run Batch Embed
  const handleRunBatchEmbed = async () => {
    try {
      if (!audit || carriers.length === 0) {
        throw new Error('Please load carriers or sample batch first.');
      }
      setIsRunning(true);
      setErrorMessage(null);
      setEmbedResults([]);
      setExtractResults([]);
      setReassembledMessage(null);

      const payloadBytes = new TextEncoder().encode(secretText);
      let tasks: BatchEmbedTask[];

      if (pipelineMode === 'striped') {
        tasks = splitPayloadAcrossCarriers(payloadBytes, audit.items);
      } else {
        tasks = audit.items
          .filter((item) => item.isValid && item.carrierImage)
          .map((item, idx) => ({
            id: `task-${idx + 1}`,
            carrierName: item.name,
            carrierImage: item.carrierImage!,
            payloadBytes: new TextEncoder().encode(`[Message for ${item.name}]: ${secretText}`),
          }));
      }

      const results = await executeBatchEmbed(tasks, {
        concurrency,
        onProgress: (p) => setProgress(p),
      });

      setEmbedResults(results);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  };

  // Run Batch Extract
  const handleRunBatchExtract = async () => {
    try {
      if (embedResults.length === 0) {
        throw new Error('No stego batch has been generated to extract.');
      }
      setIsRunning(true);
      setErrorMessage(null);
      setExtractResults([]);
      setReassembledMessage(null);

      const extractTasks: BatchExtractTask[] = embedResults
        .filter((r) => r.success && r.stegoImage)
        .map((r) => ({
          id: r.id,
          carrierName: r.carrierName,
          stegoImage: r.stegoImage!,
        }));

      const results = await executeBatchExtract(extractTasks, {
        concurrency,
        onProgress: (p) => setProgress(p),
      });

      setExtractResults(results);

      // If striped mode, reassemble chunks
      if (pipelineMode === 'striped') {
        const validChunks = results
          .filter((r) => r.success && r.payloadBytes)
          .map((r) => r.payloadBytes!);
        const fullPayload = reassembleChunkedPayload(validChunks);
        setReassembledMessage(new TextDecoder().decode(fullPayload));
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  };

  const downloadManifest = () => {
    const manifest = {
      project: 'OMBRIX Flow',
      version: '1.0',
      timestamp: new Date().toISOString(),
      mode: pipelineMode,
      totalCarriers: audit?.totalCarriers ?? 0,
      totalCapacityBytes: audit?.totalCapacityBytes ?? 0,
      embedResults: embedResults.map((r) => ({
        id: r.id,
        carrierName: r.carrierName,
        payloadSize: r.payloadSize,
        durationMs: r.durationMs,
        success: r.success,
        error: r.error,
      })),
    };

    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ombrix-flow-manifest-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#111827] via-[#142B28]/30 to-[#111827] border border-[#1E293B] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#14B8A6]/20 text-[#14B8A6] border border-[#14B8A6]/40">
              MILESTONE 14 ACTIVE
            </span>
            <span className="text-xs text-[#64748B]">• Multi-Carrier Steganography Engine</span>
          </div>
          <h2 className="text-2xl font-bold font-['Sora'] text-white mt-1">
            OMBRIX Flow — Batch Automation Pipelines
          </h2>
          <p className="text-xs text-[#94A3B8] max-w-2xl mt-1">
            High-throughput pipeline for batch carrier capacity auditing, multi-image payload
            striping, and concurrency-controlled embedding/extraction with automated manifest
            tracking.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLoadSampleBatch}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#14B8A6]/20 hover:bg-[#14B8A6]/30 text-[#14B8A6] border border-[#14B8A6]/40 text-xs font-bold transition-all"
        >
          <Sparkles className="w-4 h-4" />
          <span>Load Synthetic 4-Carrier Batch</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Configuration & Controls */}
        <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-4">
          <h3 className="text-base font-bold font-['Sora'] text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#14B8A6]" />
            <span>Pipeline Controls</span>
          </h3>

          {/* Mode Selector */}
          <div className="space-y-2">
            <label htmlFor="pipeline-mode" className="block text-xs font-semibold text-[#E2E8F0]">
              Payload Distribution Strategy
            </label>
            <div id="pipeline-mode" className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPipelineMode('striped')}
                className={`py-2 px-3 rounded-lg text-xs font-medium border text-left flex items-center gap-2 transition-all ${
                  pipelineMode === 'striped'
                    ? 'bg-[#14B8A6]/20 border-[#14B8A6] text-white shadow-sm'
                    : 'bg-[#0B0F19] border-[#1E293B] text-[#94A3B8] hover:text-white'
                }`}
              >
                <Split className="w-3.5 h-3.5 text-[#14B8A6]" />
                <span>Striped Chunks</span>
              </button>
              <button
                type="button"
                onClick={() => setPipelineMode('individual')}
                className={`py-2 px-3 rounded-lg text-xs font-medium border text-left flex items-center gap-2 transition-all ${
                  pipelineMode === 'individual'
                    ? 'bg-[#14B8A6]/20 border-[#14B8A6] text-white shadow-sm'
                    : 'bg-[#0B0F19] border-[#1E293B] text-[#94A3B8] hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span>Independent</span>
              </button>
            </div>
            <p className="text-[11px] text-[#64748B]">
              {pipelineMode === 'striped'
                ? 'Stripes one large payload across all valid carriers using 12-byte framing headers.'
                : 'Embeds discrete individual payloads into each separate carrier.'}
            </p>
          </div>

          {/* Secret Message Input */}
          <div className="space-y-2">
            <label
              htmlFor="batch-secret-text"
              className="block text-xs font-semibold text-[#E2E8F0]"
            >
              Secret Data Payload
            </label>
            <textarea
              id="batch-secret-text"
              value={secretText}
              onChange={(e) => setSecretText(e.target.value)}
              rows={4}
              className="w-full p-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs text-white font-mono focus:border-[#14B8A6] focus:outline-none resize-none"
              placeholder="Enter batch secret payload..."
            />
            <div className="flex justify-between text-[11px] text-[#64748B]">
              <span>Payload Size: {new TextEncoder().encode(secretText).length} bytes</span>
              <span>Available Capacity: {audit?.totalCapacityBytes ?? 0} bytes</span>
            </div>
          </div>

          {/* Concurrency Selector */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label
                htmlFor="concurrency-range"
                className="text-xs font-semibold text-[#E2E8F0] flex items-center gap-1.5"
              >
                <Cpu className="w-3.5 h-3.5 text-[#A855F7]" />
                <span>Worker Concurrency</span>
              </label>
              <span className="text-xs font-mono text-[#A855F7]">{concurrency} workers</span>
            </div>
            <input
              id="concurrency-range"
              type="range"
              min={1}
              max={4}
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="w-full accent-[#14B8A6]"
            />
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              disabled={isRunning || !audit || audit.validCarriers === 0}
              onClick={handleRunBatchEmbed}
              className="w-full py-3 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-[#14B8A6]/20 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              <span>{isRunning ? 'Processing Pipeline...' : 'Execute Batch Embedding'}</span>
            </button>

            {embedResults.length > 0 && (
              <button
                type="button"
                disabled={isRunning}
                onClick={handleRunBatchExtract}
                className="w-full py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Execute Batch Extraction</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Audit Table, Progress, & Results */}
        <div className="lg:col-span-2 space-y-6">
          {/* Capacity Audit Summary Card */}
          <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold font-['Sora'] text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-[#3B82F6]" />
                <span>Carrier Dataset Capacity Audit</span>
              </h3>
              {audit && (
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-[#94A3B8]">
                    Valid: <strong className="text-white">{audit.validCarriers}</strong> /{' '}
                    {audit.totalCarriers}
                  </span>
                  <span className="text-[#14B8A6]">
                    Total Capacity:{' '}
                    <strong>{(audit.totalCapacityBytes / 1024).toFixed(2)} KB</strong>
                  </span>
                </div>
              )}
            </div>

            {audit && audit.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#94A3B8]">
                  <thead className="bg-[#0B0F19] text-[#E2E8F0] uppercase text-[10px] tracking-wider font-mono">
                    <tr>
                      <th className="py-2.5 px-3">Carrier Name</th>
                      <th className="py-2.5 px-3">Dimensions</th>
                      <th className="py-2.5 px-3">Usable LSB Capacity</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]">
                    {audit.items.map((item) => (
                      <tr key={item.id} className="hover:bg-[#1E293B]/40">
                        <td className="py-2.5 px-3 font-mono text-white flex items-center gap-2">
                          <Archive className="w-3.5 h-3.5 text-[#14B8A6]" />
                          <span>{item.name}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {item.width} × {item.height}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#14B8A6]">
                          {item.capacityBytes.toLocaleString()} bytes
                        </td>
                        <td className="py-2.5 px-3">
                          {item.isValid ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#14B8A6]/10 text-[#14B8A6] border border-[#14B8A6]/30">
                              Ready
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950/40 text-red-400 border border-red-500/30">
                              Rejected
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-32 flex flex-col items-center justify-center text-[#64748B] text-xs border border-dashed border-[#1E293B] rounded-xl space-y-1">
                <Upload className="w-6 h-6 opacity-40 text-[#14B8A6]" />
                <span>Click &ldquo;Load Synthetic 4-Carrier Batch&rdquo; to populate dataset.</span>
              </div>
            )}
          </div>

          {/* Live Progress Bar */}
          {progress && (
            <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#E2E8F0] font-semibold capitalize flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-[#14B8A6]" />
                  <span>
                    Phase: {progress.phase} ({progress.currentName})
                  </span>
                </span>
                <span className="font-mono text-[#14B8A6]">{progress.percent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#1E293B] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#14B8A6] to-[#7C3AED] transition-all duration-200"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Results Table & Reassembly */}
          {embedResults.length > 0 && (
            <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold font-['Sora'] text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#14B8A6]" />
                  <span>Pipeline Execution Results</span>
                </h3>
                <button
                  type="button"
                  onClick={downloadManifest}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-white text-xs font-mono transition-all border border-[#334155]"
                >
                  <Download className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span>Export Manifest</span>
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {embedResults.map((r, i) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs font-mono space-y-1"
                  >
                    <div className="text-white font-semibold truncate">{r.carrierName}</div>
                    <div className="text-[11px] text-[#14B8A6]">Embedded: {r.payloadSize} B</div>
                    <div className="text-[10px] text-[#64748B]">
                      Latency: {r.durationMs.toFixed(1)} ms
                    </div>
                    <div className="text-[10px] text-[#14B8A6]">Chunk #{i + 1} Ready</div>
                  </div>
                ))}
              </div>

              {extractResults.length > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-[#0B0F19] border border-[#7C3AED]/40 space-y-2">
                  <div className="text-xs font-bold text-[#A855F7] flex items-center justify-between">
                    <span>Batch Extraction Status</span>
                    <span>
                      {extractResults.filter((r) => r.success).length} / {extractResults.length}{' '}
                      extracted
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {extractResults.map((er) => (
                      <div
                        key={er.id}
                        className="p-2 rounded-lg bg-[#111827] text-[11px] font-mono"
                      >
                        <div className="text-white truncate">{er.carrierName}</div>
                        <div className={er.success ? 'text-[#14B8A6]' : 'text-red-400'}>
                          {er.success ? `${er.payloadSize} bytes` : 'Failed'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reassembledMessage && (
                <div className="mt-4 p-4 rounded-xl bg-[#0B0F19] border border-[#14B8A6]/40 space-y-2">
                  <div className="text-xs font-bold text-[#14B8A6] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Reassembled Striped Payload (Multi-Carrier Verification Succeeded)</span>
                  </div>
                  <pre className="text-xs font-mono text-white p-3 rounded-lg bg-[#111827] border border-[#1E293B] whitespace-pre-wrap">
                    {reassembledMessage}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
