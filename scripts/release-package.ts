import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ChecksumEntry {
  filename: string;
  sha256: string;
  sha512: string;
  sizeBytes: number;
}

export function getAllFiles(dir: string, baseDir = dir): string[] {
  let results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, baseDir));
    } else {
      results.push(path.relative(baseDir, fullPath));
    }
  }

  return results;
}

export function generateReleaseManifest(distDir: string): {
  entries: ChecksumEntry[];
  sha256Sums: string;
  sha512Sums: string;
} {
  if (!fs.existsSync(distDir)) {
    throw new Error(`Distribution directory not found at: ${distDir}`);
  }

  const files = getAllFiles(distDir)
    .filter((f) => !f.endsWith('SHA256SUMS') && !f.endsWith('SHA512SUMS'))
    .sort();

  const entries: ChecksumEntry[] = [];
  let sha256Sums = '';
  let sha512Sums = '';

  for (const relPath of files) {
    const fullPath = path.join(distDir, relPath);
    const content = fs.readFileSync(fullPath);

    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    const sha512 = crypto.createHash('sha512').update(content).digest('hex');
    const sizeBytes = content.length;

    entries.push({
      filename: relPath,
      sha256,
      sha512,
      sizeBytes,
    });

    sha256Sums += `${sha256}  ${relPath}\n`;
    sha512Sums += `${sha512}  ${relPath}\n`;
  }

  fs.writeFileSync(path.join(distDir, 'SHA256SUMS'), sha256Sums);
  fs.writeFileSync(path.join(distDir, 'SHA512SUMS'), sha512Sums);

  return { entries, sha256Sums, sha512Sums };
}

export function runReleasePackaging(): void {
  const distDir = path.resolve(__dirname, '../apps/web/dist');
  console.log('Generating OMBRIX Release Checksums & Packaging...');
  const { entries } = generateReleaseManifest(distDir);

  console.log(`\nVerified ${entries.length} release assets in ${distDir}:`);
  console.log('-------------------------------------------------------------------------------');
  for (const e of entries) {
    console.log(
      `${e.sha256.substring(0, 16)}...  ${(e.sizeBytes / 1024).toFixed(2).padStart(7)} KB  ${e.filename}`,
    );
  }
  console.log('-------------------------------------------------------------------------------');
  console.log('✔ Generated SHA256SUMS and SHA512SUMS successfully.');
}

if (process.argv[1] === __filename) {
  runReleasePackaging();
}
