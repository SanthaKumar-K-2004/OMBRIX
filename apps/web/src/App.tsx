import { Shield } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { BrandShowcase } from './components/BrandShowcase.js';
import { CoreStudio } from './components/CoreStudio.js';
import { DemoShowcaseModal } from './components/DemoShowcaseModal.js';
import { EdgeStudio } from './components/EdgeStudio.js';
import { FlowStudio } from './components/FlowStudio.js';
import { LabStudio } from './components/LabStudio.js';
import { LensStudio } from './components/LensStudio.js';
import { LinkStudio } from './components/LinkStudio.js';
import { Navbar, type ProductModule } from './components/Navbar.js';
import { ScanStudio } from './components/ScanStudio.js';
import { SuiteCards } from './components/SuiteCards.js';
import { TransitStudio } from './components/TransitStudio.js';
import { VaultStudio } from './components/VaultStudio.js';

export const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ProductModule>('core');
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#E2E8F0] flex flex-col font-sans bg-grid-pattern">
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

        {/* Brand System & Design Tokens Showcase */}
        <BrandShowcase />

        {/* Product Suite Cards */}
        <SuiteCards onSelectModule={setActiveModule} />
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1E293B] bg-[#0B0F19] py-6 text-xs text-[#64748B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">OMBRIX™</span>
            <span>—</span>
            <span className="italic">Beyond what the eye can see.</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-[#14B8A6]">
              <Shield className="w-3.5 h-3.5" />
              <span>Zero-Server Architecture</span>
            </span>
            <span className="text-[#334155]">•</span>
            <span>TypeScript Strict Mode</span>
            <span className="text-[#334155]">•</span>
            <span>Local-First Sandbox</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
