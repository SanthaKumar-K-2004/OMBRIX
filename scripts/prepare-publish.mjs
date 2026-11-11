import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

console.log('🚀 Preparing OMBRIX Production Release Tarballs for npm...\n');

// 1. Build binaries using local esbuild
execFileSync('node', [path.join(root, 'scripts/build-tools.mjs')], { stdio: 'inherit' });

// 2. Prepare directories
const releasesDir = path.join(root, 'releases');
const stagingDir = path.join(root, '.staging_publish');
fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(releasesDir, { recursive: true });
fs.mkdirSync(stagingDir, { recursive: true });

const commonMetadata = {
  version: '0.1.0',
  type: 'module',
  author: 'SanthaKumar K <https://github.com/SanthaKumar-K-2004>',
  license: 'MIT',
  homepage: 'https://ombrix-stego.vercel.app/',
  bugs: 'https://github.com/SanthaKumar-K-2004/OMBRIX/issues',
  repository: {
    type: 'git',
    url: 'git+https://github.com/SanthaKumar-K-2004/OMBRIX.git',
  },
  engines: {
    node: '>=20.0.0',
  },
  publishConfig: {
    access: 'public',
  },
};

const cliDist = path.join(root, 'packages/cli/dist/bin.js');
const mcpDist = path.join(root, 'packages/mcp-server/dist/index.js');
const cliReadme = path.join(root, 'packages/cli/README.md');
const mcpReadme = path.join(root, 'packages/mcp-server/README.md');
const rootReadme = path.join(root, 'README.md');
const licenseFile = path.join(root, 'LICENSE');

const packageConfigs = [
  // 1. Unscoped ombrix-cli (Universal, highly recommended)
  {
    targetName: 'ombrix-cli',
    tarballOutput: 'ombrix-cli-0.1.0.tgz',
    manifest: {
      ...commonMetadata,
      name: 'ombrix-cli',
      description:
        'Zero-telemetry forensic steganography CLI & MCP 2.0 Code Mode runner. Multi-detector steganalysis, DWT, and Argon2id.',
      main: './dist/bin.js',
      bin: {
        ombrix: './dist/bin.js',
        'ombrix-cli': './dist/bin.js',
      },
      keywords: [
        'steganography',
        'steganalysis',
        'forensics',
        'mcp',
        'code-mode',
        'cryptography',
        'argon2id',
        'cli',
        'zero-telemetry',
        'privacy',
      ],
      files: ['dist', 'README.md', 'LICENSE'],
    },
    files: [
      { from: cliDist, to: 'dist/bin.js' },
      { from: cliReadme, to: 'README.md' },
      { from: licenseFile, to: 'LICENSE' },
    ],
  },

  // 2. Unscoped ombrix-mcp-server (Universal, highly recommended)
  {
    targetName: 'ombrix-mcp-server',
    tarballOutput: 'ombrix-mcp-server-0.1.0.tgz',
    manifest: {
      ...commonMetadata,
      name: 'ombrix-mcp-server',
      description:
        'Model Context Protocol (MCP 2.0) server with Code Mode for OMBRIX steganography & visual forensics suite',
      main: './dist/index.js',
      bin: {
        'ombrix-mcp': './dist/index.js',
        'ombrix-mcp-server': './dist/index.js',
      },
      keywords: [
        'mcp',
        'mcp-server',
        'mcp2',
        'code-mode',
        'model-context-protocol',
        'steganography',
        'steganalysis',
        'ai-agents',
        'claude',
        'cursor',
        'antigravity',
      ],
      files: ['dist', 'README.md', 'LICENSE'],
    },
    files: [
      { from: mcpDist, to: 'dist/index.js' },
      { from: mcpReadme, to: 'README.md' },
      { from: licenseFile, to: 'LICENSE' },
    ],
  },

  // 3. Unscoped unified 'ombrix' package (CLI + MCP in one)
  {
    targetName: 'ombrix',
    tarballOutput: 'ombrix-0.1.0.tgz',
    manifest: {
      ...commonMetadata,
      name: 'ombrix',
      description:
        'Zero-telemetry steganography & visual cryptanalysis suite. Includes CLI and MCP 2.0 Code Mode server.',
      main: './dist/bin.js',
      bin: {
        ombrix: './dist/bin.js',
        'ombrix-mcp': './dist/mcp.js',
      },
      keywords: [
        'steganography',
        'steganalysis',
        'mcp',
        'code-mode',
        'cryptography',
        'ai-agents',
        'cli',
        'security',
      ],
      files: ['dist', 'README.md', 'LICENSE'],
    },
    files: [
      { from: cliDist, to: 'dist/bin.js' },
      { from: mcpDist, to: 'dist/mcp.js' },
      { from: rootReadme, to: 'README.md' },
      { from: licenseFile, to: 'LICENSE' },
    ],
  },

  // 4. Scoped @ombrix/cli (For org publish)
  {
    targetName: '@ombrix/cli',
    tarballOutput: 'ombrix-scoped-cli-0.1.0.tgz',
    manifest: {
      ...commonMetadata,
      name: '@ombrix/cli',
      description: 'Zero-telemetry forensic steganography CLI and MCP 2.0 Code Mode runner',
      main: './dist/bin.js',
      bin: {
        ombrix: './dist/bin.js',
      },
      keywords: [
        'steganography',
        'forensics',
        'mcp',
        'code-mode',
        'security',
        'cryptography',
        'cli',
      ],
      files: ['dist', 'README.md', 'LICENSE'],
    },
    files: [
      { from: cliDist, to: 'dist/bin.js' },
      { from: cliReadme, to: 'README.md' },
      { from: licenseFile, to: 'LICENSE' },
    ],
  },

  // 5. Scoped @ombrix/mcp-server (For org publish)
  {
    targetName: '@ombrix/mcp-server',
    tarballOutput: 'ombrix-scoped-mcp-server-0.1.0.tgz',
    manifest: {
      ...commonMetadata,
      name: '@ombrix/mcp-server',
      description:
        'Model Context Protocol (MCP 2.0) server with Code Mode for OMBRIX steganography & visual forensics suite',
      main: './dist/index.js',
      bin: {
        'ombrix-mcp': './dist/index.js',
      },
      keywords: [
        'mcp',
        'mcp2',
        'code-mode',
        'model-context-protocol',
        'steganography',
        'forensics',
        'ai-agents',
      ],
      files: ['dist', 'README.md', 'LICENSE'],
    },
    files: [
      { from: mcpDist, to: 'dist/index.js' },
      { from: mcpReadme, to: 'README.md' },
      { from: licenseFile, to: 'LICENSE' },
    ],
  },
];

