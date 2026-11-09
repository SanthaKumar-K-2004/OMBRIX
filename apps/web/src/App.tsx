import { Shield } from 'lucide-react';
import type React from 'react';
import { Suspense, lazy, startTransition, useEffect, useState } from 'react';
import { CoreStudio } from './components/CoreStudio.js';
import { DemoShowcaseModal } from './components/DemoShowcaseModal.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { GhostFibers } from './components/GhostFibers.js';
import { Navbar, type ProductModule } from './components/Navbar.js';
import { studioDataBus } from './services/studioDataBus.js';

// Lazy-load secondary studios to accelerate initial load and minimize main-thread bundle size
const VaultStudio = lazy(() =>
  import('./components/VaultStudio.js').then((m) => ({ default: m.VaultStudio })),
);
const LensStudio = lazy(() =>
  import('./components/LensStudio.js').then((m) => ({ default: m.LensStudio })),
);
const LabStudio = lazy(() =>
  import('./components/LabStudio.js').then((m) => ({ default: m.LabStudio })),
);
const TransitStudio = lazy(() =>
  import('./components/TransitStudio.js').then((m) => ({ default: m.TransitStudio })),
);
const LinkStudio = lazy(() =>
  import('./components/LinkStudio.js').then((m) => ({ default: m.LinkStudio })),
);
const FlowStudio = lazy(() =>
  import('./components/FlowStudio.js').then((m) => ({ default: m.FlowStudio })),
);
const EdgeStudio = lazy(() =>
  import('./components/EdgeStudio.js').then((m) => ({ default: m.EdgeStudio })),
);
const ScanStudio = lazy(() =>
  import('./components/ScanStudio.js').then((m) => ({ default: m.ScanStudio })),
);
const AirGapStudio = lazy(() =>
  import('./components/AirGapStudio.js').then((m) => ({ default: m.AirGapStudio })),
);
const RelayStudio = lazy(() =>
  import('./components/RelayStudio.js').then((m) => ({ default: m.RelayStudio })),
);

export const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ProductModule>('core');
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  // Smooth module transition wrapper to preserve immediate input responsiveness
  const handleSelectModule = (mod: ProductModule) => {
    startTransition(() => {
      setActiveModule(mod);
    });
  };

  // Subscribe to cross-studio programmatic navigation
  useEffect(() => {
    const unsubscribe = studioDataBus.subscribeNavigation((targetModule) => {
      startTransition(() => {
        setActiveModule(targetModule);
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    return unsubscribe;
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#E2E8F0] flex flex-col font-sans relative overflow-x-hidden selection:bg-[#7C3AED]/30 selection:text-white">
      {/* Atmospheric GhostFibers WebGL2 & CSS Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <ErrorBoundary name="Atmospheric Background">
          <GhostFibers
            glowColor="#7C3AED"
            lineColor="#38BDF8"
            secondaryColor="#818CF8"
            gradient="along"
            speed={0.25}
            scale={1.3}
            rotation={16}
            rollSpeed={0.12}
            layers={2}
            waves={1.5}
            twist={1.0}
            threads={22}
            volume={1.2}
            spread={1.3}
            density={0.5}
            thickness={1.2}
            flow={0.3}
            fiberStyle="lines"
            tips={0.1}
            foldGlow={1.0}
            perspective={0.7}
            depthOfField={0.5}
            focusDepth={0}
            particles={0.15}
            sparkle={0.4}
            glow={0.8}
            brightness={1.3}
            vignette={0.2}
            grain={0.01}
            dpr={0.85}
            mouseInteraction={false}
            hoverEffect="none"
            mouseStrength={0}
            pulseOnClick={false}
            intro
            lightMode={false}
          />
        </ErrorBoundary>
        {/* Subtle cybernetic dot grid overlay */}
        <div className="absolute inset-0 bg-grid-pattern opacity-25 mix-blend-overlay pointer-events-none" />
      </div>

      {/* Content Shell */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Navbar with Glassmorphism */}
        <Navbar
          activeModule={activeModule}
          onSelectModule={handleSelectModule}
          onOpenDemoModal={() => setIsDemoModalOpen(true)}
        />

        {/* Demo Showcase Modal */}
        <DemoShowcaseModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />

        {/* Main Studio Workspace */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
          <ErrorBoundary key={activeModule} name={`${activeModule.toUpperCase()} Studio`}>
            <Suspense
              fallback={
                <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 gap-3">
                  <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-mono">Loading studio workspace...</span>
                </div>
              }
            >
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
            </Suspense>
          </ErrorBoundary>
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
                  handleSelectModule('core');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
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
