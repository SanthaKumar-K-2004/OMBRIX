import {
  type OpticalAssemblyResult,
  type OpticalFrame,
  OpticalFrameAssembler,
  chunkIntoOpticalFrames,
  serializeOpticalFrame,
} from '@ombrix/optical-airgap';
import {
  Camera,
  CheckCircle2,
  Copy,
  Download,
  FastForward,
  FileText,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  QrCode,
  Radio,
  Rewind,
  Send,
  ShieldCheck,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type BusCarrierPayload, studioDataBus } from '../services/studioDataBus.js';

export const AirGapStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'transmit' | 'receive'>('transmit');

  // Transmission State
  const [inputText, setInputText] = useState<string>(
    'OMBRIX AIR-GAP DIRECTIVE: Operational node verified. Cryptographic coordinates: 45.1092, -122.6789. Evacuation order alpha.',
  );
  const [chunkSizeBytes, setChunkSizeBytes] = useState<number>(64);
  const [generatedFrames, setGeneratedFrames] = useState<OpticalFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(4);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copiedFrame, setCopiedFrame] = useState<boolean>(false);

  // Receiver / Scanner State
  const [rawFrameInput, setRawFrameInput] = useState<string>('');
  const [assembler] = useState<OpticalFrameAssembler>(() => new OpticalFrameAssembler());
  const [assemblyState, setAssemblyState] = useState<OpticalAssemblyResult | null>(null);
  const [reassembledPayload, setReassembledPayload] = useState<Uint8Array | null>(null);
  const [scannerLog, setScannerLog] = useState<Array<{ id: string; text: string }>>([]);
  const [simulatedDropRate, setSimulatedDropRate] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Subscribe to studio data bus for incoming carriers to transmit across air-gap
  useEffect(() => {
    const unsubscribe = studioDataBus.subscribeCarrier((carrier: BusCarrierPayload) => {
      if (carrier.bytes && carrier.bytes.length > 0) {
        try {
          const frames = chunkIntoOpticalFrames(carrier.bytes, 512);
          setGeneratedFrames(frames);
          setCurrentFrameIndex(0);
          setChunkSizeBytes(512);
        } catch (_e) {
          // Fallback to text
        }
      }
    });
    return unsubscribe;
  }, []);

  // Generate Frames on Input or Chunk Size Change
  const handleGenerateFrames = useCallback(() => {
    try {
      const data = new TextEncoder().encode(inputText);
      const frames = chunkIntoOpticalFrames(data, chunkSizeBytes);
      setGeneratedFrames(frames);
      setCurrentFrameIndex(0);
      setIsPlaying(false);
    } catch (err) {
      console.error('Failed to chunk payload:', err);
    }
  }, [inputText, chunkSizeBytes]);

  useEffect(() => {
    handleGenerateFrames();
  }, [handleGenerateFrames]);

  // Optical Playback Loop
  useEffect(() => {
    if (!isPlaying || generatedFrames.length === 0) return;

    const intervalMs = Math.max(30, Math.round(1000 / fps));
    const timer = setInterval(() => {
      setCurrentFrameIndex((prev) => {
        if (prev >= generatedFrames.length - 1) {
          if (isLooping) return 0;
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, fps, generatedFrames.length, isLooping]);

  // Render Visual Matrix on Canvas
  useEffect(() => {
    if (!canvasRef.current || generatedFrames.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentFrame = generatedFrames[currentFrameIndex];
    if (!currentFrame) return;

    // Draw visual optical matrix grid
    const size = 320;
    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(0, 0, size, size);

    // Grid Dimensions
    const gridSize = 16;
    const cellSize = size / gridSize;

    // Decode chunk bytes to render pixel matrix
    const binary = atob(currentFrame.chunkBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Border alignment marks (optical alignment fiducials)
    ctx.fillStyle = '#A855F7';
    ctx.fillRect(0, 0, cellSize * 2, cellSize * 2);
    ctx.fillRect(size - cellSize * 2, 0, cellSize * 2, cellSize * 2);
    ctx.fillRect(0, size - cellSize * 2, cellSize * 2, cellSize * 2);

    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(cellSize * 0.5, cellSize * 0.5, cellSize, cellSize);
    ctx.fillRect(size - cellSize * 1.5, cellSize * 0.5, cellSize, cellSize);
    ctx.fillRect(cellSize * 0.5, size - cellSize * 1.5, cellSize, cellSize);

    // Data Cells
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
          // Color code by channel activity
          ctx.fillStyle = byteIdx % 2 === 0 ? '#3B82F6' : '#14B8A6';
          ctx.fillRect(c * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2);
        } else {
          ctx.fillStyle = '#111827';
          ctx.fillRect(c * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2);
        }

        if (c % 8 === 7) byteIdx++;
      }
    }
  }, [currentFrameIndex, generatedFrames]);

  // Feed Frame to Assembler
  const handleFeedFrame = (frameStringOrObj: string | OpticalFrame) => {
    try {
      const res = assembler.addFrame(frameStringOrObj);
      setAssemblyState(res);
      const logId = `${Date.now()}-${Math.random()}`;
      if (res.complete && res.data) {
        setReassembledPayload(res.data);
        setScannerLog((prev) => [
          {
            id: logId,
            text: `✔ All ${res.totalFrames} frames assembled! CRC32 verified successfully.`,
          },
          ...prev.slice(0, 8),
        ]);
      } else {
        setScannerLog((prev) => [
          {
            id: logId,
            text: `Received frame (${res.receivedFrames}/${res.totalFrames}). Missing: [${res.missingFrames.join(', ')}]`,
          },
          ...prev.slice(0, 8),
        ]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const logId = `${Date.now()}-${Math.random()}`;
      setScannerLog((prev) => [
        { id: logId, text: `✖ Assembly error: ${msg}` },
        ...prev.slice(0, 8),
      ]);
    }
  };

  // Simulate Optical Camera Burst Scan with Out-of-Order Frames & Dropped Packets
  const handleSimulateBurstScan = () => {
    if (generatedFrames.length === 0) return;

    assembler.reset();
    setReassembledPayload(null);
    setScannerLog([
      {
        id: `${Date.now()}-init`,
        text: 'Starting simulated camera capture burst...',
      },
    ]);

    // Clone and shuffle frames
    const shuffled = [...generatedFrames].sort(() => Math.random() - 0.5);

    // Insert simulated duplicate frames (camera caught frame twice)
    if (shuffled.length > 2) {
      shuffled.splice(1, 0, shuffled[0]!);
      shuffled.splice(4, 0, shuffled[2]!);
    }

    let i = 0;
    const burstTimer = setInterval(() => {
      if (i >= shuffled.length) {
        clearInterval(burstTimer);
        return;
      }

      const frame = shuffled[i]!;
      // Simulate random frame drop if drop rate > 0
      if (Math.random() > simulatedDropRate / 100) {
        handleFeedFrame(frame);
      } else {
        const logId = `${Date.now()}-${Math.random()}`;
        setScannerLog((prev) => [
          {
            id: logId,
            text: `⚠ Frame ${frame.frameIndex} dropped due to simulated glare/blur.`,
          },
          ...prev.slice(0, 8),
        ]);
      }
      i++;
    }, 150);
  };

  // Copy current frame serialized string
  const handleCopyCurrentFrame = () => {
    const frame = generatedFrames[currentFrameIndex];
    if (!frame) return;
    const str = serializeOpticalFrame(frame);
    navigator.clipboard.writeText(str);
    setCopiedFrame(true);
    setTimeout(() => setCopiedFrame(false), 2000);
  };

  const activeFrame = generatedFrames[currentFrameIndex];

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#111827] border border-[#1E293B]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-[#A855F7]">
              Physical Air-Gap Layer
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#14B8A6]/10 text-[#14B8A6] border border-[#14B8A6]/30">
              Optical Protocol: Active
            </span>
          </div>
          <h2 className="text-xl font-bold font-['Sora'] text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#A855F7]" />
            <span>OMBRIX Optical Air-Gap Studio</span>
          </h2>
          <p className="text-xs text-[#94A3B8]">
            Physical transmission of cryptographic payloads across air-gapped boundaries using
            visual optical frame sequences and out-of-order CRC32 reassembly.
          </p>
        </div>

        {/* Studio Subtabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0B0F19] border border-[#1E293B] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('transmit')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'transmit'
                ? 'bg-[#7C3AED] text-white shadow-sm'
                : 'text-[#94A3B8] hover:text-[#E2E8F0]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Transmitter (Screen)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('receive')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'receive'
                ? 'bg-[#7C3AED] text-white shadow-sm'
                : 'text-[#94A3B8] hover:text-[#E2E8F0]'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Receiver (Scanner)</span>
          </button>
        </div>
      </div>

      {activeTab === 'transmit' ? (
        /* Transmitter Mode */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Configuration Panel */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#3B82F6]" />
                <span>Payload to Transmit</span>
              </h3>

              <div>
                <label htmlFor="payload-input" className="block text-xs text-[#94A3B8] mb-1.5">
                  Payload Text or Encrypted Message
                </label>
                <textarea
                  id="payload-input"
                  rows={4}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-[#7C3AED] resize-none"
                  placeholder="Enter message or ciphertext to chunk..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="chunk-size-select"
                    className="block text-xs text-[#94A3B8] mb-1.5"
                  >
                    Chunk Size (Bytes)
                  </label>
                  <select
                    id="chunk-size-select"
                    value={chunkSizeBytes}
                    onChange={(e) => setChunkSizeBytes(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-[#7C3AED]"
                  >
                    <option value={32}>32 B (High Density)</option>
                    <option value={64}>64 B (Optimal Mobile)</option>
                    <option value={128}>128 B (High Speed)</option>
                    <option value={256}>256 B (Desktop Camera)</option>
                    <option value={512}>512 B (Standard)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="fps-slider" className="block text-xs text-[#94A3B8] mb-1.5">
                    Speed: {fps} FPS
                  </label>
                  <input
                    id="fps-slider"
                    type="range"
                    min={1}
                    max={20}
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    className="w-full accent-[#7C3AED] mt-2"
                  />
                </div>
              </div>

              {/* Frame Generation Stats */}
              <div className="p-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-2 text-xs">
                <div className="flex justify-between text-[#94A3B8]">
                  <span>Total Payload Size:</span>
                  <span className="font-mono text-white">
                    {new TextEncoder().encode(inputText).length} bytes
                  </span>
                </div>
                <div className="flex justify-between text-[#94A3B8]">
                  <span>Total Optical Frames:</span>
                  <span className="font-mono text-[#A855F7] font-semibold">
                    {generatedFrames.length} frames
                  </span>
                </div>
                <div className="flex justify-between text-[#94A3B8]">
                  <span>Sequence ID:</span>
                  <span className="font-mono text-[10px] text-[#64748B] truncate max-w-[160px]">
                    {activeFrame?.sequenceId ?? 'None'}
                  </span>
                </div>
              </div>
            </div>

            {/* Cross-Studio Handoff */}
            <div className="p-4 rounded-xl bg-[#111827] border border-[#1E293B] space-y-2">
              <div className="text-xs font-semibold text-white">Cross-Studio Handoff</div>
              <p className="text-[11px] text-[#94A3B8]">
                Transmit directly into the Optical Scanner simulation with out-of-order frame
                capture.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('receive');
                  handleSimulateBurstScan();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#7C3AED]/20 text-[#A855F7] border border-[#7C3AED]/40 hover:bg-[#7C3AED]/30 text-xs font-medium transition-colors"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Simulate Optical Scanner Capture</span>
              </button>
            </div>
          </div>

          {/* Right Visual Optical Transmitter Screen */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-4 flex flex-col items-center">
              {/* Playback Controls & Frame Indicator */}
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-white px-2 py-0.5 rounded bg-[#7C3AED]/30 border border-[#7C3AED]/40">
                    FRAME {generatedFrames.length > 0 ? currentFrameIndex + 1 : 0} /{' '}
                    {generatedFrames.length}
                  </span>
                  <span className="text-[11px] font-mono text-[#64748B]">
                    CRC:{' '}
                    {activeFrame ? `0x${activeFrame.chunkCrc32.toString(16).toUpperCase()}` : '—'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="p-1.5 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-[#94A3B8] hover:text-white"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Optical Transmitter'}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="w-4 h-4" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Optical Canvas Display */}
              <div className="relative p-4 rounded-xl bg-black border border-[#334155] shadow-2xl flex items-center justify-center">
                <canvas ref={canvasRef} className="rounded-lg max-w-full h-auto aspect-square" />
              </div>

              {/* Playback Bar Controls */}
              <div className="w-full space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentFrameIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentFrameIndex === 0}
                    className="p-2 rounded-lg bg-[#0B0F19] hover:bg-[#1E293B] text-[#E2E8F0] border border-[#1E293B] disabled:opacity-40"
                    title="Previous Frame"
                  >
                    <Rewind className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold shadow-lg shadow-[#7C3AED]/30 transition-all"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{isPlaying ? 'Pause Sequence' : 'Play Optical Sequence'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentFrameIndex((prev) => Math.min(generatedFrames.length - 1, prev + 1))
                    }
                    disabled={currentFrameIndex === generatedFrames.length - 1}
                    className="p-2 rounded-lg bg-[#0B0F19] hover:bg-[#1E293B] text-[#E2E8F0] border border-[#1E293B] disabled:opacity-40"
                    title="Next Frame"
                  >
                    <FastForward className="w-4 h-4" />
                  </button>
                </div>

                {/* Scrubber */}
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, generatedFrames.length - 1)}
                  value={currentFrameIndex}
                  onChange={(e) => {
                    setCurrentFrameIndex(Number(e.target.value));
                    setIsPlaying(false);
                  }}
                  className="w-full accent-[#7C3AED]"
                />

                <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isLooping}
                      onChange={(e) => setIsLooping(e.target.checked)}
                      className="rounded accent-[#7C3AED]"
                    />
                    <span>Continuous Loop</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleCopyCurrentFrame}
                    className="flex items-center gap-1.5 text-[#3B82F6] hover:underline"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedFrame ? 'Copied Frame String' : 'Copy Frame Data'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Receiver (Scanner) Mode */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Scanner Simulation & Ingestion */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-5 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#14B8A6]" />
                  <span>Optical Frame Feed</span>
                </span>
                <span className="text-xs font-mono text-[#14B8A6]">Ready to Scan</span>
              </h3>

              <div>
                <label
                  htmlFor="frame-input-textarea"
                  className="block text-xs text-[#94A3B8] mb-1.5"
                >
                  Paste Optical Frame String (e.g. OMB_OPT_V1|seq|...)
                </label>
                <div className="flex gap-2">
                  <textarea
                    id="frame-input-textarea"
                    rows={2}
                    value={rawFrameInput}
                    onChange={(e) => setRawFrameInput(e.target.value)}
                    className="flex-1 p-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs font-mono text-[#E2E8F0] focus:outline-none focus:border-[#14B8A6] resize-none"
                    placeholder="OMB_OPT_V1|seq_128_e4a1|0|4|512|...|crc"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (rawFrameInput.trim()) {
                        handleFeedFrame(rawFrameInput.trim());
                        setRawFrameInput('');
                      }
                    }}
                    className="px-4 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-black font-semibold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Absorb</span>
                  </button>
                </div>
              </div>

              {/* Automated Optical Camera Burst Simulator */}
              <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#A855F7]" />
                    <span>Real-Time Optical Camera Simulation</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSimulateBurstScan}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-medium transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    <span>Trigger Burst Scan</span>
                  </button>
                </div>
                <p className="text-[11px] text-[#94A3B8]">
                  Simulates a camera capturing frames out-of-order, with duplicate detections and
                  potential drops.
                </p>

                <div>
                  <div className="flex justify-between text-[11px] text-[#94A3B8] mb-1">
                    <span>Simulated Glare / Drop Rate:</span>
                    <span className="font-mono text-white">{simulatedDropRate}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={simulatedDropRate}
                    onChange={(e) => setSimulatedDropRate(Number(e.target.value))}
                    className="w-full accent-[#A855F7]"
                  />
                </div>
              </div>

              {/* Scanner Activity Log */}
              <div className="p-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-1.5">
                <div className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Assembler Activity Stream
                </div>
                <div className="h-28 overflow-y-auto space-y-1 font-mono text-[11px] text-[#E2E8F0]">
                  {scannerLog.length === 0 ? (
                    <div className="text-[#64748B] italic">No frames captured yet.</div>
                  ) : (
                    scannerLog.map((item) => (
                      <div key={item.id} className="truncate">
                        {item.text}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Reassembly State & Verification */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-5 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#A855F7]" />
                  <span>Optical Reassembly Status</span>
                </span>
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded-full border ${
                    assemblyState?.complete
                      ? 'bg-[#14B8A6]/10 text-[#14B8A6] border-[#14B8A6]/30'
                      : 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/30'
                  }`}
                >
                  {assemblyState?.complete
                    ? '100% REASSEMBLED'
                    : `${assemblyState?.progressPercent ?? 0}% IN PROGRESS`}
                </span>
              </h3>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-[#94A3B8]">
                  <span>Frames Collected:</span>
                  <span className="font-mono text-white">
                    {assemblyState?.receivedFrames ?? 0} / {assemblyState?.totalFrames ?? 0}
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-[#0B0F19] overflow-hidden border border-[#1E293B]">
                  <div
                    className="h-full bg-gradient-to-r from-[#7C3AED] via-[#3B82F6] to-[#14B8A6] transition-all duration-300"
                    style={{ width: `${assemblyState?.progressPercent ?? 0}%` }}
                  />
                </div>
              </div>

              {/* Reassembled Payload Result */}
              {reassembledPayload && (
                <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#14B8A6]/30 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#14B8A6]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Payload Complete & CRC32 Verified</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#111827] border border-[#1E293B] font-mono text-xs text-[#E2E8F0] break-words max-h-32 overflow-y-auto">
                    {new TextDecoder().decode(reassembledPayload)}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([new Uint8Array(reassembledPayload)], {
                          type: 'application/octet-stream',
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `ombrix-airgap-${Date.now()}.bin`;
                        a.click();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14B8A6] text-black text-xs font-semibold hover:bg-[#0D9488] transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Payload</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        studioDataBus.sendCiphertextToRelay({
                          ciphertext: reassembledPayload,
                          source: 'airgap-reassembled',
                        });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-xs font-medium text-white transition-colors"
                    >
                      <Send className="w-3.5 h-3.5 text-[#A855F7]" />
                      <span>Send to Opaque Relay</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
