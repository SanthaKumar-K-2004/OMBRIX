import { Binary, Layers, Lock, Shield, Sparkles } from 'lucide-react';
import type React from 'react';

export const BrandShowcase: React.FC = () => {
  const colorTokens = [
    { name: 'Obsidian', hex: '#0B0F19', desc: 'Main dark background', bg: 'bg-[#0B0F19]' },
    { name: 'Violet Core', hex: '#7C3AED', desc: 'Primary brand accent', bg: 'bg-[#7C3AED]' },
    { name: 'Aurora Purple', hex: '#A855F7', desc: 'Secondary highlight', bg: 'bg-[#A855F7]' },
    { name: 'Neon Blue', hex: '#3B82F6', desc: 'Technical accent', bg: 'bg-[#3B82F6]' },
    { name: 'Teal Accent', hex: '#14B8A6', desc: 'Success / verified states', bg: 'bg-[#14B8A6]' },
    { name: 'Slate', hex: '#94A3B8', desc: 'Secondary typography', bg: 'bg-[#94A3B8]' },
    { name: 'Mist', hex: '#E2E8F0', desc: 'Light surfaces & labels', bg: 'bg-[#E2E8F0]' },
  ];

  return (
    <section className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-6">
      {/* Brand Story Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#1E293B]">
        <div className="space-y-1 max-w-2xl">
          <div className="text-xs font-mono uppercase tracking-wider text-[#A855F7]">
            Brand Foundation & Identity
          </div>
          <h3 className="text-lg font-bold font-['Sora'] text-white">
            Beyond what the eye can see.
          </h3>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            OMBRIX is a next-generation steganography and secure communication platform that hides,
            protects, and intelligently manages information within digital media — combining
            cryptography, steganography, and research-grade media forensics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs">
            <Shield className="w-4 h-4 text-[#14B8A6]" />
            <span className="text-[#E2E8F0] font-medium">Privacy by Design</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs">
            <Lock className="w-4 h-4 text-[#7C3AED]" />
            <span className="text-[#E2E8F0] font-medium">Zero Invented Crypto</span>
          </div>
        </div>
      </div>

      {/* Color Swatches Grid from Design.jpeg */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
          Design System Color Tokens (Design.jpeg)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {colorTokens.map((token) => (
            <div
              key={token.name}
              className="p-2.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-2"
            >
              <div
                className={`w-full h-8 rounded-lg ${token.bg} border border-white/10 shadow-inner`}
              />
              <div>
                <div className="text-xs font-semibold text-white">{token.name}</div>
                <div className="text-[10px] font-mono text-[#94A3B8]">{token.hex}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Core Principles Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#A855F7]">
            <Layers className="w-4 h-4" />
            <span>Layers & Depth</span>
          </div>
          <p className="text-[11px] text-[#94A3B8]">
            Information has layers. Concealing encrypted data beneath visible pixel rasters without
            visual corruption.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#3B82F6]">
            <Sparkles className="w-4 h-4" />
            <span>Concealment & Flow</span>
          </div>
          <p className="text-[11px] text-[#94A3B8]">
            Deterministic traversal order across RGB channels, strictly isolating alpha channels to
            avoid browser premultiplication.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#14B8A6]">
            <Binary className="w-4 h-4" />
            <span>Security & Trust</span>
          </div>
          <p className="text-[11px] text-[#94A3B8]">
            Bounded payload protocol, header CRC32 verification, static PNG decompression bomb
            defense, and Web Worker isolation.
          </p>
        </div>
      </div>
    </section>
  );
};
