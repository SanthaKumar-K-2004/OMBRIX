import fs from 'node:fs';
import path from 'node:path';

/**
 * Ensures build output `dist` is mirrored across both repository root and `apps/web`,
 * guaranteeing that Vercel, Netlify, Cloudflare Pages, or Docker static file servers
 * find the output directory regardless of whether Root Directory is configured as
 * `./` or `apps/web`.
 */
function ensureDist() {
  const cwd = process.cwd();

  // Find where the built assets actually are
  const candidateSources = [
    path.resolve(cwd, 'apps/web/dist'),
    path.resolve(cwd, 'dist'),
    path.resolve(cwd, '../web/dist'),
    path.resolve(cwd, '../../apps/web/dist'),
  ];

  const sourceDist = candidateSources.find(
    (dir) => fs.existsSync(dir) && fs.existsSync(path.join(dir, 'index.html')),
  );

  if (!sourceDist) {
    console.warn('[ensure-dist] Warning: No built dist/index.html found to mirror.');
    return;
  }

  // Target locations to mirror to
  const targets = [
    path.resolve(cwd, 'dist'),
    path.resolve(cwd, 'apps/web/dist'),
    path.resolve(cwd, 'apps/web/apps/web/dist'),
  ];

  // If cwd is apps/web, also mirror up to root
  if (cwd.endsWith('apps/web')) {
    targets.push(path.resolve(cwd, '../../dist'));
  }

  for (const target of targets) {
    if (path.resolve(target) === path.resolve(sourceDist)) continue;
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.cpSync(sourceDist, target, { recursive: true });
      console.log(`[ensure-dist] Mirrored build output to: ${target}`);
    } catch (err) {
      console.warn(`[ensure-dist] Non-fatal mirror warning for ${target}:`, err);
    }
  }
}

ensureDist();
