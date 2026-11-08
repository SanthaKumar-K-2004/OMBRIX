import type React from 'react';
import { useRef, useState } from 'react';

interface SplitComparisonSliderProps {
  originalUrl: string;
  stegoUrl: string;
  psnr?: number | null;
  mse?: number | null;
}

export const SplitComparisonSlider: React.FC<SplitComparisonSliderProps> = ({
  originalUrl,
  stegoUrl,
  psnr,
  mse,
}) => {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons === 1) {
      updatePosition(e.clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches[0]) {
      updatePosition(e.touches[0].clientX);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#94A3B8] font-medium flex items-center gap-1.5">
          <span>Visual Distortion Comparison</span>
          <span className="text-[10px] text-[#64748B]">(Drag slider to inspect)</span>
        </span>
        {psnr !== null && psnr !== undefined && (
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="text-[#14B8A6] font-semibold">
              PSNR: {psnr > 90 ? '>90' : psnr} dB
            </span>
            {mse !== null && mse !== undefined && (
              <span className="text-[#64748B]">MSE: {mse}</span>
            )}
            <span className="px-2 py-0.5 rounded bg-[#14B8A6]/10 text-[#14B8A6] text-[10px]">
              Imperceptible
            </span>
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        role="slider"
        aria-label="Carrier before and after comparison slider"
        aria-valuenow={sliderPos}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            setSliderPos((p) => Math.max(0, p - 5));
          } else if (e.key === 'ArrowRight') {
            setSliderPos((p) => Math.min(100, p + 5));
          }
        }}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        onClick={(e) => updatePosition(e.clientX)}
        className="relative w-full h-64 overflow-hidden rounded-xl border border-[#1E293B] select-none cursor-ew-resize bg-[#0B0F19] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
      >
        {/* Original Base Image */}
        <img
          src={originalUrl}
          alt="Original Carrier"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />
        <span className="absolute top-3 left-3 px-2 py-1 rounded bg-[#0B0F19]/80 backdrop-blur-sm text-[10px] font-mono text-[#94A3B8] border border-[#334155] z-10">
          Original Image
        </span>

        {/* Stego Image Overlaid with Dynamic Clip Path */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{
            clipPath: `polygon(${sliderPos}% 0, 100% 0, 100% 100%, ${sliderPos}% 100%)`,
          }}
        >
          <img
            src={stegoUrl}
            alt="Stego Result"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />
          <span className="absolute top-3 right-3 px-2 py-1 rounded bg-[#7C3AED]/80 backdrop-blur-sm text-[10px] font-mono text-white border border-[#A855F7] z-10">
            OMBRIX Stego (Hidden)
          </span>
        </div>

        {/* Vertical Divider Bar */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)] z-20 pointer-events-none"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#7C3AED] border-2 border-white shadow-xl flex items-center justify-center text-[10px] text-white font-bold">
            ⇄
          </div>
        </div>
      </div>
    </div>
  );
};
