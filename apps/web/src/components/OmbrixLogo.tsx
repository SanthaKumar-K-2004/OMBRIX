import type React from 'react';

export type LogoVariant = 'primary-dark' | 'primary-light' | 'monochrome' | 'app-icon';

interface OmbrixLogoProps {
  size?: number;
  showText?: boolean;
  tagline?: boolean;
  variant?: LogoVariant;
  className?: string;
}

export const OmbrixLogo: React.FC<OmbrixLogoProps> = ({
  size = 36,
  showText = true,
  tagline = false,
  variant = 'primary-dark',
  className = '',
}) => {
  const isLight = variant === 'primary-light';
  const isMonochrome = variant === 'monochrome';
  const isAppIcon = variant === 'app-icon';

  // SVG Glyph rendering
  const renderGlyph = (glyphSize: number) => (
    <svg
      width={glyphSize}
      height={glyphSize}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`flex-shrink-0 ${
        isMonochrome ? '' : 'drop-shadow-[0_0_12px_rgba(124,58,237,0.5)]'
      }`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ombrix-grad-ribbon-1" x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#A855F7" />
          <stop offset="45%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="ombrix-grad-ribbon-2" x1="100%" y1="10%" x2="0%" y2="90%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="55%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>
        <linearGradient id="ombrix-grad-inner" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* Hexagonal Twisted Ribbon Geometry (O + Layers + Veil/Flow) */}
      {isMonochrome ? (
        <>
          <path
            d="M 50 10 L 88 32 L 88 68 L 50 90 L 12 68 L 12 32 Z"
            stroke="#FFFFFF"
            strokeWidth="7"
            strokeLinejoin="round"
          />
          <path
            d="M 28 38 L 50 26 L 72 38 L 72 62 L 50 74 L 28 62 Z"
            stroke="#FFFFFF"
            strokeWidth="3.5"
            strokeLinejoin="round"
            fill="none"
          />
          <path d="M 12 32 L 50 50 L 88 68" stroke="#FFFFFF" strokeWidth="4" />
        </>
      ) : (
        <>
          {/* Top Fold Ribbon */}
          <path
            d="M 50 8 L 88 30 L 76 46 L 50 30 L 24 46 L 12 30 Z"
            fill="url(#ombrix-grad-ribbon-1)"
          />
          {/* Bottom Fold Ribbon */}
          <path
            d="M 88 30 L 88 70 L 50 92 L 12 70 L 12 30 L 24 46 L 50 62 L 76 46 Z"
            fill="url(#ombrix-grad-ribbon-2)"
          />
          {/* Inner Concealed Layer (Twisted Möbius Core) */}
          <polygon
            points="50,32 74,48 50,64 26,48"
            fill="url(#ombrix-grad-inner)"
            stroke="#A855F7"
            strokeWidth="1.5"
            strokeOpacity="0.7"
          />
        </>
      )}
    </svg>
  );

  // App Icon variant (Rounded squircle tile)
  if (isAppIcon) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl bg-gradient-to-b from-[#1E293B] to-[#0B0F19] border border-[#334155] shadow-xl p-3 ${className}`}
        style={{ width: size * 1.5, height: size * 1.5 }}
      >
        {renderGlyph(size)}
      </div>
    );
  }

  // Light variant wrapper
  if (isLight) {
    return (
      <div
        className={`flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white text-slate-900 border border-slate-200 select-none ${className}`}
      >
        {renderGlyph(size)}
        {showText && (
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-['Sora'] font-extrabold tracking-wider text-slate-900 text-base leading-tight">
                OMBRIX
              </span>
              <span className="text-[10px] font-mono font-semibold text-[#7C3AED] px-1 py-0.2 bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded">
                TM
              </span>
            </div>
            {tagline && (
              <span className="text-[11px] text-slate-500 tracking-wide italic">
                Beyond what the eye can see.
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Primary Dark / Monochrome
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {renderGlyph(size)}

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-['Sora'] font-extrabold tracking-wider text-lg leading-tight ${
                isMonochrome ? 'text-white' : 'text-white'
              }`}
            >
              OMBRIX
            </span>
          </div>
          {tagline && (
            <span className="text-xs text-[#94A3B8] tracking-wide italic hidden sm:inline-block">
              Beyond what the eye can see.
            </span>
          )}
        </div>
      )}
    </div>
  );
};
