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

function createSyntheticPng(width = 64, height = 64): Uint8Array {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (i * 3) % 256;
    data[i + 1] = (i * 7) % 256;
    data[i + 2] = (i * 11) % 256;
    data[i + 3] = 255;
  }
  return encodePng({ width, height, data });
}

describe('OMBRIX Structured Errors & Secret Handling Suite', () => {
  let tmpDir: string;
  let testPngPath: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ombrix-errors-'));
    const png = createSyntheticPng(64, 64);
    testPngPath = path.join(tmpDir, 'cover.png');
    fs.writeFileSync(testPngPath, png);
  });

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('Secret Privacy: passkeyEnv and passkeyFile', () => {
    it('embeds and extracts using passkeyEnv without exposing passkey in tool args', async () => {
      const secretEnvVar = 'OMBRIX_TEST_SECRET_ENV_KEY';
      process.env[secretEnvVar] = 'aurora-crypto-sovereign-vault';

      const stegoOut = path.join(tmpDir, 'stego-env.png');
      const payload = 'SECRET_DATA_PROTECTED_BY_ENV';

      // 1. Embed using passkeyEnv
      const embedRes = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'stego_embed',
          arguments: {
            carrierPath: testPngPath,
            payload,
            passkeyEnv: secretEnvVar,
            method: 'hyper-matrix',
            outputPath: stegoOut,
          },
        },
      });

      const embedResult = embedRes?.result as unknown as ToolCallResult;
      expect(embedResult.isError).toBeFalsy();
      const embedData = JSON.parse(getText(embedResult));
      expect(embedData.encryptedWithPasskey).toBe(true);
      expect(embedData.verified).toBe(true);

      // 2. Extract using passkeyEnv
      const extractRes = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'stego_extract',
          arguments: {
            stegoPath: stegoOut,
            passkeyEnv: secretEnvVar,
            method: 'hyper-matrix',
          },
        },
      });

      const extractResult = extractRes?.result as unknown as ToolCallResult;
      expect(extractResult.isError).toBeFalsy();
      const extractData = JSON.parse(getText(extractResult));
      expect(extractData.status).toBe('success');
      expect(extractData.previewText).toBe(payload);

      delete process.env[secretEnvVar];
    });

    it('embeds and extracts using passkeyFile', async () => {
      const keyFilePath = path.join(tmpDir, 'secret-passphrase.txt');
      fs.writeFileSync(keyFilePath, 'fortress-matrix-cipher-key-2026\n');

      const stegoOut = path.join(tmpDir, 'stego-file.png');
      const payload = 'SECRET_DATA_PROTECTED_BY_FILE';

      // 1. Embed using passkeyFile
      const embedRes = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'stego_hide',
          arguments: {
            carrierPath: testPngPath,
            message: payload,
            passkeyFile: keyFilePath,
            outputPath: stegoOut,
          },
        },
      });

      const embedResult = embedRes?.result as unknown as ToolCallResult;
      expect(embedResult.isError).toBeFalsy();
      const embedData = JSON.parse(getText(embedResult));
      expect(embedData.verified).toBe(true);

      // 2. Extract using passkeyFile
      const extractRes = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'stego_reveal',
          arguments: {
            stegoPath: stegoOut,
            passkeyFile: keyFilePath,
          },
        },
      });

      const extractResult = extractRes?.result as unknown as ToolCallResult;
      expect(extractResult.isError).toBeFalsy();
      const extractData = JSON.parse(getText(extractResult));
      expect(extractData.status).toBe('success');
      expect(extractData.previewText).toBe(payload);
    });

    it('returns structured error when passkeyEnv is not set', async () => {
      const res = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'stego_embed',
          arguments: {
            carrierPath: testPngPath,
            payload: 'Hello',
            passkeyEnv: 'NON_EXISTENT_ENV_VAR_123',
          },
        },
      });

      const result = res?.result as unknown as ToolCallResult;
      expect(result.isError).toBe(true);
      const err = JSON.parse(getText(result));
      expect(err.ok).toBe(false);
      expect(err.error.code).toBe('E_PASSKEY_ENV_NOT_FOUND');
      expect(err.error.hint).toContain('Set the environment variable');
    });
  });

  describe('Structured Error Formatting', () => {
    it('returns structured error for missing carrier file', async () => {
      const res = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'stego_embed',
          arguments: {
            carrierPath: '/path/does/not/exist/missing.png',
            payload: 'test',
          },
        },
      });

      const result = res?.result as unknown as ToolCallResult;
      expect(result.isError).toBe(true);
      const err = JSON.parse(getText(result));
      expect(err.ok).toBe(false);
      expect(err.error.code).toBe('E_CARRIER_NOT_FOUND');
      expect(err.error.hint).toContain('Use base64 or verify path');
    });

    it('returns structured error when a JPEG file is passed', async () => {
      const jpegPath = path.join(tmpDir, 'fake.jpg');
      // Write JPEG magic header [0xFF, 0xD8, 0xFF, 0xE0]
      fs.writeFileSync(jpegPath, new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]));

      const res = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'stego_inspect',
          arguments: {
            imagePath: jpegPath,
          },
        },
      });

      const result = res?.result as unknown as ToolCallResult;
      expect(result.isError).toBe(true);
      const err = JSON.parse(getText(result));
      expect(err.ok).toBe(false);
      expect(err.error.code).toBe('E_UNSUPPORTED_FORMAT');
      expect(err.error.message).toContain('JPEG image detected');
      expect(err.error.hint).toContain('convert to PNG');
    });

    it('returns deniable E_AUTH_FAILED error on incorrect passkey', async () => {
      const stegoOut = path.join(tmpDir, 'stego-auth.png');
      const passkey = 'correct-crypto-passkey-1234';

      // Embed
      await handleJsonRpc({
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'stego_embed',
          arguments: {
            carrierPath: testPngPath,
            payload: 'SECRET',
            passkey,
            outputPath: stegoOut,
          },
        },
      });

      // Extract with wrong passkey
      const wrongRes = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'stego_extract',
          arguments: {
            stegoPath: stegoOut,
            passkey: 'wrong-passkey',
          },
        },
      });

      const result = wrongRes?.result as unknown as ToolCallResult;
      expect(result.isError).toBe(true);
      const err = JSON.parse(getText(result));
      expect(err.ok).toBe(false);
      expect(err.error.code).toBe('E_AUTH_FAILED');
      expect(err.error.message).toContain(
        'Authentication failed or no valid stego payload present',
      );
    });
  });
});
