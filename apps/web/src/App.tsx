import { Code2, Cpu, Shield } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { BrandShowcase } from './components/BrandShowcase.js';
import { CoreStudio } from './components/CoreStudio.js';
import { LabStudio } from './components/LabStudio.js';
import { LensStudio } from './components/LensStudio.js';
import { Navbar, type ProductModule } from './components/Navbar.js';
import { SuiteCards } from './components/SuiteCards.js';
import { TransitStudio } from './components/TransitStudio.js';
import { VaultStudio } from './components/VaultStudio.js';

export const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ProductModule>('core');

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#E2E8F0] flex flex-col font-sans bg-grid-pattern">
      {/* Top Navbar */}
      <Navbar activeModule={activeModule} onSelectModule={setActiveModule} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Module Content */}
        {activeModule === 'core' && <CoreStudio />}

        {activeModule === 'vault' && <VaultStudio />}

        {activeModule === 'lens' && <LensStudio />}

        {activeModule === 'lab' && <LabStudio />}

        {activeModule === 'transit' && <TransitStudio />}

        {activeModule === 'edge' && (
          <div className="p-8 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/20 border border-[#3B82F6]/40 flex items-center justify-center text-[#3B82F6]">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-['Sora'] text-white">
                  OMBRIX Edge — Developer Toolkits & Monorepo Packages
                </h2>
                <p className="text-xs text-[#94A3B8]">
                  Zero-dependency, strictly typed TypeScript packages
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-2 font-mono text-xs">
                <div className="text-[#A855F7] font-semibold flex items-center gap-1.5">
                  <Code2 className="w-4 h-4" />
                  <span>@ombrix/image-validation</span>
                </div>
                <pre className="text-[#94A3B8] overflow-x-auto text-[11px]">
                  {`import { validatePng } from '@ombrix/image-validation';

// Strictly validates magic bytes, IHDR, APNG rejection & bombs
const result = validatePng(pngBuffer, {
  maxWidth: 8192,
  maxPixels: 16_777_216,
  maxExpansionRatio: 1000
});`}
                </pre>
              </div>

              <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-2 font-mono text-xs">
                <div className="text-[#3B82F6] font-semibold flex items-center gap-1.5">
                  <Code2 className="w-4 h-4" />
                  <span>@ombrix/payload-protocol</span>
                </div>
                <pre className="text-[#94A3B8] overflow-x-auto text-[11px]">
                  {`import { serializeEnvelope, parseEnvelope } from '@ombrix/payload-protocol';

// Encapsulates into canonical OMB1 binary envelope
const envelopeBytes = serializeEnvelope({
  version: 1,
  cryptoSuite: 'NONE',
  stegoMethod: 'PNG_LSB_SEQUENTIAL',
  messageId: crypto.getRandomValues(new Uint8Array(16)),
  payload: new Uint8Array([1, 2, 3])
});`}
                </pre>
              </div>

              <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-2 font-mono text-xs">
                <div className="text-[#14B8A6] font-semibold flex items-center gap-1.5">
                  <Code2 className="w-4 h-4" />
                  <span>@ombrix/stego-png-lsb</span>
                </div>
                <pre className="text-[#94A3B8] overflow-x-auto text-[11px]">
                  {`import { pngLsbSequential } from '@ombrix/stego-png-lsb';

// Deterministic RGB LSB embed/extract preserving alpha
const stegoCarrier = await pngLsbSequential.embed(carrier, payload);
const recovered = await pngLsbSequential.extract(stegoCarrier);`}
                </pre>
              </div>

              <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-2 font-mono text-xs">
                <div className="text-[#E2E8F0] font-semibold flex items-center gap-1.5">
                  <Code2 className="w-4 h-4" />
                  <span>@ombrix/stego-worker</span>
                </div>
                <pre className="text-[#94A3B8] overflow-x-auto text-[11px]">
                  {`import { StegoWorkerClient } from '@ombrix/stego-worker';

// Zero-copy transferable buffers with AbortSignal cancellation
const client = new StegoWorkerClient(worker);
const result = await client.embed(carrier, payload, opts, signal);`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {(activeModule === 'link' || activeModule === 'scan' || activeModule === 'flow') && (
          <div className="p-8 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-4">
            <h2 className="text-xl font-bold font-['Sora'] text-white">
              {activeModule === 'link' && 'OMBRIX Link — Ephemeral Steganographic Sharing'}
              {activeModule === 'scan' && 'OMBRIX Scan — Media Steganalysis & Forensics'}
              {activeModule === 'flow' && 'OMBRIX Flow — Batch Automation Pipelines'}
            </h2>
            <p className="text-xs text-[#94A3B8] max-w-2xl leading-relaxed">
              This module is scheduled according to the OMBRIX development roadmap. Phase 1
              (Application Shell, Static PNG Validation, OMB1 Payload Protocol) and Phase 2
              (Steganography Interface, Sequential RGB LSB, Web Worker Sandbox) are fully completed
              and active in OMBRIX Core.
            </p>
            <button
              type="button"
              onClick={() => setActiveModule('core')}
              className="px-4 py-2 rounded-lg bg-[#7C3AED] text-white text-xs font-semibold hover:bg-[#6D28D9] transition-colors"
            >
              Return to OMBRIX Core Studio
            </button>
          </div>
        )}

        {/* Brand System & Design Tokens Showcase */}
        <BrandShowcase />

        {/* Product Suite Cards */}
        <SuiteCards onSelectModule={setActiveModule} />
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1E293B] bg-[#0B0F19] py-6 text-xs text-[#64748B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">OMBRIX™</span>
            <span>—</span>
            <span className="italic">Beyond what the eye can see.</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-[#14B8A6]">
              <Shield className="w-3.5 h-3.5" />
              <span>Zero-Server Architecture</span>
            </span>
            <span className="text-[#334155]">•</span>
            <span>TypeScript Strict Mode</span>
            <span className="text-[#334155]">•</span>
            <span>Local-First Sandbox</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
