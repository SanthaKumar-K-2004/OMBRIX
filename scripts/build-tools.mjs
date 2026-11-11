import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const target = process.argv[2] || 'all';

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

  const hfSpaceDir = path.join(root, 'spaces/huggingface');
  if (fs.existsSync(hfSpaceDir)) {
    fs.copyFileSync(mcpOut, path.join(hfSpaceDir, 'index.js'));
  }
}

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

async function buildEdgeSdk() {
  const sdkIn = path.join(root, 'packages/edge-sdk/src/index.ts');
  const sdkOut = path.join(root, 'packages/edge-sdk/dist/index.js');
  fs.mkdirSync(path.join(root, 'packages/edge-sdk/dist'), { recursive: true });

  await esbuild.build({
    entryPoints: [sdkIn],
    bundle: true,
    platform: 'neutral',
    target: 'es2022',
    format: 'esm',
    outfile: sdkOut,
  });
  fs.writeFileSync(
    path.join(root, 'packages/edge-sdk/dist/index.d.ts'),
    'export * from "../src/index.js";\n',
  );
}

async function buildStegoForensics() {
  const forIn = path.join(root, 'packages/stego-forensics/src/index.ts');
  const forOut = path.join(root, 'packages/stego-forensics/dist/index.js');
  fs.mkdirSync(path.join(root, 'packages/stego-forensics/dist'), { recursive: true });

  await esbuild.build({
    entryPoints: [forIn],
    bundle: true,
    platform: 'neutral',
    target: 'es2022',
    format: 'esm',
    outfile: forOut,
  });
  fs.writeFileSync(
    path.join(root, 'packages/stego-forensics/dist/index.d.ts'),
    'export * from "../src/index.js";\n',
  );
}

async function main() {
  if (target === 'cli') {
    await buildMcp();
    await buildCli();
  } else if (target === 'mcp') {
    await buildMcp();
  } else if (target === 'edge-sdk') {
    await buildEdgeSdk();
  } else if (target === 'forensics') {
    await buildStegoForensics();
  } else {
    await buildMcp();
    await buildCli();
    await buildEdgeSdk();
    await buildStegoForensics();
  }
}

main().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
