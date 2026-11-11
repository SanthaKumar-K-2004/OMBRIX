import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encodePng } from '../src/png.js';
import { handleJsonRpc } from '../src/server.js';

interface ToolCallResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

function getText(result: ToolCallResult): string {
  return result.content[0]?.text ?? '';
}

function createSyntheticPng(width = 128, height = 128): Uint8Array {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = (x * 3) % 256; // R
      data[idx + 1] = (y * 5) % 256; // G
      data[idx + 2] = ((x + y) * 7) % 256; // B
      data[idx + 3] = 255; // Alpha full
    }
  }

  return encodePng({ width, height, data });
}

describe('OMBRIX Production Hardening Matrix Test Suite', () => {
  let tmpDir: string;
  let testPngPath: string;
  let testPngBase64: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ombrix-matrix-'));
    const pngBytes = createSyntheticPng(512, 512);
    testPngPath = path.join(tmpDir, 'carrier-512.png');
    fs.writeFileSync(testPngPath, pngBytes);
    testPngBase64 = `data:image/png;base64,${Buffer.from(pngBytes).toString('base64')}`;
  });

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  const algorithms = ['hyper-matrix', 'matching', 'pvd', 'dwt', 'robust-resilient', 'lsb'] as const;

  for (const algo of algorithms) {
    describe(`Algorithm: ${algo}`, () => {
      it('roundtrips plaintext in explicit mode and auto mode', async () => {
        const payloadText = `MATRIX_TEST_${algo.toUpperCase()}_PLAINTEXT`;
        const stegoOut = path.join(tmpDir, `stego-${algo}-plain.png`);

        // 1. Embed with self-verification
        const embedRes = await handleJsonRpc({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'stego_embed',
            arguments: {
              carrierPath: testPngPath,
              payload: payloadText,
              method: algo,
              outputPath: stegoOut,
            },
          },
        });

        const embedResult = embedRes?.result as unknown as ToolCallResult;
        expect(embedResult.isError).toBeFalsy();
        const embedData = JSON.parse(getText(embedResult));
        expect(embedData.ok).toBe(true);
        expect(embedData.verified).toBe(true);
        expect(embedData.outputBase64).toBeDefined();
        expect(fs.existsSync(stegoOut)).toBe(true);

        // 2. Extract with explicit method
        const extractExplicitRes = await handleJsonRpc({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'stego_extract',
            arguments: {
              stegoPath: stegoOut,
              method: algo,
            },
          },
        });
        const explicitResult = extractExplicitRes?.result as unknown as ToolCallResult;
        expect(explicitResult.isError).toBeFalsy();
        const explicitData = JSON.parse(getText(explicitResult));
        expect(explicitData.status).toBe('success');
        expect(explicitData.previewText).toBe(payloadText);
        expect(explicitData.payload.untrusted).toBe(true);

        // 3. Extract with auto method (verifies sequential fallback bug fix)
        const extractAutoRes = await handleJsonRpc({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'stego_extract',
            arguments: {
              stegoPath: stegoOut,
              method: 'auto',
            },
          },
        });
        const autoResult = extractAutoRes?.result as unknown as ToolCallResult;
        expect(autoResult.isError).toBeFalsy();
        const autoData = JSON.parse(getText(autoResult));
        expect(autoData.status).toBe('success');
        expect(autoData.previewText).toBe(payloadText);
      });

      it('roundtrips passkey-encrypted secret with prompt-injection defense', async () => {
        const secretMessage = `CONFIDENTIAL_${algo.toUpperCase()}_48.8584_2.2945`;
        const passkey = 'solitary-matrix-cryptic-cipher';
        const stegoOut = path.join(tmpDir, `stego-${algo}-enc.png`);

        // 1. Embed with passkey
        const embedRes = await handleJsonRpc({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'stego_embed',
            arguments: {
              carrierPath: testPngPath,
              payload: secretMessage,
              passkey,
              method: algo,
              outputPath: stegoOut,
            },
          },
        });
        const embedResult = embedRes?.result as unknown as ToolCallResult;
        expect(embedResult.isError).toBeFalsy();
        const embedData = JSON.parse(getText(embedResult));
        expect(embedData.encryptedWithPasskey).toBe(true);
        expect(embedData.verified).toBe(true);

        // 2. Extract without passkey -> returns status: locked
        const lockedRes = await handleJsonRpc({
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: {
            name: 'stego_extract',
            arguments: {
              stegoPath: stegoOut,
              method: algo,
            },
          },
        });
        const lockedResult = lockedRes?.result as unknown as ToolCallResult;
        const lockedData = JSON.parse(getText(lockedResult));
        expect(lockedData.status).toBe('locked');
        expect(lockedData.isPasskeyEncrypted).toBe(true);

        // 3. Extract with wrong passkey -> fails cleanly
        const wrongKeyRes = await handleJsonRpc({
          jsonrpc: '2.0',
          id: 6,
          method: 'tools/call',
          params: {
            name: 'stego_extract',
            arguments: {
              stegoPath: stegoOut,
              passkey: 'wrong-passkey-here',
              method: algo,
            },
          },
        });
        const wrongResult = wrongKeyRes?.result as unknown as ToolCallResult;
        expect(wrongResult.isError).toBe(true);

        // 4. Extract with correct passkey using auto detection
        const unlockRes = await handleJsonRpc({
          jsonrpc: '2.0',
          id: 7,
          method: 'tools/call',
          params: {
            name: 'stego_extract',
            arguments: {
              stegoPath: stegoOut,
              passkey,
              method: 'auto',
            },
          },
        });
        const unlockResult = unlockRes?.result as unknown as ToolCallResult;
        expect(unlockResult.isError).toBeFalsy();
        const unlockData = JSON.parse(getText(unlockResult));
        expect(unlockData.status).toBe('success');
        expect(unlockData.previewText).toBe(secretMessage);
        expect(unlockData.payload.untrusted).toBe(true);
      });
    });
  }

  describe('Base64 Input/Output & Simplified Tools', () => {
    it('supports end-to-end base64 hide and reveal without filesystem paths', async () => {
      const secret = 'AIR_GAPPED_CLOUD_ASSISTANT_SECRET_TOKEN';

      // stego_hide with base64 input
      const hideRes = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'stego_hide',
          arguments: {
            carrierBase64: testPngBase64,
            message: secret,
            passkey: 'cyber-vault-key-2026',
          },
        },
      });

      const hideResult = hideRes?.result as unknown as ToolCallResult;
      expect(hideResult.isError).toBeFalsy();
      const hideData = JSON.parse(getText(hideResult));
      expect(hideData.verified).toBe(true);
      expect(hideData.outputBase64).toMatch(/^data:image\/png;base64,/);

      // stego_reveal using the output base64
      const revealRes = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'stego_reveal',
          arguments: {
            stegoBase64: hideData.outputBase64,
            passkey: 'cyber-vault-key-2026',
          },
        },
      });

      const revealResult = revealRes?.result as unknown as ToolCallResult;
      expect(revealResult.isError).toBeFalsy();
      const revealData = JSON.parse(getText(revealResult));
      expect(revealData.status).toBe('success');
      expect(revealData.previewText).toBe(secret);
      expect(revealData.payload.untrusted).toBe(true);
    });

    it('stego_plan recommends appropriate methods and warns on WhatsApp Photo', async () => {
      const planRes = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'stego_plan',
          arguments: {
            channel: 'whatsapp-photo',
            payloadLengthBytes: 30,
            withPasskey: true,
          },
        },
      });

      const planResult = planRes?.result as unknown as ToolCallResult;
      const planData = JSON.parse(getText(planResult));
      expect(planData.recommendedMethod).toBe('robust-resilient');
      expect(planData.warning).toContain('WhatsApp Photo compression');
    });

    it('benchmarks all 6 steganography algorithms in a single call', async () => {
      const benchRes = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/call',
        params: {
          name: 'stego_benchmark',
          arguments: {
            carrierPath: testPngPath,
            payload: 'Benchmarking all 6 OMBRIX methods',
          },
        },
      });

      const benchResult = benchRes?.result as unknown as ToolCallResult;
      const benchData = JSON.parse(getText(benchResult));
      expect(benchData.status).toBe('success');
      expect(benchData.benchmarkResults.length).toBe(6);
      const algoIds = benchData.benchmarkResults.map((r: { id: string }) => r.id);
      expect(algoIds).toEqual([
        'hyper-matrix',
        'matching',
        'pvd',
        'dwt',
        'robust-resilient',
        'lsb',
      ]);
    });
  });
});
