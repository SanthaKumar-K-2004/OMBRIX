import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const input = process.argv[2];

if (!input) {
  console.log(`
Usage:
  node scripts/set-gsc-token.mjs <TOKEN_OR_TAG>
  
Example:
  node scripts/set-gsc-token.mjs "google-site-verification=abc123xyz"
  node scripts/set-gsc-token.mjs '<meta name="google-site-verification" content="abc123xyz" />'
  node scripts/set-gsc-token.mjs "abc123xyz"
`);
  process.exit(1);
}

// Extract token
let token = input.trim();
const metaMatch = token.match(/content=["']([^"']+)["']/);
if (metaMatch) {
  token = metaMatch[1];
} else if (token.includes('=')) {
  token = token.split('=')[1].trim();
}

console.log(`Setting Google Search Console Verification Token: "${token}"`);

const indexPath = path.join(root, 'apps', 'web', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// Replace token placeholder
if (html.includes('GSC_VERIFICATION_TOKEN')) {
  html = html.replace('GSC_VERIFICATION_TOKEN', token);
} else {
  // Replace existing meta verification tag
  html = html.replace(
    /<meta name="google-site-verification" content="[^"]*"\s*\/?>/,
    `<meta name="google-site-verification" content="${token}" />`,
  );
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log('✓ Successfully updated apps/web/index.html with verification meta tag.');

// Build and deploy to production
console.log('Running build and deploying to Vercel production...');
try {
  execSync('pnpm run build', { cwd: root, stdio: 'inherit' });
  execSync(
    'git add apps/web/index.html && git commit -m "feat(seo): configure Google Search Console verification token" && git push origin main',
    { cwd: root, stdio: 'inherit' },
  );
  execSync('npx vercel --prod', { cwd: root, stdio: 'inherit' });
  console.log(
    '\n✓ Deployment complete! Your Google Search Console token is now live on https://ombrix-stego.vercel.app',
  );
} catch (err) {
  console.error('Error during build or deployment:', err.message);
  process.exit(1);
}