const results = [];

for (const pkg of packageConfigs) {
  console.log(`📦 Packaging clean standalone release: ${pkg.targetName}...`);
  const pkgDir = path.join(stagingDir, pkg.manifest.name.replace('/', '_').replace('@', ''));
  fs.mkdirSync(pkgDir, { recursive: true });

  // Write standalone package.json (no workspace:* dependencies)
  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify(pkg.manifest, null, 2));

  // Copy distribution files
  for (const f of pkg.files) {
    const dest = path.join(pkgDir, f.to);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f.from, dest);
  }

  // Pack into package's own staging directory first
  const packOutput = execFileSync('npm', ['pack'], {
    cwd: pkgDir,
    encoding: 'utf8',
  });
  const generatedTarball = packOutput.trim().split('\n').pop()?.trim();
  const generatedPath = path.join(pkgDir, generatedTarball);
  const targetPath = path.join(releasesDir, pkg.tarballOutput);

  fs.copyFileSync(generatedPath, targetPath);

  const content = fs.readFileSync(targetPath);
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  const sizeKb = (content.length / 1024).toFixed(1);
  results.push({
    name: pkg.targetName,
    tarball: pkg.tarballOutput,
    sizeKb,
    sha256,
  });
}

// Clean up staging
fs.rmSync(stagingDir, { recursive: true, force: true });

// Write CHECKSUMS.txt
const checksumFile = path.join(releasesDir, 'CHECKSUMS.txt');
const checksumLines = results.map((r) => `${r.sha256}  ${r.tarball}`).join('\n');
fs.writeFileSync(checksumFile, `${checksumLines}\n`);

console.log('\n=============================================================');
console.log('✔ Clean Standalone Release Tarballs Ready in releases/:');
console.log('=============================================================');
for (const r of results) {
  console.log(`• ${r.name.padEnd(24)} -> releases/${r.tarball} (${r.sizeKb} KB)`);
  console.log(`  SHA256: ${r.sha256}`);
}
console.log('=============================================================\n');
