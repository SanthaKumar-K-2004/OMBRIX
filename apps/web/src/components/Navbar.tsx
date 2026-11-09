import {
  Camera,
  ChevronDown,
  Cpu,
  Database,
  Eye,
  EyeOff,
  FlaskConical,
  Link2,
  Lock,
  Menu,
  Radar,
  Radio,
  Server,
  Shield,
  Split,
  Wrench,
  X,
  ZoomIn,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { studioDataBus } from '../services/studioDataBus.js';
import { OmbrixLogo } from './OmbrixLogo.js';

export type ProductModule =
  | 'core'
  | 'vault'
  | 'lens'
  | 'lab'
  | 'transit'
  | 'scan'
  | 'airgap'
  | 'relay'
  | 'link'
  | 'flow'
  | 'edge';

interface NavbarProps {
  activeModule: ProductModule;
  onSelectModule: (module: ProductModule) => void;
  onOpenDemoModal?: () => void;
}

interface SecondaryTool {
  id: ProductModule;
  label: string;
  sublabel: string;
  category: 'Forensics' | 'Security & Transport' | 'Automation';
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const PRIMARY_TOOL = {
  id: 'core' as ProductModule,
  label: 'Core Steganography',
  sublabel: 'Deterministic & stealth stego engine',
};

const SECONDARY_TOOLS: SecondaryTool[] = [
  // Forensics & Inspection
  {
    id: 'lens',
    label: 'Visual Lens',
    sublabel: 'Bitplane analysis & RGB histograms',
    category: 'Forensics',
    icon: ZoomIn,
  },
  {
    id: 'scan',
    label: 'Forensic Scan',
    sublabel: 'RS, SPA & Laplacian noise forensics',
    category: 'Forensics',
    icon: Radar,
    badge: 'AI/RS',
  },
  {
    id: 'transit',
    label: 'Transit & Trace',
    sublabel: 'Lossy resilience & Chi-Square test',
    category: 'Forensics',
    icon: Radio,
  },

  // Security & Transport
  {
    id: 'vault',
    label: 'Key Vault',
    sublabel: 'Libsodium keypairs & identities',
    category: 'Security & Transport',
    icon: Lock,
  },
  {
    id: 'airgap',
    label: 'Optical Air-Gap',
    sublabel: 'Screen-to-camera optical frames',
    category: 'Security & Transport',
    icon: Camera,
    badge: 'QR/Opt',
  },
  {
    id: 'relay',
    label: 'Zero-Knowledge Relay',
    sublabel: 'Blind transit & single-use burn store',
    category: 'Security & Transport',
    icon: Server,
    badge: 'Burn',
  },
  {
    id: 'link',
    label: 'Ephemeral Link',
    sublabel: 'Time-bounded encrypted sharing',
    category: 'Security & Transport',
    icon: Link2,
  },

  // Automation & Developer
  {
    id: 'lab',
    label: 'Algorithm Lab',
    sublabel: 'Empirical distortion & PSNR benchmark',
    category: 'Automation',
    icon: FlaskConical,
  },
  {
    id: 'flow',
    label: 'Batch Flow',
    sublabel: 'Multi-image high-throughput striping',
    category: 'Automation',
    icon: Split,
  },
  {
    id: 'edge',
    label: 'Edge SDK',
    sublabel: 'Unified client TypeScript SDK surface',
    category: 'Automation',
    icon: Cpu,
  },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeModule,
  onSelectModule,
  onOpenDemoModal,
}) => {
  const [activeCoreTab, setActiveCoreTab] = useState<'hide' | 'reveal'>('hide');
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return studioDataBus.subscribeCoreTab((tab) => {
      setActiveCoreTab(tab);
    });
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsToolsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCoreTab = (tab: 'hide' | 'reveal') => {
    studioDataBus.setCoreTab(tab);
    onSelectModule('core');
    setIsToolsOpen(false);
    setIsMobileMenuOpen(false);
  };

  const handleSelectTool = (moduleId: ProductModule) => {
    onSelectModule(moduleId);
    setIsToolsOpen(false);
    setIsMobileMenuOpen(false);
  };

  const activeSecondaryTool = SECONDARY_TOOLS.find((t) => t.id === activeModule);

  return (
    <header className="sticky top-0 z-50 border-b border-[#1E293B] bg-[#0B0F19]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Tagline */}
          <button
            type="button"
            className="flex items-center gap-3 cursor-pointer shrink-0 bg-transparent border-0 p-0 text-left focus:outline-none focus:ring-2 focus:ring-[#7C3AED] rounded-lg"
            onClick={() => handleSelectCoreTab('hide')}
            aria-label="OMBRIX Home"
          >
            <OmbrixLogo tagline={true} />
          </button>

          {/* Active Studio Indicator (Center) */}
          <div className="hidden md:flex items-center gap-2 text-xs font-mono bg-[#111827]/80 px-3.5 py-1.5 rounded-xl border border-white/[0.08]">
            <span className="text-slate-400 font-sans font-medium">Studio /</span>
            <span className="text-white font-semibold">
              {activeSecondaryTool ? activeSecondaryTool.label : 'Core Steganography'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono ml-1">
              Active
            </span>
          </div>

          {/* Right Controls & Secondary Tools Dropdown */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Advanced Tools Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsToolsOpen((prev) => !prev)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  activeSecondaryTool
                    ? 'bg-violet-600/20 border-violet-500/50 text-white'
                    : 'bg-[#1E293B]/80 hover:bg-[#2A374F] border-white/[0.08] text-slate-300 hover:text-white'
                }`}
              >
                <Wrench className="w-3.5 h-3.5 text-violet-400" />
                <span>{activeSecondaryTool ? activeSecondaryTool.label : 'Advanced Tools'}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${isToolsOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown Menu */}
              {isToolsOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-[#0F172A] border border-[#334155] shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#64748B] border-b border-[#1E293B]">
                    Specialized Forensic & Security Modules
                  </div>

                  <div className="py-2 space-y-3 max-h-[70vh] overflow-y-auto">
                    {(['Forensics', 'Security & Transport', 'Automation'] as const).map((cat) => (
                      <div key={cat} className="space-y-1">
                        <div className="px-3 text-[10px] font-bold text-[#A855F7] uppercase tracking-wider">
                          {cat}
                        </div>
                        {SECONDARY_TOOLS.filter((t) => t.category === cat).map((tool) => {
                          const Icon = tool.icon;
                          const isCurrent = activeModule === tool.id;
                          return (
                            <button
                              key={tool.id}
                              type="button"
                              onClick={() => handleSelectTool(tool.id)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                                isCurrent
                                  ? 'bg-[#7C3AED]/25 text-white border border-[#7C3AED]/40'
                                  : 'hover:bg-[#1E293B]/70 text-[#94A3B8] hover:text-[#E2E8F0]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <Icon
                                  className={`w-4 h-4 ${isCurrent ? 'text-[#C084FC]' : 'text-[#64748B]'}`}
                                />
                                <div>
                                  <div className="text-xs font-medium text-white">{tool.label}</div>
                                  <div className="text-[10px] text-[#64748B] line-clamp-1">
                                    {tool.sublabel}
                                  </div>
                                </div>
                              </div>
                              {tool.badge && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-[#1E293B] text-[#94A3B8]">
                                  {tool.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Demo Vectors Quick Launcher */}
            {onOpenDemoModal && (
              <button
                type="button"
                onClick={onOpenDemoModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E293B]/80 hover:bg-[#334155] border border-[#334155] text-xs font-medium text-[#E2E8F0] transition-colors"
                title="Open Curated Forensic Datasets"
              >
                <Database className="w-3.5 h-3.5 text-[#06B6D4]" />
                <span>Demo Datasets</span>
              </button>
            )}

            {/* Sandbox Status Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/30 text-[#14B8A6] text-xs font-mono shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#14B8A6] animate-pulse" />
              <span>100% Client-Side</span>
            </div>
          </div>

          {/* Mobile & Tablet Hamburger Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="p-2 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-[#E2E8F0] border border-[#334155] transition-colors"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile & Tablet Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-[#1E293B] bg-[#0B0F19] px-4 pt-3 pb-6 space-y-4 shadow-2xl">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleSelectCoreTab('hide')}
              className={`flex items-center justify-center gap-2 p-3 rounded-lg text-xs font-semibold ${
                activeModule === 'core' && activeCoreTab === 'hide'
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-[#1E293B] text-[#94A3B8]'
              }`}
            >
              <EyeOff className="w-4 h-4" />
              <span>Hide (Encode)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectCoreTab('reveal')}
              className={`flex items-center justify-center gap-2 p-3 rounded-lg text-xs font-semibold ${
                activeModule === 'core' && activeCoreTab === 'reveal'
                  ? 'bg-[#3B82F6] text-white'
                  : 'bg-[#1E293B] text-[#94A3B8]'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>Reveal (Decode)</span>
            </button>
          </div>

          <div className="pt-2 border-t border-[#1E293B] space-y-2">
            <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
              Forensic & Cryptographic Tools
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SECONDARY_TOOLS.map((t) => {
                const Icon = t.icon;
                const isCurrent = activeModule === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTool(t.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg text-left text-xs ${
                      isCurrent
                        ? 'bg-[#7C3AED]/20 text-[#A855F7] border border-[#7C3AED]/40'
                        : 'bg-[#131B2E] text-[#94A3B8] border border-[#1E293B]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-[#1E293B]">
            {onOpenDemoModal && (
              <button
                type="button"
                onClick={() => {
                  onOpenDemoModal();
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E293B] text-xs font-medium text-[#E2E8F0]"
              >
                <Database className="w-3.5 h-3.5 text-[#06B6D4]" />
                <span>Demo Datasets</span>
              </button>
            )}
            <div className="flex items-center gap-2 text-xs text-[#14B8A6]">
              <Shield className="w-3.5 h-3.5" />
              <span>Local Sandbox</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
