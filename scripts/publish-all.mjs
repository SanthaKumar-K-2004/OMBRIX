import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const otpArg = process.argv[2];

if (!otpArg) {
  console.error('❌ Please provide your 6-digit 2FA OTP code: node scripts/publish-all.mjs <6-digit-otp>');
  process.exit(1);
}

const otp = otpArg.trim();
console.log(`🚀 Publishing OMBRIX packages to npm using OTP: ${otp}...\n`);

const packages = [
  { name: 'ombrix-cli', file: 'releases/ombrix-cli-0.1.0.tgz' },
  { name: 'ombrix-mcp-server', file: 'releases/ombrix-mcp-server-0.1.0.tgz' },
  { name: 'ombrix', file: 'releases/ombrix-0.1.0.tgz' },
];

for (const pkg of packages) {
  const filePath = path.join(root, pkg.file);
  console.log(`📦 Publishing ${pkg.name} (${pkg.file})...`);

  try {
    const out = execFileSync(
      'npx',
      ['-y', 'npm@10.9.2', 'publish', filePath, '--access', 'public', `--otp=${otp}`],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['inherit', 'pipe', 'pipe'],
      },
    );
    console.log(`✔ Successfully published ${pkg.name}!`);
    if (out) console.log(out.trim());
  } catch (err) {
    console.error(`❌ Failed to publish ${pkg.name}:`);
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
