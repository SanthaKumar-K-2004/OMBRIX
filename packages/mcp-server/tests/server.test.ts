import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encodePng } from '../src/png.js';
import { handleJsonRpc } from '../src/server.js';
import { MCP_TOOLS } from '../src/tools.js';

describe('OMBRIX MCP Server', () => {
  let tmpDir: string;
  let testPngPath: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ombrix-mcp-test-'));

    // Create a 64x64 solid/textured test PNG
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = (i * 7) % 256; // R
      data[i + 1] = (i * 13) % 256; // G
      data[i + 2] = (i * 29) % 256; // B
      data[i + 3] = 255; // A
    }

    const pngBytes = encodePng({ width, height, data });
    testPngPath = path.join(tmpDir, 'test-cover.png');
    fs.writeFileSync(testPngPath, pngBytes);
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_e) {
      // ignore
    }
  });

  it('handles initialize handshake', async () => {
    const res = await handleJsonRpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
    });

    expect(res).not.toBeNull();
    expect(res?.result).toBeDefined();
    expect(res?.result.serverInfo.name).toBe('ombrix-mcp');
    expect(res?.result.capabilities.tools).toBeDefined();
  });

  it('returns complete tool catalog in tools/list', async () => {
    const res = await handleJsonRpc({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    });

    expect(res?.result.tools).toHaveLength(8);
    const toolNames = res?.result.tools.map((t: { name: string }) => t.name);
    expect(toolNames).toContain('stego_embed');
    expect(toolNames).toContain('stego_extract');
    expect(toolNames).toContain('stego_scan');
    expect(toolNames).toContain('stego_benchmark');
    expect(toolNames).toContain('stego_keygen');
    expect(toolNames).toContain('stego_inspect');
    expect(toolNames).toContain('stego_code_mode');
    expect(toolNames).toContain('stego_api_docs');
  });

  it('generates cryptographic keys via stego_keygen', async () => {
    // Diceware test
    const resDiceware = await handleJsonRpc({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'stego_keygen',
        arguments: { type: 'diceware' },
      },
    });

    const parsedDiceware = JSON.parse(resDiceware?.result.content[0].text);
    expect(parsedDiceware.type).toBe('diceware');
    expect(parsedDiceware.passphrase.split('-')).toHaveLength(4);

    // Crypto32 test
    const resCrypto = await handleJsonRpc({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'stego_keygen',
        arguments: { type: 'crypto32' },
      },
    });

    const parsedCrypto = JSON.parse(resCrypto?.result.content[0].text);
    expect(parsedCrypto.type).toBe('crypto32');
    expect(parsedCrypto.rawHex).toHaveLength(64);
    expect(parsedCrypto.passkey.length).toBeGreaterThanOrEqual(64);
  });

  it('inspects image capacity via stego_inspect', async () => {
    const res = await handleJsonRpc({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'stego_inspect',
        arguments: { imagePath: testPngPath },
      },
    });

    const parsed = JSON.parse(res?.result.content[0].text);
    expect(parsed.image.width).toBe(64);
    expect(parsed.image.height).toBe(64);
    expect(parsed.usableCapacity.sequentialLsbBytes).toBeGreaterThan(0);
  });

  it('embeds and extracts passkey-encrypted secret via stego_embed and stego_extract', async () => {
    const stegoOut = path.join(tmpDir, 'stego-out.png');
    const secretMessage = 'TOP_SECRET_COORDINATES_48.8584_2.2945';
    const testPasskey = 'velvet-matrix-falcon-orbit';

    // 1. Embed
    const embedRes = await handleJsonRpc({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'stego_embed',
        arguments: {
          carrierPath: testPngPath,
          payload: secretMessage,
          passkey: testPasskey,
          method: 'hyper-matrix',
          outputPath: stegoOut,
        },
      },
    });

    const embedParsed = JSON.parse(embedRes?.result.content[0].text);
    expect(embedParsed.status).toBe('success');
    expect(embedParsed.encryptedWithPasskey).toBe(true);
    expect(fs.existsSync(stegoOut)).toBe(true);

    // 2. Extract without passkey -> reports locked
    const lockedRes = await handleJsonRpc({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'stego_extract',
        arguments: {
          stegoPath: stegoOut,
          method: 'hyper-matrix',
        },
      },
    });

    const lockedParsed = JSON.parse(lockedRes?.result.content[0].text);
    expect(lockedParsed.status).toBe('locked');
    expect(lockedParsed.isPasskeyEncrypted).toBe(true);

    // 3. Extract with correct passkey -> succeeds
    const unlockRes = await handleJsonRpc({
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: {
        name: 'stego_extract',
        arguments: {
          stegoPath: stegoOut,
          passkey: testPasskey,
          method: 'hyper-matrix',
        },
      },
    });

    const unlockParsed = JSON.parse(unlockRes?.result.content[0].text);
    expect(unlockParsed.status).toBe('success');
    expect(unlockParsed.previewText).toBe(secretMessage);
  });

  it('scans candidate image for stego anomalies via stego_scan', async () => {
    const res = await handleJsonRpc({
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: {
        name: 'stego_scan',
        arguments: { imagePath: testPngPath },
      },
    });

    const parsed = JSON.parse(res?.result.content[0].text);
    expect(parsed.status).toBe('success');
    expect(parsed.verdict).toBeDefined();
    expect(parsed.detectors.rsSteganalysis).toBeDefined();
    expect(parsed.detectors.samplePairAnalysis).toBeDefined();
    expect(parsed.detectors.chiSquarePoVs).toBeDefined();
    expect(parsed.detectors.laplacianResidual).toBeDefined();
  });
});
