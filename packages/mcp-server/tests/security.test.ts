import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { executeCodeMode } from '../src/code-mode.js';
import { encodePng } from '../src/png.js';
import {
  SecurityError,
  isPrivateOrLoopbackIp,
  safeFetchUrl,
  validatePathConfinement,
} from '../src/security.js';
import { handleJsonRpc } from '../src/server.js';

interface ToolCallResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

function getText(result: ToolCallResult): string {
  const item = result.content[0];
  if (!item) throw new Error('Missing content in tool result');
  return item.text;
}

describe('OMBRIX MCP Security Hardening Suite', () => {
  let tmpDir: string;
  let testPngPath: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ombrix-sec-test-'));

    // Create a 64x64 valid PNG carrier
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 120;
      data[i + 1] = 150;
      data[i + 2] = 180;
      data[i + 3] = 255;
    }
    const pngBytes = encodePng({ width, height, data });
    testPngPath = path.join(tmpDir, 'valid-carrier.png');
    fs.writeFileSync(testPngPath, pngBytes);
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('Path Confinement & Traversal Guards', () => {
    it('blocks directory traversal outside root (/etc/passwd)', () => {
      expect(() => {
        validatePathConfinement('../../../../../etc/passwd', { paramName: 'carrierPath' });
      }).toThrowError();
    });

    it('blocks access to hidden system/configuration files (.env, .bashrc)', () => {
      const hiddenFile = path.join(tmpDir, '.env');
      fs.writeFileSync(hiddenFile, 'SECRET_KEY=12345');

      expect(() => {
        validatePathConfinement(hiddenFile, { paramName: 'passkeyFile' });
      }).toThrow(SecurityError);
    });

    it('blocks arbitrary file write outside permitted directories', () => {
      expect(() => {
        validatePathConfinement('/etc/cron.d/malicious.png', {
          forWrite: true,
          paramName: 'outputPath',
        });
      }).toThrow(SecurityError);
    });

    it('blocks writing with forbidden file extensions (.sh, .exe, .js)', () => {
      const targetOut = path.join(tmpDir, 'exploit.sh');
      expect(() => {
        validatePathConfinement(targetOut, { forWrite: true, paramName: 'outputPath' });
      }).toThrow(SecurityError);
    });

    it('refuses to overwrite existing files when overwrite is false', () => {
      const existingOut = path.join(tmpDir, 'already-exists.png');
      fs.writeFileSync(existingOut, new Uint8Array([1, 2, 3]));

      expect(() => {
        validatePathConfinement(existingOut, {
          forWrite: true,
          overwrite: false,
          paramName: 'outputPath',
        });
      }).toThrow(SecurityError);
    });

    it('allows overwriting existing file when overwrite is true', () => {
      const existingOut = path.join(tmpDir, 'allow-overwrite.png');
      fs.writeFileSync(existingOut, new Uint8Array([1, 2, 3]));

      const resolved = validatePathConfinement(existingOut, {
        forWrite: true,
        overwrite: true,
        paramName: 'outputPath',
      });
      expect(resolved).toBe(existingOut);
    });

    it('returns E_FILE_EXISTS via JSON-RPC when tool attempts unauthorized overwrite', async () => {
      const existingOut = path.join(tmpDir, 'rpc-overwrite.png');
      fs.writeFileSync(existingOut, new Uint8Array([1, 2, 3]));

      const res = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 101,
        method: 'tools/call',
        params: {
          name: 'stego_embed',
          arguments: {
            carrierPath: testPngPath,
            payload: 'OVERWRITE_TEST',
            outputPath: existingOut,
            overwrite: false,
          },
        },
      });

      const result = res?.result as unknown as ToolCallResult;
      expect(result.isError).toBe(true);
      const err = JSON.parse(getText(result));
      expect(err.ok).toBe(false);
      expect(err.error.code).toBe('E_FILE_EXISTS');
      expect(err.error.hint).toContain('overwrite');
    });
  });

  describe('Anti-SSRF & Network Fetch Protection', () => {
    it('classifies private, loopback, and cloud metadata IPs accurately', () => {
      expect(isPrivateOrLoopbackIp('127.0.0.1')).toBe(true);
      expect(isPrivateOrLoopbackIp('127.0.0.5')).toBe(true);
      expect(isPrivateOrLoopbackIp('10.0.1.20')).toBe(true);
      expect(isPrivateOrLoopbackIp('172.16.0.1')).toBe(true);
      expect(isPrivateOrLoopbackIp('192.168.1.1')).toBe(true);
      expect(isPrivateOrLoopbackIp('169.254.169.254')).toBe(true); // AWS / GCP / Azure metadata
      expect(isPrivateOrLoopbackIp('::1')).toBe(true);
      expect(isPrivateOrLoopbackIp('fe80::1')).toBe(true);

      expect(isPrivateOrLoopbackIp('8.8.8.8')).toBe(false);
      expect(isPrivateOrLoopbackIp('1.1.1.1')).toBe(false);
    });

    it('rejects forbidden URL schemes (file://, ftp://, gopher://)', async () => {
      await expect(safeFetchUrl('file:///etc/passwd')).rejects.toThrow(SecurityError);
      await expect(safeFetchUrl('gopher://127.0.0.1:70')).rejects.toThrow(SecurityError);
    });

    it('blocks loopback and cloud metadata requests via safeFetchUrl', async () => {
      await expect(safeFetchUrl('http://127.0.0.1:8080/secret.png')).rejects.toThrow(SecurityError);
      await expect(safeFetchUrl('http://169.254.169.254/computeMetadata/v1/')).rejects.toThrow(
        SecurityError,
      );
      await expect(safeFetchUrl('http://localhost:3000/carrier.png')).rejects.toThrow(
        SecurityError,
      );
    });

    it('returns E_SSRF_BLOCKED via JSON-RPC on cloud metadata attempt', async () => {
      const res = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 102,
        method: 'tools/call',
        params: {
          name: 'stego_embed',
          arguments: {
            carrierUrl: 'http://169.254.169.254/latest/meta-data/',
            payload: 'SSRF_TEST',
          },
        },
      });

      const result = res?.result as unknown as ToolCallResult;
      expect(result.isError).toBe(true);
      const err = JSON.parse(getText(result));
      expect(err.ok).toBe(false);
      expect(err.error.code).toBe('E_SSRF_BLOCKED');
    });
  });

  describe('Code Mode Sandboxing & Hard Async Loop Termination', () => {
    it('executes safe sandboxed code and returns results', async () => {
      const code = `
        const carrier = ombrix.createCarrier(32, 32);
        const capacity = ombrix.inspect(carrier);
        return { width: carrier.width, height: carrier.height, capacity };
      `;
      const res = await executeCodeMode(code, 5000);
      expect(res.status).toBe('success');
      const data = res.result as { width: number; height: number };
      expect(data.width).toBe(32);
      expect(data.height).toBe(32);
    });

    it('terminates async infinite loops within timeout (Flaw #6)', async () => {
      const infiniteAsyncLoop = `
        while (true) {
          await null;
        }
      `;
      const start = Date.now();
      const res = await executeCodeMode(infiniteAsyncLoop, 1000);
      const elapsed = Date.now() - start;

      expect(res.status).toBe('error');
      expect(res.error).toContain('timed out');
      expect(elapsed).toBeLessThan(3000);
    });

    it('prevents sandbox escape to host process or require', async () => {
      const escapeAttempt = `
        try {
          return process.env;
        } catch (e) {
          return 'CAUGHT_' + e.message;
        }
      `;
      const res = await executeCodeMode(escapeAttempt, 2000);
      expect(res.status).toBe('success');
      expect(String(res.result)).toContain('CAUGHT_');
    });
  });
});
