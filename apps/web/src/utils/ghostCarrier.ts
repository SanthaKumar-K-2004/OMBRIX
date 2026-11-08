/**
 * OMBRIX Ghost-Gen: Zero-Provenance Procedural Carrier Synthesizer.
 * Generates high-entropy, mathematically pristine synthetic image carriers in-browser.
 *
 * Security Benefits:
 * 1. Zero web footprint: Reverse image searches (Google Lens, TinEye) find 0 matches.
 * 2. Zero camera PRNU sensor noise: Defeats camera hardware provenance tracking.
 * 3. High dynamic texture entropy: Maximizes capacity for DWT, PVD, and Hyper-Matrix stego.
 */

export type GhostCarrierTheme = 'nebula' | 'cyber' | 'quantum' | 'aurora';

export interface GeneratedGhostCarrier {
  width: number;
  height: number;
  imageData: ImageData;
  blobUrl: string;
  file: File;
}

export function generateGhostCarrier(
  theme: GhostCarrierTheme = 'nebula',
  width = 1600,
  height = 900,
): Promise<GeneratedGhostCarrier> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas 2D context unavailable.');

      // 1. Deep Obsidian Base
      ctx.fillStyle = '#0B0F19';
      ctx.fillRect(0, 0, width, height);

      // 2. Theme-Specific Multi-Point Spectral Gradients
      if (theme === 'nebula') {
        // Deep Space Nebula with Violet, Neon Blue & Aurora Purple
        const g1 = ctx.createRadialGradient(
          width * 0.3,
          height * 0.4,
          50,
          width * 0.3,
          height * 0.4,
          width * 0.6,
        );
        g1.addColorStop(0, 'rgba(124, 58, 237, 0.7)'); // Violet Core
        g1.addColorStop(0.5, 'rgba(168, 85, 247, 0.3)'); // Aurora Purple
        g1.addColorStop(1, 'transparent');
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, width, height);

        const g2 = ctx.createRadialGradient(
          width * 0.75,
          height * 0.65,
          80,
          width * 0.75,
          height * 0.65,
          width * 0.5,
        );
        g2.addColorStop(0, 'rgba(59, 130, 246, 0.65)'); // Neon Blue
        g2.addColorStop(0.6, 'rgba(20, 184, 166, 0.25)'); // Teal
        g2.addColorStop(1, 'transparent');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, width, height);
      } else if (theme === 'aurora') {
        // Arctic Atmospheric Waveforms
        const g1 = ctx.createLinearGradient(0, 0, width, height);
        g1.addColorStop(0, '#0B0F19');
        g1.addColorStop(0.35, 'rgba(124, 58, 237, 0.5)');
        g1.addColorStop(0.65, 'rgba(20, 184, 166, 0.45)');
        g1.addColorStop(1, '#0B0F19');
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, width, height);
      } else if (theme === 'cyber') {
        // High-Contrast Cybernetic Matrix
        const g1 = ctx.createRadialGradient(
          width * 0.5,
          height * 0.5,
          20,
          width * 0.5,
          height * 0.5,
          width * 0.7,
        );
        g1.addColorStop(0, 'rgba(20, 184, 166, 0.5)');
        g1.addColorStop(0.4, 'rgba(59, 130, 246, 0.3)');
        g1.addColorStop(1, '#0B0F19');
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, width, height);
      } else {
        // Quantum Prism
        const g1 = ctx.createRadialGradient(
          width * 0.4,
          height * 0.6,
          40,
          width * 0.4,
          height * 0.6,
          width * 0.55,
        );
        g1.addColorStop(0, 'rgba(168, 85, 247, 0.6)');
        g1.addColorStop(0.5, 'rgba(59, 130, 246, 0.35)');
        g1.addColorStop(1, 'transparent');
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, width, height);
      }

      // 3. Procedural High-Frequency Texture Synthesis (Adds natural pixel variance)
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      // Seed pseudo-random generator
      let seed = Date.now() ^ (width * height);
      const fastRand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return (seed >>> 16) / 65536;
      };

      for (let i = 0; i < data.length; i += 4) {
        // Natural micro-texture variance ±4 levels (imperceptible to human eyes, excellent for stego)
        const noise = (fastRand() - 0.5) * 8;
        data[i] = Math.max(0, Math.min(255, (data[i] ?? 0) + noise));
        data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] ?? 0) + noise));
        data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] ?? 0) + noise));
        data[i + 3] = 255; // Completely opaque
      }

      ctx.putImageData(imgData, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to generate PNG blob for Ghost carrier.'));
          return;
        }
        const blobUrl = URL.createObjectURL(blob);
        const file = new File([blob], `ghost-carrier-${Date.now()}.png`, {
          type: 'image/png',
        });
        resolve({
          width,
          height,
          imageData: imgData,
          blobUrl,
          file,
        });
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}
