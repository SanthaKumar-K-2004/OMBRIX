import {
  Camera,
  Cpu,
  Database,
  FlaskConical,
  Layers,
  Link2,
  Lock,
  Radar,
  Radio,
  Server,
  Split,
  ZoomIn,
} from 'lucide-react';
import type React from 'react';
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

export const Navbar: React.FC<NavbarProps> = ({
  activeModule,
  onSelectModule,
  onOpenDemoModal,
}) => {
  const navItems: Array<{
    id: ProductModule;
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }> = [
    {
      id: 'core',
      label: 'Core',
      sublabel: 'Steganography Engine',
      icon: Layers,
    },
    {
      id: 'vault',
      label: 'Vault',
      sublabel: 'Key Management',
      icon: Lock,
    },
    {
      id: 'lens',
      label: 'Lens',
      sublabel: 'Visual Forensics',
      icon: ZoomIn,
    },
    {
      id: 'lab',
      label: 'Lab',
      sublabel: 'Algorithm Lab',
      icon: FlaskConical,
    },
    {
      id: 'transit',
      label: 'Transit',
      sublabel: 'Resilience & Trace',
      icon: Radio,
    },
    {
      id: 'scan',
      label: 'Scan',
      sublabel: 'Forensics Lab',
      icon: Radar,
      badge: 'Phase 6',
    },
    {
      id: 'airgap',
      label: 'Air-Gap',
      sublabel: 'Optical Transport',
      icon: Camera,
      badge: 'New',
    },
    {
      id: 'relay',
      label: 'Relay',
      sublabel: 'Zero-Knowledge Store',
      icon: Server,
      badge: 'New',
    },
    {
      id: 'link',
      label: 'Link',
      sublabel: 'Ephemeral Sharing',
      icon: Link2,
      badge: 'Phase 5',
    },
    {
      id: 'flow',
      label: 'Flow',
      sublabel: 'Batch Automation',
      icon: Split,
      badge: 'Phase 5',
    },
    {
      id: 'edge',
      label: 'Edge',
      sublabel: 'Developer SDK',
      icon: Cpu,
      badge: 'SDK v1',
    },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[#1E293B] bg-[#0B0F19]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-6">
            <OmbrixLogo tagline={true} />
          </div>

          {/* Module Nav Items */}
          <nav className="hidden md:flex items-center gap-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectModule(item.id)}
                  className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#7C3AED]/15 text-white border border-[#7C3AED]/40 shadow-[0_0_15px_rgba(124,58,237,0.25)]'
                      : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1E293B]/50 border border-transparent'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-[#A855F7]' : 'text-[#64748B] group-hover:text-[#94A3B8]'
                    }`}
                  />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                        isActive ? 'bg-[#7C3AED]/30 text-[#E2E8F0]' : 'bg-[#1E293B] text-[#64748B]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Status Badge & Demo Vectors */}
          <div className="flex items-center gap-3">
            {onOpenDemoModal && (
              <button
                type="button"
                onClick={onOpenDemoModal}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-xs font-medium text-[#E2E8F0] transition-colors"
                title="Open Curated Demo Dataset"
              >
                <Database className="w-3.5 h-3.5 text-[#06B6D4]" />
                <span className="hidden sm:inline">Demo Vectors</span>
              </button>
            )}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/30 text-[#14B8A6] text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6] animate-pulse" />
              <span>Local Sandbox Active</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
