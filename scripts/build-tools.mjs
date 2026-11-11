import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const target = process.argv[2] || 'all';

async function buildCli() {
  const cliIn = path.join(root, 'packages/cli/src/bin.ts');
  const cliOut = path.join(root, 'packages/cli/dist/bin.js');
  fs.mkdirSync(path.join(root, 'packages/cli/dist'), { recursive: true });

  await esbuild.build({
    entryPoints: [cliIn],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outfile: cliOut,
  });
  fs.chmodSync(cliOut, 0o755);
}

async function buildMcp() {
  const mcpIn = path.join(root, 'packages/mcp-server/src/index.ts');
  const mcpOut = path.join(root, 'packages/mcp-server/dist/index.js');
  fs.mkdirSync(path.join(root, 'packages/mcp-server/dist'), { recursive: true });

  await esbuild.build({
    entryPoints: [mcpIn],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outfile: mcpOut,
  });
  fs.chmodSync(mcpOut, 0o755);
}

async function main() {
  if (target === 'cli') {
    await buildCli();
  } else if (target === 'mcp') {
    await buildMcp();
  } else {
    await buildCli();
    await buildMcp();
  }
}

main().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
