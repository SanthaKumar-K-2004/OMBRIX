import { Shield } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { AirGapStudio } from './components/AirGapStudio.js';
import { AuroraAtmosphere } from './components/AuroraAtmosphere.js';
import { CoreStudio } from './components/CoreStudio.js';
import { DemoShowcaseModal } from './components/DemoShowcaseModal.js';
import { EdgeStudio } from './components/EdgeStudio.js';
import { FlowStudio } from './components/FlowStudio.js';
import { LabStudio } from './components/LabStudio.js';
import { LensStudio } from './components/LensStudio.js';
import { LinkStudio } from './components/LinkStudio.js';
import { Navbar, type ProductModule } from './components/Navbar.js';
import { RelayStudio } from './components/RelayStudio.js';
import { ScanStudio } from './components/ScanStudio.js';
import { TransitStudio } from './components/TransitStudio.js';
import { VaultStudio } from './components/VaultStudio.js';
import { studioDataBus } from './services/studioDataBus.js';

export const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ProductModule>('core');
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  // Subscribe to cross-studio programmatic navigation
  useEffect(() => {
    const unsubscribe = studioDataBus.subscribeNavigation((targetModule) => {
      setActiveModule(targetModule);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    return unsubscribe;
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#E2E8F0] flex flex-col font-sans relative overflow-x-hidden selection:bg-[#7C3AED]/30 selection:text-white">
      {/* Atmospheric Aurora WebGL Shader Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-45">
        <AuroraAtmosphere
          colorStops={['#0B0F19', '#7C3AED', '#A855F7', '#3B82F6', '#14B8A6']}
          amplitude={1.1}
          blend={0.55}
          speed={0.65}
          height={0.55}
          glow={0.65}
          brightness={0.9}
        />
        {/* Subtle cybernetic dot grid overlay */}
        <div className="absolute inset-0 bg-grid-pattern opacity-60 mix-blend-overlay" />
      </div>

      {/* Content Shell */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Navbar with Glassmorphism */}
        <Navbar
          activeModule={activeModule}
          onSelectModule={setActiveModule}
          onOpenDemoModal={() => setIsDemoModalOpen(true)}
        />

        {/* Demo Showcase Modal */}
        <DemoShowcaseModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />

        {/* Main Studio Workspace */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
          {/* Module Content */}
          {activeModule === 'core' && <CoreStudio />}

          {activeModule === 'vault' && <VaultStudio />}

          {activeModule === 'lens' && <LensStudio />}

          {activeModule === 'lab' && <LabStudio />}

          {activeModule === 'transit' && <TransitStudio />}

          {activeModule === 'link' && <LinkStudio />}

          {activeModule === 'flow' && <FlowStudio />}

          {activeModule === 'edge' && <EdgeStudio />}

          {activeModule === 'scan' && <ScanStudio />}

          {activeModule === 'airgap' && <AirGapStudio />}

          {activeModule === 'relay' && <RelayStudio />}
        </main>

        {/* Glassmorphism Footer */}
        <footer className="border-t border-[#1E293B]/80 bg-[#0B0F19]/85 backdrop-blur-md py-6 text-xs text-[#64748B]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white tracking-wide">OMBRIX™</span>
              <span>—</span>
              <span className="italic text-[#94A3B8]">Beyond what the eye can see.</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] flex-wrap justify-center">
              <span className="flex items-center gap-1.5 text-[#14B8A6]">
                <Shield className="w-3.5 h-3.5" />
                <span>Zero-Server Architecture</span>
              </span>
              <span className="text-[#334155]">•</span>
              <span>Local-First Sandbox</span>
              <span className="text-[#334155]">•</span>
              <button
                type="button"
                onClick={() => {
                  setActiveModule('core');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="text-[#94A3B8] hover:text-white transition-colors"
              >
                Core Stego Engine
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
