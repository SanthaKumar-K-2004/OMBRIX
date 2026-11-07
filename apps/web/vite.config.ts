import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@ombrix/image-validation': path.resolve(
        __dirname,
        '../../packages/image-validation/src/index.ts',
      ),
      '@ombrix/payload-protocol': path.resolve(
        __dirname,
        '../../packages/payload-protocol/src/index.ts',
      ),
      '@ombrix/stego-interface': path.resolve(
        __dirname,
        '../../packages/stego-interface/src/index.ts',
      ),
      '@ombrix/stego-png-lsb': path.resolve(__dirname, '../../packages/stego-png-lsb/src/index.ts'),
      '@ombrix/stego-worker': path.resolve(__dirname, '../../packages/stego-worker/src/index.ts'),
    },
  },
  worker: {
    format: 'es',
  },
});
