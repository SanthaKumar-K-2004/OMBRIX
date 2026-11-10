import fs from 'node:fs';
import path from 'node:path';

/**
 * Finds the monorepo root by locating pnpm-workspace.yaml.
 */
function findMonorepoRoot(startDir = process.cwd()) {
  let curr = path.resolve(startDir);
  while (curr !== path.dirname(curr)) {
    if (fs.existsSync(path.join(curr, 'pnpm-workspace.yaml'))) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return path.resolve(startDir);
}

/**
 * Ensures build output from `apps/web/dist` is mirrored to repository root `dist`,
 * guaranteeing that static deployments find the latest build output.
 */
function ensureDist() {
  const root = findMonorepoRoot();
  const sourceDist = path.join(root, 'apps', 'web', 'dist');

  // Purge any accidental nested dirs
  const staleNested = path.join(root, 'apps', 'web', 'apps');
  if (fs.existsSync(staleNested)) {
    try {
      fs.rmSync(staleNested, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  if (!fs.existsSync(sourceDist) || !fs.existsSync(path.join(sourceDist, 'index.html'))) {
    console.warn('[ensure-dist] Warning: No built apps/web/dist/index.html found to mirror.');
    return;
  }

  // Mirror to root dist
  const rootDist = path.join(root, 'dist');
  try {
    fs.mkdirSync(rootDist, { recursive: true });
    fs.cpSync(sourceDist, rootDist, { recursive: true });
    console.log(`[ensure-dist] Successfully mirrored fresh build to: ${rootDist}`);
  } catch (err) {
    console.warn(`[ensure-dist] Non-fatal mirror warning for ${rootDist}:`, err);
  }
}

ensureDist();
