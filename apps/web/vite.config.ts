import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { type Plugin, defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Dev-only plugin to allow Vite HMR WebSocket on localhost while strictly preserving
 * connect-src 'none' in production builds and in index.html.
 */
function devCspPlugin(): Plugin {
  return {
    name: 'dev-csp-hmr',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(
        "connect-src 'none'",
        "connect-src 'self' ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:*",
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devCspPlugin()],
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
      '@ombrix/crypto-adapter': path.resolve(
        __dirname,
        '../../packages/crypto-adapter/src/index.ts',
      ),
      '@ombrix/carrier-lens': path.resolve(__dirname, '../../packages/carrier-lens/src/index.ts'),
      '@ombrix/stego-lab': path.resolve(__dirname, '../../packages/stego-lab/src/index.ts'),
      '@ombrix/transit-trace': path.resolve(__dirname, '../../packages/transit-trace/src/index.ts'),
      '@ombrix/link-sharing': path.resolve(__dirname, '../../packages/link-sharing/src/index.ts'),
      '@ombrix/batch-pipeline': path.resolve(
        __dirname,
        '../../packages/batch-pipeline/src/index.ts',
      ),
      '@ombrix/edge-sdk': path.resolve(__dirname, '../../packages/edge-sdk/src/index.ts'),
      '@ombrix/stego-advanced': path.resolve(
        __dirname,
        '../../packages/stego-advanced/src/index.ts',
      ),
      '@ombrix/stego-forensics': path.resolve(
        __dirname,
        '../../packages/stego-forensics/src/index.ts',
      ),
      '@ombrix/optical-airgap': path.resolve(
        __dirname,
        '../../packages/optical-airgap/src/index.ts',
      ),
      '@ombrix/relay-core': path.resolve(__dirname, '../../packages/relay-core/src/index.ts'),
    },
  },
  worker: {
    format: 'es',
  },
});
