import { AuroraBackground } from '@nauverse/react-aurora-background';
import type React from 'react';
import { useEffect, useState } from 'react';

export const AuroraAtmosphere: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [hasWebGL, setHasWebGL] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setHasWebGL(Boolean(gl));
    } catch {
      setHasWebGL(false);
    }
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#0B0F19]"
      aria-hidden="true"
    >
      {mounted && hasWebGL ? (
        <AuroraBackground
          bgColor="#0B0F19"
          colors={['#7C3AED', '#3B82F6', '#14B8A6', '#A855F7']}
          numBubbles={5}
          blurAmount="120px"
          animDuration={22}
          fps={30}
          className="w-full h-full opacity-65 mix-blend-screen"
        />
      ) : (
        /* GPU-accelerated CSS ambient gradient fallback */
        <div className="w-full h-full relative">
          <div className="absolute -top-[25%] -left-[10%] w-[65%] h-[65%] rounded-full bg-gradient-to-br from-[#7C3AED]/25 via-[#3B82F6]/20 to-transparent blur-[140px]" />
          <div className="absolute top-[15%] -right-[15%] w-[60%] h-[60%] rounded-full bg-gradient-to-bl from-[#14B8A6]/20 via-[#A855F7]/25 to-transparent blur-[150px]" />
          <div className="absolute -bottom-[20%] left-[20%] w-[50%] h-[50%] rounded-full bg-[#7C3AED]/15 blur-[130px]" />
        </div>
      )}

      {/* Cyber-mountain horizon line silhouette with ambient rim glow */}
      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-[#0B0F19] via-[#0B0F19]/90 to-transparent pointer-events-none" />
    </div>
  );
};
