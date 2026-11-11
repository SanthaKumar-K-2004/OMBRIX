import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

// Find esbuild binary
const candidatePaths = [
  path.join(root, 'node_modules/.pnpm/node_modules/.bin/esbuild'),
  path.join(root, 'node_modules/.pnpm/esbuild@0.25.12/node_modules/esbuild/bin/esbuild'),
  path.join(root, 'node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/bin/esbuild'),
];

const esbuildBin = candidatePaths.find((p) => fs.existsSync(p));
if (!esbuildBin) {
  console.error('❌ Could not locate local esbuild binary.');
  process.exit(1);
}

console.log('⚡ Building OMBRIX CLI & MCP Server using esbuild...');

fs.mkdirSync(path.join(root, 'packages/cli/dist'), { recursive: true });
fs.mkdirSync(path.join(root, 'packages/mcp-server/dist'), { recursive: true });

// 1. Build CLI
const cliIn = path.join(root, 'packages/cli/src/bin.ts');
const cliOut = path.join(root, 'packages/cli/dist/bin.js');
execFileSync(
  esbuildBin,
  [cliIn, '--bundle', '--platform=node', '--target=node20', '--format=esm', `--outfile=${cliOut}`],
  { stdio: 'inherit' },
);
fs.chmodSync(cliOut, 0o755);

// 2. Build MCP Server
const mcpIn = path.join(root, 'packages/mcp-server/src/index.ts');
const mcpOut = path.join(root, 'packages/mcp-server/dist/index.js');
execFileSync(
  esbuildBin,
  [mcpIn, '--bundle', '--platform=node', '--target=node20', '--format=esm', `--outfile=${mcpOut}`],
  { stdio: 'inherit' },
);
fs.chmodSync(mcpOut, 0o755);

console.log('✔ Successfully built @ombrix/cli and @ombrix/mcp-server!');
