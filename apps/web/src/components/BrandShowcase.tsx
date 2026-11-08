import {
  Binary,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
  Lock,
  Radar,
  Shield,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { OmbrixLogo } from './OmbrixLogo.js';

export const BrandShowcase: React.FC = () => {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const colorTokens = [
    { name: 'Obsidian', hex: '#0B0F19', desc: 'Base surface & canvas', bg: 'bg-[#0B0F19]' },
    { name: 'Violet Core', hex: '#7C3AED', desc: 'Primary brand accent', bg: 'bg-[#7C3AED]' },
    { name: 'Aurora Purple', hex: '#A855F7', desc: 'Secondary glow', bg: 'bg-[#A855F7]' },
    { name: 'Neon Blue', hex: '#3B82F6', desc: 'Technical & stream', bg: 'bg-[#3B82F6]' },
    { name: 'Teal Accent', hex: '#14B8A6', desc: 'Verified & success', bg: 'bg-[#14B8A6]' },
    { name: 'Slate', hex: '#94A3B8', desc: 'Muted secondary text', bg: 'bg-[#94A3B8]' },
    { name: 'Mist', hex: '#E2E8F0', desc: 'High-contrast typography', bg: 'bg-[#E2E8F0]' },
  ];

  const systemIcons = [
    { name: 'Hide', desc: 'Conceal payload into carrier', icon: EyeOff },
    { name: 'Reveal', desc: 'Extract & reconstruct payload', icon: Eye },
    { name: 'Encrypt', desc: 'Cryptographic sealed box', icon: Lock },
    { name: 'Media', desc: 'Raster carrier layers', icon: ImageIcon },
    { name: 'Verify', desc: 'CRC32 & signature check', icon: ShieldCheck },
    { name: 'AI/Scan', desc: 'Forensic steganography radar', icon: Radar },
  ];

  const copyToClipboard = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  return (
    <section className="p-6 sm:p-8 rounded-3xl bg-[#111827] border border-[#1E293B] space-y-8">
      {/* Brand Story Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#1E293B]">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-[#A855F7]">
              Brand Identity System
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#7C3AED]/10 text-[#A855F7] border border-[#7C3AED]/30">
              Official Reference Guide
            </span>
          </div>
          <h3 className="text-2xl font-bold font-['Sora'] text-white">
            Beyond what the eye can see.
          </h3>
          <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
            OMBRIX is a next-generation steganography and secure communication platform that hides,
            protects, and intelligently manages information within digital media — combining
            cryptography, steganography, and AI-powered forensics for privacy beyond visibility.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs">
            <Shield className="w-4 h-4 text-[#14B8A6]" />
            <span className="text-[#E2E8F0] font-medium">Privacy by Design</span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs">
            <Lock className="w-4 h-4 text-[#7C3AED]" />
            <span className="text-[#E2E8F0] font-medium">Zero Invented Crypto</span>
          </div>
        </div>
      </div>

      {/* Logo Concept Formulation (Visual Equation) */}
      <div className="p-6 rounded-2xl bg-[#0B0F19] border border-[#1E293B] space-y-4">
        <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
          Logo Concept Equation
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-[#111827] border border-[#1E293B] flex items-center justify-center text-white font-['Sora'] text-lg font-bold">
              O
            </div>
            <div className="text-[11px] text-[#94A3B8]">O (Ombrix)</div>
          </div>

          <div className="text-lg text-[#64748B] font-bold">+</div>

          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-[#111827] border border-[#1E293B] flex items-center justify-center text-[#3B82F6]">
              <Layers className="w-6 h-6" />
            </div>
            <div className="text-[11px] text-[#94A3B8]">Layers (Hidden Data)</div>
          </div>

          <div className="text-lg text-[#64748B] font-bold">+</div>

          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-[#111827] border border-[#1E293B] flex items-center justify-center text-[#A855F7]">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="text-[11px] text-[#94A3B8]">Veil / Flow (Concealment)</div>
          </div>

          <div className="text-lg text-[#64748B] font-bold">=</div>

          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-[#111827] border border-[#7C3AED]/50 flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.3)]">
              <OmbrixLogo size={28} showText={false} variant="primary-dark" />
            </div>
            <div className="text-[11px] text-[#A855F7] font-semibold">Hexagonal Prism</div>
          </div>
        </div>
      </div>

      {/* Logo System Gallery (4 Variants from Brand Guide) */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
          Logo System Variants
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Primary Dark */}
          <div className="p-4 rounded-2xl bg-[#0B0F19] border border-[#1E293B] flex flex-col justify-between space-y-3">
            <div className="text-[10px] font-mono text-[#94A3B8] uppercase">Primary (Dark)</div>
            <div className="py-2 flex items-center justify-center">
              <OmbrixLogo size={32} showText={true} tagline={false} variant="primary-dark" />
            </div>
            <div className="text-[11px] text-[#64748B] text-center">Default dark application</div>
          </div>

          {/* Primary Light */}
          <div className="p-4 rounded-2xl bg-[#0B0F19] border border-[#1E293B] flex flex-col justify-between space-y-3">
            <div className="text-[10px] font-mono text-[#94A3B8] uppercase">Primary (Light)</div>
            <div className="py-2 flex items-center justify-center">
              <OmbrixLogo size={28} showText={true} tagline={false} variant="primary-light" />
            </div>
            <div className="text-[11px] text-[#64748B] text-center">
              Inverted documents & export
            </div>
          </div>

          {/* Monochrome */}
          <div className="p-4 rounded-2xl bg-[#0B0F19] border border-[#1E293B] flex flex-col justify-between space-y-3">
            <div className="text-[10px] font-mono text-[#94A3B8] uppercase">Monochrome</div>
            <div className="py-2 flex items-center justify-center">
              <OmbrixLogo size={32} showText={true} tagline={false} variant="monochrome" />
            </div>
            <div className="text-[11px] text-[#64748B] text-center">
              High-contrast air-gap print
            </div>
          </div>

          {/* App Icon (Square) */}
          <div className="p-4 rounded-2xl bg-[#0B0F19] border border-[#1E293B] flex flex-col justify-between space-y-3">
            <div className="text-[10px] font-mono text-[#94A3B8] uppercase">App Icon (Square)</div>
            <div className="py-2 flex items-center justify-center">
              <OmbrixLogo size={28} showText={false} variant="app-icon" />
            </div>
            <div className="text-[11px] text-[#64748B] text-center">Desktop & Mobile PWA</div>
          </div>
        </div>
      </div>

      {/* Color Swatches Grid from Brand Reference */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
            Brand Color Palette Tokens
          </div>
          {copiedHex && (
            <span className="text-[11px] font-mono text-[#14B8A6]">
              Copied {copiedHex} to clipboard!
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {colorTokens.map((token) => (
            <button
              type="button"
              key={token.name}
              onClick={() => copyToClipboard(token.hex)}
              className="p-3 rounded-2xl bg-[#0B0F19] hover:bg-[#1E293B] border border-[#1E293B] hover:border-[#7C3AED]/40 space-y-2 text-left transition-all cursor-pointer group"
            >
              <div
                className={`w-full h-10 rounded-xl ${token.bg} border border-white/10 shadow-inner group-hover:scale-105 transition-transform`}
              />
              <div>
                <div className="text-xs font-semibold text-white truncate">{token.name}</div>
                <div className="text-[10px] font-mono text-[#94A3B8]">{token.hex}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Typography & System Iconography */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Typography */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-[#0B0F19] border border-[#1E293B] space-y-4">
          <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
            Typography System
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-3xl font-bold font-['Sora'] text-white">Aa</div>
              <div className="text-xs font-semibold text-white">Sora (Headlines)</div>
              <div className="text-[10px] text-[#94A3B8]">Bold • Semibold • Medium</div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-normal font-sans text-white">Aa</div>
              <div className="text-xs font-semibold text-white">Inter (UI & Body)</div>
              <div className="text-[10px] text-[#94A3B8]">Regular • Medium • Semibold</div>
            </div>
          </div>
        </div>

        {/* System Iconography */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-[#0B0F19] border border-[#1E293B] space-y-4">
          <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
            System Iconography
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
            {systemIcons.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.name}
                  className="p-2.5 rounded-xl bg-[#111827] border border-[#1E293B] flex flex-col items-center gap-1.5"
                >
                  <Icon className="w-5 h-5 text-[#A855F7]" />
                  <span className="text-[11px] font-medium text-white">{item.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Visual Direction / Mood Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#0B0F19] border border-[#1E293B] space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#A855F7]">
            <Layers className="w-4 h-4" />
            <span>Layers & Depth</span>
          </div>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Multi-layered information architecture with glassmorphism, depth cards, and subtle
            gradient rim lighting.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0B0F19] border border-[#1E293B] space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#3B82F6]">
            <Sparkles className="w-4 h-4" />
            <span>Concealment & Flow</span>
          </div>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Fluid spatial flow lines representing data concealment across deterministic RGB
            channels.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0B0F19] border border-[#1E293B] space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#14B8A6]">
            <Binary className="w-4 h-4" />
            <span>Security & Trust</span>
          </div>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Strict client-side sandbox execution, zero server transmission, and libsodium sealed-box
            integrity.
          </p>
        </div>
      </div>
    </section>
  );
};
