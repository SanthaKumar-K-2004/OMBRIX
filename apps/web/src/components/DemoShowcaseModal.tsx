import { Check, Copy, Database, Key, Shield, Sparkles, X } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

interface DemoShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DemoShowcaseModal: React.FC<DemoShowcaseModalProps> = ({ isOpen, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#0B0F19] border border-[#1E293B] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1E293B] bg-[#111827]/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#7C3AED]/10 text-[#7C3AED] border border-[#7C3AED]/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>OMBRIX Demo Dataset & Forensic Vectors</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#14B8A6]/10 text-[#14B8A6] font-mono border border-[#14B8A6]/20">
                  v0.1.0 Capstone
                </span>
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Curated test vectors for rapid offline evaluation and forensic audits
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-white hover:bg-[#1E293B] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Pre-computed Keypairs */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-3 flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-[#7C3AED]" />
              <span>Reference Cryptographic Keys</span>
            </h3>
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-[#111827] border border-[#1E293B] flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-white flex items-center gap-2">
                    <span>Alice (Curve25519 Encryption)</span>
                    <span className="text-[10px] text-[#64748B] font-mono">ID: E012-3456</span>
                  </div>
                  <div className="text-[11px] font-mono text-[#94A3B8] break-all">
                    e0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      'alice',
                      'e0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde',
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-xs font-medium text-white flex items-center gap-1.5 transition-colors shrink-0"
                >
                  {copiedKey === 'alice' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#14B8A6]" />
                      <span className="text-[#14B8A6]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#94A3B8]" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-[#111827] border border-[#1E293B] flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-white flex items-center gap-2">
                    <span>Bob (Curve25519 Encryption)</span>
                    <span className="text-[10px] text-[#64748B] font-mono">ID: A1B2-C3D4</span>
                  </div>
                  <div className="text-[11px] font-mono text-[#94A3B8] break-all">
                    a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      'bob',
                      'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-xs font-medium text-white flex items-center gap-1.5 transition-colors shrink-0"
                >
                  {copiedKey === 'bob' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#14B8A6]" />
                      <span className="text-[#14B8A6]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#94A3B8]" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Reference Carrier Formats */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-3 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span>Reference Carriers</span>
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#111827] border border-[#1E293B] space-y-1">
                <span className="font-semibold text-white">Gradient Carrier 64x64</span>
                <p className="text-[11px] text-[#64748B]">
                  4,096 pixels with continuous spatial variation. Ideal for testing RS and SPA
                  baseline.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#111827] border border-[#1E293B] space-y-1">
                <span className="font-semibold text-white">Flat Neutral Gray 32x32</span>
                <p className="text-[11px] text-[#64748B]">
                  1,024 uniform pixels. Demonstrates zero high-frequency residual noise.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Threat Boundary Notice */}
          <div className="p-4 rounded-xl bg-[#7C3AED]/5 border border-[#7C3AED]/20 text-xs text-[#94A3B8] flex items-start gap-3">
            <Shield className="w-4 h-4 text-[#7C3AED] shrink-0 mt-0.5" />
            <p>
              <strong className="text-white">Zero Telemetry & Local Evaluation:</strong> All
              vectors, encryptions, and forensic analyses run 100% locally in your browser. Outbound
              requests are mathematically blocked via Content Security Policy.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1E293B] bg-[#111827]/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-medium transition-colors"
          >
            Close Showcase
          </button>
        </div>
      </div>
    </div>
  );
};
