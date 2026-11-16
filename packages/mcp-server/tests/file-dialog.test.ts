import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  findLatestCarrierImage,
  hasGuiEnvironment,
  resolveFuzzyCarrierPath,
} from '../src/file-dialog.js';
import { encodePng } from '../src/png.js';

describe('file-dialog & smart carrier resolution', () => {
  let tmpDir: string;
  let olderPng: string;
  let newerPng: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ombrix-file-dialog-test-'));

    const dummyPng = encodePng({
      width: 16,
      height: 16,
      data: new Uint8ClampedArray(16 * 16 * 4).fill(128),
    });

    olderPng = path.join(tmpDir, 'photo-older.png');
    newerPng = path.join(tmpDir, 'photo-newer.png');

    fs.writeFileSync(olderPng, dummyPng);
    // Set older mtime
    const oldTime = new Date(Date.now() - 60000);
    fs.utimesSync(olderPng, oldTime, oldTime);

    fs.writeFileSync(newerPng, dummyPng);
    const newTime = new Date();
    fs.utimesSync(newerPng, newTime, newTime);
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('detects GUI environment boolean safely', () => {
    const gui = hasGuiEnvironment();
    expect(typeof gui).toBe('boolean');
  });

  it('finds latest carrier image by mtime', () => {
    const latest = findLatestCarrierImage({ searchDirs: [tmpDir] });
    expect(latest).toBe(newerPng);
  });

  it('resolves exact path in resolveFuzzyCarrierPath', () => {
    const resolved = resolveFuzzyCarrierPath(newerPng);
    expect(resolved).toBe(path.resolve(newerPng));
  });

  it('resolves Claude /mnt/data/... virtual path to local file if present in cwd or standard dirs', () => {
    // Create a file in process.cwd() temporarily
    const cwdFile = path.join(process.cwd(), 'temp-claude-fuzzy-test.png');
    const dummy = encodePng({
      width: 8,
      height: 8,
      data: new Uint8ClampedArray(8 * 8 * 4),
    });
    fs.writeFileSync(cwdFile, dummy);

    try {
      const virtualPath = '/mnt/data/temp-claude-fuzzy-test.png';
      const resolved = resolveFuzzyCarrierPath(virtualPath);
      expect(resolved).toBe(cwdFile);
    } finally {
      try {
        fs.unlinkSync(cwdFile);
      } catch {
        // ignore
      }
    }
  });

  it('returns null for nonexistent path', () => {
    const resolved = resolveFuzzyCarrierPath('/nonexistent/directory/fake-image.png');
    expect(resolved).toBeNull();
  });
});
