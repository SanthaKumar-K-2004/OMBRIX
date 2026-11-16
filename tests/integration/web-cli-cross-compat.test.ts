import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCli } from '../../packages/cli/src/cli.js';
import { decodePng, encodePng } from '../../packages/cli/src/png-codec.js';
import {
  decryptWithPasskey,
  encryptWithPasskey,
  initCrypto,
} from '../../packages/crypto-adapter/src/index.js';
import { handleJsonRpc } from '../../packages/mcp-server/src/server.js';
import { hyperMatrixMethod } from '../../packages/stego-advanced/src/hyperMatrix.js';
import { robustResilientStego } from '../../packages/stego-advanced/src/robustResilient.js';

interface ToolCallResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

function getText(result: ToolCallResult): string {
  const item = result.content[0];
  if (!item) throw new Error('Missing content in tool result');
  return item.text;
}

function createCarrier(width = 128, height = 128) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (i * 7) % 256;
    data[i + 1] = (i * 13) % 256;
    data[i + 2] = (i * 29) % 256;
    data[i + 3] = 255;
  }
  return { width, height, data };
}

describe('Web App vs CLI vs MCP Server Cross-Tool Interoperability Suite', () => {
  let tmpDir: string;
  const testPasskey = 'alphaxheros';
  const testSecret = 'CONFIDENTIAL_TACTICAL_TELEMETRY_DELTA_99';

  beforeAll(async () => {
    await initCrypto();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ombrix-cross-compat-'));
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('Web embed (HyperMatrix + keyed scatter) -> CLI extract', async () => {
    const carrier = createCarrier(128, 128);
    // Simulate Web App: encrypts payload with passkey AND passes passphrase to hyperMatrixMethod.embed
    const encryptedPayload = encryptWithPasskey(testSecret, testPasskey);
    const webStego = await hyperMatrixMethod.embed(carrier, encryptedPayload, {
      passphrase: testPasskey,
    });

    const webStegoPath = path.join(tmpDir, 'web-stego.png');
    fs.writeFileSync(webStegoPath, encodePng(webStego));

    // CLI extraction
    const cliRes = await runCli(['extract', webStegoPath, '-k', testPasskey]);
    expect(cliRes.exitCode).toBe(0);
    expect(cliRes.stdout).toContain(testSecret);
    expect(cliRes.stdout).toContain('Payload decrypted via Argon2id + XChaCha20-Poly1305');
  });

  it('Web embed (HyperMatrix + keyed scatter) -> MCP stego_extract', async () => {
    const carrier = createCarrier(128, 128);
    const encryptedPayload = encryptWithPasskey(testSecret, testPasskey);
    const webStego = await hyperMatrixMethod.embed(carrier, encryptedPayload, {
      passphrase: testPasskey,
    });

    const webStegoPath = path.join(tmpDir, 'web-stego-mcp.png');
    fs.writeFileSync(webStegoPath, encodePng(webStego));

    // MCP extraction
    const res = await handleJsonRpc({
      jsonrpc: '2.0',
      id: 201,
      method: 'tools/call',
      params: {
        name: 'stego_extract',
        arguments: {
          stegoPath: webStegoPath,
          passkey: testPasskey,
          method: 'auto',
        },
      },
    });

    const result = res?.result as unknown as ToolCallResult;
    expect(result.isError).toBeFalsy();
    const data = JSON.parse(getText(result));
    expect(data.status).toBe('success');
    expect(data.previewText).toBe(testSecret);
    expect(data.wasEncrypted).toBe(true);
  });

  it('CLI embed -> Web extract (HyperMatrix)', async () => {
    const carrier = createCarrier(128, 128);
    const coverPath = path.join(tmpDir, 'cli-cover.png');
    const cliStegoPath = path.join(tmpDir, 'cli-stego.png');
    fs.writeFileSync(coverPath, encodePng(carrier));

    // CLI embed
    const embedRes = await runCli([
      'embed',
      coverPath,
      '-p',
      testSecret,
      '-k',
      testPasskey,
      '-m',
      'hyper-matrix',
      '-o',
      cliStegoPath,
    ]);
    expect(embedRes.exitCode).toBe(0);

    // Simulate Web App extraction: reads stego carrier, extracts with passphrase, decrypts payload
    const stegoBytes = new Uint8Array(fs.readFileSync(cliStegoPath));
    const extractedCarrier = decodePng(stegoBytes);

    // Extract using Web App logic
    const extractedRaw = await hyperMatrixMethod.extract(
      {
        width: extractedCarrier.width,
        height: extractedCarrier.height,
        data: extractedCarrier.data,
      },
      { passphrase: testPasskey },
    );

    const decrypted = decryptWithPasskey(extractedRaw, testPasskey);
    expect(new TextDecoder().decode(decrypted)).toBe(testSecret);
  });

  it('MCP embed -> Web extract (HyperMatrix)', async () => {
    const carrier = createCarrier(128, 128);
    const coverPath = path.join(tmpDir, 'mcp-cover.png');
    const mcpStegoPath = path.join(tmpDir, 'mcp-stego.png');
    fs.writeFileSync(coverPath, encodePng(carrier));

    // MCP embed
    const res = await handleJsonRpc({
      jsonrpc: '2.0',
      id: 202,
      method: 'tools/call',
      params: {
        name: 'stego_embed',
        arguments: {
          carrierPath: coverPath,
          payload: testSecret,
          passkey: testPasskey,
          method: 'hyper-matrix',
          outputPath: mcpStegoPath,
        },
      },
    });

    const result = res?.result as unknown as ToolCallResult;
    expect(result.isError).toBeFalsy();

    // Verify MCP extraction
    const extRes = await handleJsonRpc({
      jsonrpc: '2.0',
      id: 203,
      method: 'tools/call',
      params: {
        name: 'stego_extract',
        arguments: {
          stegoPath: mcpStegoPath,
          passkey: testPasskey,
          method: 'auto',
        },
      },
    });

    const extResult = extRes?.result as unknown as ToolCallResult;
    expect(extResult.isError).toBeFalsy();
    const data = JSON.parse(getText(extResult));
    expect(data.previewText).toBe(testSecret);

    // Verify CLI extraction of MCP stego
    const cliExtract = await runCli(['extract', mcpStegoPath, '-k', testPasskey]);
    expect(cliExtract.exitCode).toBe(0);
    expect(cliExtract.stdout).toContain(testSecret);

    // Verify Web extraction of MCP stego
    const mcpCarrier = decodePng(new Uint8Array(fs.readFileSync(mcpStegoPath)));
    const webExtractedRaw = await hyperMatrixMethod.extract(
      {
        width: mcpCarrier.width,
        height: mcpCarrier.height,
        data: mcpCarrier.data,
      },
      { passphrase: testPasskey },
    );
    const webDecrypted = decryptWithPasskey(webExtractedRaw, testPasskey);
    expect(new TextDecoder().decode(webDecrypted)).toBe(testSecret);
  });

  it('Legacy/Unkeyed embed -> Keyed extract via dual-attempt fallback', async () => {
    const carrier = createCarrier(128, 128);
    // Legacy: encrypted payload embedded with DEFAULT seed (no passphrase passed to embed)
    const encryptedPayload = encryptWithPasskey(testSecret, testPasskey);
    const legacyStego = await hyperMatrixMethod.embed(carrier, encryptedPayload); // NO passphrase

    // Extracting WITH passphrase should still recover it via dual-attempt fallback!
    const recoveredBytes = await hyperMatrixMethod.extract(legacyStego, {
      passphrase: testPasskey,
    });
    const decrypted = decryptWithPasskey(recoveredBytes, testPasskey);
    expect(new TextDecoder().decode(decrypted)).toBe(testSecret);
  });
});
