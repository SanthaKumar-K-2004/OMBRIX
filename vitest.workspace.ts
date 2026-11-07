import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineWorkspace } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineWorkspace([
  'packages/*',
  'apps/*',
  {
    test: {
      name: 'integration',
      include: ['tests/integration/**/*.test.ts'],
      globals: true,
      environment: 'node',
    },
    resolve: {
      alias: {
        '@ombrix/crypto-adapter': path.resolve(__dirname, 'packages/crypto-adapter/src/index.ts'),
        '@ombrix/payload-protocol': path.resolve(
          __dirname,
          'packages/payload-protocol/src/index.ts',
        ),
        '@ombrix/image-validation': path.resolve(
          __dirname,
          'packages/image-validation/src/index.ts',
        ),
        '@ombrix/stego-interface': path.resolve(__dirname, 'packages/stego-interface/src/index.ts'),
        '@ombrix/stego-png-lsb': path.resolve(__dirname, 'packages/stego-png-lsb/src/index.ts'),
        '@ombrix/stego-worker': path.resolve(__dirname, 'packages/stego-worker/src/index.ts'),
      },
    },
  },
]);
