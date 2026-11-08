import { Lock, Sparkles } from 'lucide-react';
import type React from 'react';

interface HeroPerspectiveLayersProps {
  carrierPreviewUrl?: string | null;
}

export const HeroPerspectiveLayers: React.FC<HeroPerspectiveLayersProps> = ({
  carrierPreviewUrl,
}) => {
  return (
    <div className="relative w-full h-44 sm:h-52 my-3 flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-[#111827]/70 to-[#0B0F19]/90 border border-[#1E293B] shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
      {/* Ambient background glow behind planes */}
      <div className="absolute w-44 h-44 rounded-full bg-gradient-to-r from-[#7C3AED]/30 via-[#3B82F6]/30 to-[#14B8A6]/20 blur-[50px] pointer-events-none" />

      {/* 3D Perspective Stage */}
      <div
        className="relative w-64 h-36 sm:w-72 sm:h-40"
        style={{
          perspective: '1000px',
        }}
      >
        {/* Layer 3: Back Security / Encryption Matrix */}
        <div
          className="absolute inset-0 rounded-xl border border-[#3B82F6]/50 bg-gradient-to-br from-[#1E293B]/80 to-[#0B0F19]/90 backdrop-blur-md shadow-xl flex items-center justify-center transition-transform duration-500"
          style={{
            transform: 'rotateX(18deg) rotateY(-22deg) translateZ(-40px) translateX(-25px)',
          }}
        >
          {/* Subtle binary matrix texture */}
          <div className="absolute inset-0 opacity-20 font-mono text-[8px] text-[#38BDF8] p-2 leading-tight overflow-hidden select-none">
            01001111 01001101 01000010 00110001
            <br />
            X25519_XSALSA20_POLY1305_SEALED
            <br />
            CHACHA20_CSPRNG_SCATTER_COORD
            <br />
            DWT_HH_SUBBAND_PVD_CONTRAST
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/20 border border-[#3B82F6]/40 flex items-center justify-center">
            <Lock className="w-4 h-4 text-[#38BDF8]" />
          </div>
        </div>

        {/* Layer 2: Middle Frequency DWT / Bitplane Mesh */}
        <div
          className="absolute inset-0 rounded-xl border border-[#A855F7]/60 bg-gradient-to-br from-[#A855F7]/15 to-[#111827]/80 backdrop-blur-md shadow-2xl flex items-center justify-center transition-transform duration-500"
          style={{
            transform: 'rotateX(18deg) rotateY(-22deg) translateZ(0px) translateX(0px)',
          }}
        >
          <div className="absolute inset-0 bg-grid-pattern opacity-40 rounded-xl" />
          <div className="absolute bottom-2 left-3 flex items-center gap-1.5 text-[9px] font-mono text-[#C084FC]">
            <Sparkles className="w-3 h-3 text-[#A855F7]" />
            <span>Hidden Stego Plane</span>
          </div>
        </div>

        {/* Layer 1: Front Scenic Carrier Layer */}
        <div
          className="absolute inset-0 rounded-xl border border-[#14B8A6]/70 shadow-[0_15px_35px_rgba(0,0,0,0.6)] overflow-hidden transition-transform duration-500 group"
          style={{
            transform: 'rotateX(18deg) rotateY(-22deg) translateZ(40px) translateX(25px)',
          }}
        >
          {carrierPreviewUrl ? (
            <img
              src={carrierPreviewUrl}
              alt="Active Carrier"
              className="w-full h-full object-cover"
            />
          ) : (
            /* Cyber-Mountain Scenic Artwork SVG */
            <svg
              className="w-full h-full"
              viewBox="0 0 288 160"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label="Scenic mountain carrier graphic"
            >
              <defs>
                <linearGradient id="skyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1E1B4B" />
                  <stop offset="50%" stopColor="#4C1D95" />
                  <stop offset="100%" stopColor="#BE185D" />
                </linearGradient>
                <linearGradient id="mtnGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#A7F3D0" />
                  <stop offset="40%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#0F172A" />
                </linearGradient>
                <linearGradient id="mtnGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#F472B6" />
                  <stop offset="50%" stopColor="#7C3AED" />
                  <stop offset="100%" stopColor="#0B0F19" />
                </linearGradient>
              </defs>
              {/* Twilight Sky */}
              <rect width="288" height="160" fill="url(#skyGrad)" />
              {/* Sun / Moon glow */}
              <circle cx="144" cy="90" r="32" fill="#F43F5E" opacity="0.6" filter="blur(8px)" />
              {/* Back Mountains */}
              <polygon
                points="0,160 50,85 110,160 170,70 230,160 288,95 288,160"
                fill="url(#mtnGrad2)"
              />
              {/* Foreground Mountains */}
              <polygon
                points="0,160 80,95 144,45 208,105 288,160"
                fill="url(#mtnGrad1)"
                opacity="0.9"
              />
              {/* Grid Overlay */}
              <line
                x1="0"
                y1="130"
                x2="288"
                y2="130"
                stroke="#38BDF8"
                strokeWidth="0.5"
                opacity="0.3"
              />
              <line
                x1="0"
                y1="145"
                x2="288"
                y2="145"
                stroke="#38BDF8"
                strokeWidth="0.5"
                opacity="0.3"
              />
            </svg>
          )}

          {/* Floating Neon Lock Badge */}
          <div className="absolute top-2.5 right-2.5 px-2 py-1 rounded-md bg-[#0B0F19]/80 border border-[#14B8A6]/60 backdrop-blur-md flex items-center gap-1 shadow-lg">
            <Lock className="w-3 h-3 text-[#14B8A6]" />
            <span className="text-[9px] font-mono font-semibold text-[#14B8A6]">Encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
};
