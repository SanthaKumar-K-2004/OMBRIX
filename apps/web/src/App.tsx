import { CheckCircle2, Laptop, Layers } from 'lucide-react';
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
    <div className="min-h-screen bg-[#0B0F19] text-[#E2E8F0] flex flex-col font-sans relative overflow-x-hidden">
      {/* GPU-Accelerated Dynamic Aurora Atmosphere */}
      <AuroraAtmosphere />

      {/* Top Navbar */}
      <Navbar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        onOpenDemoModal={() => setIsDemoModalOpen(true)}
      />

      {/* Demo Showcase Modal */}
      <DemoShowcaseModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
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

      {/* Footer Matching Target Mockup */}
      <footer className="border-t border-[#1E293B]/70 bg-[#090D16]/90 backdrop-blur-md py-4 text-xs text-[#64748B] relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white tracking-wide">OMBRIX™</span>
            <span className="text-[#334155]">—</span>
            <span className="text-[#94A3B8]">Beyond what the eye can see.</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero-Server Architecture</span>
            </span>
            <span className="text-[#334155]">•</span>
            <span className="flex items-center gap-1.5 text-[#94A3B8]">
              <Laptop className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Local-First Sandbox</span>
            </span>
            <span className="text-[#334155]">•</span>
            <button
              type="button"
              onClick={() => {
                setActiveModule('core');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-1.5 text-[#94A3B8] hover:text-white transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-[#C084FC]" />
              <span>Core Stego Engine</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
