import {
  Cpu,
  FlaskConical,
  Layers,
  Link2,
  Lock,
  Radar,
  Radio,
  Shield,
  Split,
  ZoomIn,
} from 'lucide-react';
import type React from 'react';
import type { ProductModule } from './Navbar.js';

interface SuiteCardsProps {
  onSelectModule: (module: ProductModule) => void;
}

export const SuiteCards: React.FC<SuiteCardsProps> = ({ onSelectModule }) => {
  const suiteItems = [
    {
      id: 'core' as ProductModule,
      name: 'OMBRIX Core',
      tagline: 'Steganography engine (hide & extract data)',
      status: 'Phase 1 & 2 Active',
      statusColor: 'text-[#14B8A6] border-[#14B8A6]/30 bg-[#14B8A6]/10',
      icon: Layers,
      description:
        'Deterministic sequential RGB LSB baseline, static PNG chunk verification, decompression bomb defense, and transferable Web Worker sandbox.',
    },
    {
      id: 'vault' as ProductModule,
      name: 'OMBRIX Vault',
      tagline: 'Encrypted secret containers & key management',
      status: 'Phase 3 Active',
      statusColor: 'text-[#14B8A6] border-[#14B8A6]/30 bg-[#14B8A6]/10',
      icon: Lock,
      description:
        'Vetted libsodium sealed boxes, Ed25519 digital signatures, public-key fingerprint verification, and encrypted Argon2id backups.',
    },
    {
      id: 'lens' as ProductModule,
      name: 'OMBRIX Lens',
      tagline: 'Carrier inspection & visual diagnostics',
      status: 'Phase 4 Active',
      statusColor: 'text-[#3B82F6] border-[#3B82F6]/30 bg-[#3B82F6]/10',
      icon: ZoomIn,
      description:
        'Multi-channel bitplane analysis (Bit 0 to Bit 7), 256-bin RGB frequency histograms, and 100x amplified difference maps.',
    },
    {
      id: 'lab' as ProductModule,
      name: 'OMBRIX Lab',
      tagline: 'Algorithm comparison & distortion benchmarks',
      status: 'Phase 4 Active',
      statusColor: 'text-[#3B82F6] border-[#3B82F6]/30 bg-[#3B82F6]/10',
      icon: FlaskConical,
      description:
        'Side-by-side empirical testing of Sequential LSB vs LSB Matching (±1), evaluating PSNR, MSE, SSIM, and throughput.',
    },
    {
      id: 'transit' as ProductModule,
      name: 'OMBRIX Transit & Trace',
      tagline: 'Transformation simulator & χ² forensics',
      status: 'Phase 4 Active',
      statusColor: 'text-[#3B82F6] border-[#3B82F6]/30 bg-[#3B82F6]/10',
      icon: Radio,
      description:
        'Stress test stego carriers against lossy JPEG, resizing, and noise, and detect LSB pairing anomalies via Westfeld Chi-Square analysis.',
    },
    {
      id: 'link' as ProductModule,
      name: 'OMBRIX Link',
      tagline: 'Ephemeral sharing with BLAKE2b hash rings',
      status: 'Phase 5 Active',
      statusColor: 'text-[#A855F7] border-[#A855F7]/30 bg-[#A855F7]/10',
      icon: Link2,
      description:
        'Time-bounded client-side steganographic sharing containers with strict TTL expiration, BLAKE2b carrier hash rings, and Argon2id.',
    },
    {
      id: 'flow' as ProductModule,
      name: 'OMBRIX Flow',
      tagline: 'High-throughput batch automation pipelines',
      status: 'Phase 5 Active',
      statusColor: 'text-[#14B8A6] border-[#14B8A6]/30 bg-[#14B8A6]/10',
      icon: Split,
      description:
        'Batch carrier capacity planning, multi-image payload striping across image shards, and concurrency-controlled worker pool execution.',
    },
    {
      id: 'edge' as ProductModule,
      name: 'OMBRIX Edge',
      tagline: 'Public Developer SDK & Unified Facade',
      status: 'Phase 5 Active',
      statusColor: 'text-[#3B82F6] border-[#3B82F6]/30 bg-[#3B82F6]/10',
      icon: Cpu,
      description:
        'Unified TypeScript SDK export combining all 10 OMBRIX modules into a single ergonomic public API surface.',
    },
    {
      id: 'scan' as ProductModule,
      name: 'OMBRIX Scan',
      tagline: 'Multi-Detector Forensic Steganalysis',
      status: 'Phase 6 Active',
      statusColor: 'text-[#06B6D4] border-[#06B6D4]/30 bg-[#06B6D4]/10',
      icon: Radar,
      description:
        'Empirical forensic workbench combining RS analysis, Sample Pair Analysis (SPA), Chi-Square PoV testing, and 2nd-derivative Laplacian noise heatmaps.',
    },
  ];

  return (
    <section className="space-y-4 pt-4 border-t border-[#1E293B]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold font-['Sora'] text-white">OMBRIX Product Suite</h3>
          <p className="text-xs text-[#94A3B8]">
            Modular privacy architecture defined in Design.jpeg and technical blueprint
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-[#64748B]">
          <Shield className="w-3.5 h-3.5 text-[#14B8A6]" />
          <span>Local-First & Client-Side Only</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suiteItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={`${item.name}-${idx}`}
              onClick={() => onSelectModule(item.id)}
              className="group p-4 rounded-xl bg-[#111827] hover:bg-[#1E293B]/70 border border-[#1E293B] hover:border-[#7C3AED]/50 transition-all text-left flex flex-col justify-between space-y-3 cursor-pointer"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#0B0F19] border border-[#1E293B] flex items-center justify-center text-[#A855F7] group-hover:text-[#3B82F6] transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${item.statusColor}`}
                  >
                    {item.status}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white group-hover:text-[#A855F7] transition-colors">
                    {item.name}
                  </h4>
                  <div className="text-[11px] text-[#A855F7]/80 font-medium">{item.tagline}</div>
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed">{item.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
