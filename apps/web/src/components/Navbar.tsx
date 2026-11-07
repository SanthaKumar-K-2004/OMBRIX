import { Cpu, Layers, Link as LinkIcon, Lock, Search, Workflow } from 'lucide-react';
import type React from 'react';
import { OmbrixLogo } from './OmbrixLogo.js';

export type ProductModule = 'core' | 'vault' | 'link' | 'scan' | 'flow' | 'edge';

interface NavbarProps {
  activeModule: ProductModule;
  onSelectModule: (module: ProductModule) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeModule, onSelectModule }) => {
  const navItems: Array<{
    id: ProductModule;
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }> = [
    {
      id: 'core',
      label: 'OMBRIX Core',
      sublabel: 'Steganography Engine',
      icon: Layers,
    },
    {
      id: 'vault',
      label: 'OMBRIX Vault',
      sublabel: 'Key Management',
      icon: Lock,
      badge: 'Phase 3',
    },
    {
      id: 'link',
      label: 'OMBRIX Link',
      sublabel: 'Secure Sharing',
      icon: LinkIcon,
      badge: 'Planned',
    },
    {
      id: 'scan',
      label: 'OMBRIX Scan',
      sublabel: 'Media Forensics',
      icon: Search,
      badge: 'Planned',
    },
    {
      id: 'flow',
      label: 'OMBRIX Flow',
      sublabel: 'Batch Pipeline',
      icon: Workflow,
      badge: 'Planned',
    },
    {
      id: 'edge',
      label: 'OMBRIX Edge',
      sublabel: 'Developer SDK',
      icon: Cpu,
      badge: 'v1 Spec',
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

          {/* Status Badge */}
          <div className="flex items-center gap-3">
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
