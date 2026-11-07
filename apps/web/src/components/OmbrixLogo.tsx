import type React from 'react';

interface OmbrixLogoProps {
  size?: number;
  showText?: boolean;
  tagline?: boolean;
  className?: string;
}

export const OmbrixLogo: React.FC<OmbrixLogoProps> = ({
  size = 36,
  showText = true,
  tagline = false,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* OMBRIX Folded Ring / Diamond Glyph */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0 drop-shadow-[0_0_12px_rgba(124,58,237,0.5)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="ombrix-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="50%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <linearGradient id="ombrix-grad-inner" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Outer Folded Diamond Ring */}
        <path d="M 50 8 L 90 38 L 82 54 L 50 30 L 18 54 L 10 38 Z" fill="url(#ombrix-grad-1)" />
        <path
          d="M 90 38 L 90 62 L 50 92 L 10 62 L 10 38 L 18 54 L 50 76 L 82 54 Z"
          fill="url(#ombrix-grad-1)"
          fillOpacity="0.9"
        />

        {/* Inner Concealed Layer Geometric Loop */}
        <polygon
          points="50,32 78,52 50,72 22,52"
          fill="url(#ombrix-grad-inner)"
          stroke="#A855F7"
          strokeWidth="1.5"
          strokeOpacity="0.6"
        />
      </svg>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-['Sora'] font-extrabold tracking-wider text-white text-lg leading-tight">
              OMBRIX
            </span>
            <span className="text-[10px] font-mono font-medium text-[#7C3AED] px-1 py-0.2 bg-[#7C3AED]/10 border border-[#7C3AED]/30 rounded">
              v1.0
            </span>
          </div>
          {tagline && (
            <span className="text-xs text-[#94A3B8] tracking-wide italic">
              Beyond what the eye can see.
            </span>
          )}
        </div>
      )}
    </div>
  );
};
