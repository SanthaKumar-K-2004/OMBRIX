import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

console.log('🚀 Preparing OMBRIX CLI & MCP Server for publication...');

// 1. Build binaries
execFileSync('node', [path.join(root, 'scripts/build-tools.mjs')], { stdio: 'inherit' });

// 2. Prepare releases folder
const releasesDir = path.join(root, 'releases');
fs.mkdirSync(releasesDir, { recursive: true });

// 3. Pack packages
const packages = [
  { name: '@ombrix/cli', dir: path.join(root, 'packages/cli') },
  { name: '@ombrix/mcp-server', dir: path.join(root, 'packages/mcp-server') },
];

const tarballs = [];

for (const pkg of packages) {
  console.log(`\n📦 Packaging ${pkg.name}...`);
  const packOutput = execFileSync('npm', ['pack', '--pack-destination', releasesDir], {
    cwd: pkg.dir,
    encoding: 'utf8',
  });
  const tarballName = packOutput.trim().split('\n').pop()?.trim();
  if (tarballName) {
    const tarballPath = path.join(releasesDir, tarballName);
    const content = fs.readFileSync(tarballPath);
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    const sizeKb = (content.length / 1024).toFixed(1);
    tarballs.push({ name: pkg.name, file: tarballName, sizeKb, sha256 });
  }
}

console.log('\n=============================================================');
console.log('✔ Publication Tarballs Generated:');
console.log('=============================================================');
for (const t of tarballs) {
  console.log(`• ${t.name} -> releases/${t.file} (${t.sizeKb} KB)`);
  console.log(`  SHA256: ${t.sha256}`);
}
console.log('\nTo publish to the npm registry:');
console.log('  1. Login with: npm login');
console.log('  2. Publish with: npm publish releases/<tarball> --access public');
console.log('=============================================================\n');
