import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const otpArg = process.argv[2];
const otp = otpArg ? otpArg.trim() : null;

if (otp) {
  console.log(`🚀 Publishing OMBRIX packages to npm with 2FA OTP: ${otp}...\n`);
} else {
  console.log('🚀 Publishing OMBRIX packages to npm using auth token in ~/.npmrc...\n');
}

const releasesDir = path.join(root, 'releases');
if (!fs.existsSync(releasesDir)) {
  console.error(
    '❌ releases/ directory not found. Please run node scripts/prepare-publish.mjs first.',
  );
  process.exit(1);
}

const tgzFiles = fs.readdirSync(releasesDir).filter((f) => f.endsWith('-0.1.4.tgz'));
if (tgzFiles.length === 0) {
  console.error(
    '❌ No -0.1.4.tgz tarballs found in releases/. Please run node scripts/prepare-publish.mjs first.',
  );
  process.exit(1);
}

for (const file of tgzFiles) {
  const filePath = path.join(releasesDir, file);
  console.log(`📦 Publishing ${file}...`);

  const args = ['-y', 'npm@10.9.2', 'publish', filePath, '--access', 'public'];
  if (otp) {
    args.push(`--otp=${otp}`);
  }

  try {
    const out = execFileSync('npx', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    console.log(`✔ Successfully published ${file}!`);
    if (out) console.log(out.trim());
  } catch (err) {
    console.error(`❌ Failed to publish ${file}:`);
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    process.exit(1);
  }
}

console.log('\n=============================================================');
console.log('🎉 ALL OMBRIX PACKAGES PUBLISHED LIVE TO NPM!');
console.log('=============================================================');
console.log('Test live installation:');
console.log('  npx ombrix-cli --help');
console.log('  npx -y ombrix-mcp-server');
console.log('=============================================================\n');
