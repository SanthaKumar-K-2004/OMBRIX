import {
  BookOpen,
  Camera,
  ChevronDown,
  Cpu,
  Database,
  ExternalLink,
  FlaskConical,
  Home,
  Link2,
  Lock,
  Menu,
  Moon,
  Play,
  Radar,
  Radio,
  Server,
  Settings,
  Split,
  Sun,
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

export const CORE_MODULE_DEF = {
  id: 'core' as const,
  label: 'Core Stego Engine',
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
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleSelectHome = () => {
    studioDataBus.setCoreTab('hide');
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
    <header className="sticky top-0 z-50 border-b border-[#1E293B]/80 bg-[#0B0F19]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Brand Logo & Tagline */}
          <button
            type="button"
            className="flex items-center gap-3 cursor-pointer shrink-0 bg-transparent border-0 p-0 text-left focus:outline-none focus:ring-2 focus:ring-[#7C3AED] rounded-lg"
            onClick={handleSelectHome}
            aria-label="OMBRIX Home"
          >
            <OmbrixLogo tagline={false} />
          </button>

          {/* Center Navigation Pill Bar (Matching Reference) */}
          <nav className="hidden md:flex items-center p-1 bg-[#111827]/90 border border-[#1E293B] rounded-xl shadow-inner text-xs">
            {/* Home */}
            <button
              type="button"
              onClick={handleSelectHome}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                activeModule === 'core'
                  ? 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white shadow-[0_0_12px_rgba(124,58,237,0.4)]'
                  : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1E293B]/50'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>

            {/* Engine */}
            <button
              type="button"
              onClick={() => handleSelectTool('lab')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                activeModule === 'lab'
                  ? 'bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                  : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1E293B]/50'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Engine</span>
            </button>

            {/* Datasets */}
            <button
              type="button"
              onClick={onOpenDemoModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1E293B]/50 transition-all"
            >
              <Database className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span>Datasets</span>
            </button>

            {/* Tools Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsToolsOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                  activeSecondaryTool && activeModule !== 'lab'
                    ? 'bg-[#7C3AED]/20 text-white border border-[#7C3AED]/40'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1E293B]/50'
                }`}
              >
                <Wrench className="w-3.5 h-3.5 text-[#A855F7]" />
                <span>
                  {activeSecondaryTool && activeModule !== 'lab'
                    ? activeSecondaryTool.label
                    : 'Tools'}
                </span>
                <ChevronDown
                  className={`w-3 h-3 transition-transform duration-200 ${isToolsOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown Menu */}
              {isToolsOpen && (
                <div className="absolute left-0 mt-2 w-80 rounded-xl bg-[#0F172A] border border-[#334155] shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#64748B] border-b border-[#1E293B]">
                    Specialized Modules
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

            {/* Docs */}
            <a
              href="https://github.com/SanthaKumar-K-2004/OMBRIX#readme"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1E293B]/50 transition-all"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Docs</span>
              <ExternalLink className="w-3 h-3 text-[#64748B]" />
            </a>
          </nav>

          {/* Right Action Icons & Demo Button (Matching Reference) */}
          <div className="hidden md:flex items-center gap-2.5">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={() => setIsDarkMode((prev) => !prev)}
              className="p-2 rounded-lg bg-[#111827] hover:bg-[#1E293B] border border-[#1E293B] text-[#94A3B8] hover:text-white transition-colors"
              title={isDarkMode ? 'Theme: Dark (Active)' : 'Theme: Light'}
              aria-label="Toggle Theme"
            >
              {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* Settings / Vault Shortcut Button */}
            <button
              type="button"
              onClick={() => handleSelectTool('vault')}
              className={`p-2 rounded-lg border transition-colors ${
                activeModule === 'vault'
                  ? 'bg-[#7C3AED]/20 border-[#7C3AED] text-white'
                  : 'bg-[#111827] hover:bg-[#1E293B] border-[#1E293B] text-[#94A3B8] hover:text-white'
              }`}
              title="Vault & Settings"
              aria-label="Vault & Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Glowing Demo Action Button */}
            {onOpenDemoModal && (
              <button
                type="button"
                onClick={onOpenDemoModal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#7C3AED] via-[#A855F7] to-[#3B82F6] hover:opacity-90 text-white text-xs font-semibold shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Demo</span>
              </button>
            )}
          </div>

          {/* Mobile & Tablet Hamburger Button */}
          <div className="flex items-center gap-2 md:hidden">
            {onOpenDemoModal && (
              <button
                type="button"
                onClick={onOpenDemoModal}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#7C3AED] text-white text-[11px] font-semibold"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Demo</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="p-2 rounded-lg bg-[#1E293B] text-[#94A3B8] hover:text-white border border-[#334155]"
              aria-label="Open mobile menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-[#1E293B] bg-[#0B0F19] p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleSelectHome}
              className="p-2.5 rounded-lg bg-[#111827] border border-[#1E293B] text-left text-xs font-medium text-white flex items-center gap-2"
            >
              <Home className="w-4 h-4 text-[#A855F7]" />
              <span>Home</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectTool('lab')}
              className="p-2.5 rounded-lg bg-[#111827] border border-[#1E293B] text-left text-xs font-medium text-white flex items-center gap-2"
            >
              <Cpu className="w-4 h-4 text-[#3B82F6]" />
              <span>Engine</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenDemoModal?.();
              }}
              className="p-2.5 rounded-lg bg-[#111827] border border-[#1E293B] text-left text-xs font-medium text-white flex items-center gap-2"
            >
              <Database className="w-4 h-4 text-[#06B6D4]" />
              <span>Datasets</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectTool('vault')}
              className="p-2.5 rounded-lg bg-[#111827] border border-[#1E293B] text-left text-xs font-medium text-white flex items-center gap-2"
            >
              <Settings className="w-4 h-4 text-[#14B8A6]" />
              <span>Vault / Settings</span>
            </button>
          </div>

          <div className="space-y-1 pt-2 border-t border-[#1E293B]">
            <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider px-1 mb-1">
              All Tools &amp; Modules
            </div>
            {SECONDARY_TOOLS.map((tool) => {
              const Icon = tool.icon;
              const isCurrent = activeModule === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => handleSelectTool(tool.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isCurrent
                      ? 'bg-[#7C3AED]/25 text-white border border-[#7C3AED]/40'
                      : 'bg-[#111827] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-[#A855F7]" />
                    <span>{tool.label}</span>
                  </div>
                  {tool.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1E293B] text-[#94A3B8]">
                      {tool.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
