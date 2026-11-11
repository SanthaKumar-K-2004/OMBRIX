import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { executeCodeMode, getCodeModeApiDocs } from '../src/code-mode.js';
import { handleJsonRpc } from '../src/server.js';

describe('OMBRIX MCP 2.0 Code Mode Suite', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ombrix-code-mode-test-'));
  });

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('provides comprehensive API documentation via getCodeModeApiDocs', () => {
    const docs = getCodeModeApiDocs();
    expect(docs).toContain('declare namespace ombrix');
    expect(docs).toContain('function load');
    expect(docs).toContain('function embed');
    expect(docs).toContain('function extract');
    expect(docs).toContain('function scan');
    expect(docs).toContain('function keygen');
    expect(docs).toContain('function benchmark');
  });

  it('executes sandboxed JavaScript and captures logs and returns value', async () => {
    const code = `
      console.log('Step 1: starting sandbox calculation');
      const val = 40 + 2;
      console.log('Step 2: completed with val', val);
      return { answer: val, engine: 'OMBRIX MCP 2.0' };
    `;

    const res = await executeCodeMode(code);
    expect(res.status).toBe('success');
    expect((res.result as { answer: number }).answer).toBe(42);
    expect(res.logs).toHaveLength(2);
    expect(res.logs[0]).toContain('Step 1');
    expect(res.logs[1]).toContain('Step 2');
    expect(res.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('executes complete end-to-end multi-step steganography workflow inside Code Mode sandbox', async () => {
    const testOutPath = path.join(tmpDir, 'code-mode-carrier.png');

    const code = `
      // 1. Create a 64x64 synthetic carrier in memory
      const carrier = ombrix.createCarrier(64, 64, [100, 150, 200, 255]);
      console.log('Carrier dimensions:', carrier.width, 'x', carrier.height);

      // 2. Generate a 32-byte cryptographic token
      const token = await ombrix.keygen('crypto32');
      console.log('Generated token:', token.passkey.substring(0, 9) + '...');

      // 3. Embed message with Argon2id passkey
      const secret = 'TOP_SECRET_CODE_MODE_TRANSMISSION';
      const embedRes = await ombrix.embed(carrier, secret, {
        method: 'hyper-matrix',
        passkey: token.passkey,
        outputPath: '${testOutPath}',
      });

      // 4. Extract secret from the written file with the passkey
      const extractRes = await ombrix.extract('${testOutPath}', {
        method: 'hyper-matrix',
        passkey: token.passkey,
      });

      // 5. Scan the resulting stego image for anomalies
      const scanRes = ombrix.scan('${testOutPath}');

      // Return concise summary to AI agent (massive token savings)
      return {
        embeddedBytes: embedRes.payloadBytes,
        extractedText: extractRes.text,
        passkeyDecrypted: extractRes.passkeyDecrypted,
        stegoVerdict: scanRes.verdict,
        anomalyScore: scanRes.overallAnomalyScore,
      };
    `;

    const res = await executeCodeMode(code);
    expect(res.status).toBe('success');
    const data = res.result as {
      embeddedBytes: number;
      extractedText: string;
      passkeyDecrypted: boolean;
      stegoVerdict: string;
    };
    expect(data.extractedText).toBe('TOP_SECRET_CODE_MODE_TRANSMISSION');
    expect(data.passkeyDecrypted).toBe(true);
    expect(fs.existsSync(testOutPath)).toBe(true);
  });

  it('enforces execution timeout on infinite loops to prevent resource exhaustion', async () => {
    const infiniteLoopCode = `
      console.log('Starting infinite loop');
      while (true) {}
      return 'done';
    `;

    const res = await executeCodeMode(infiniteLoopCode, 1000);
    expect(res.status).toBe('error');
    expect(res.error).toMatch(/timed out/i);
  });

  it('blocks host process and network access in Code Mode sandbox', async () => {
    // Attempting process access
    const processCode = `
      process.exit(1);
    `;
    const resProcess = await executeCodeMode(processCode);
    expect(resProcess.status).toBe('error');
    expect(resProcess.error).toContain('process is not defined');

    // Attempting fetch
    const fetchCode = `
      fetch('https://example.com');
    `;
    const resFetch = await executeCodeMode(fetchCode);
    expect(resFetch.status).toBe('error');
    expect(resFetch.error).toContain('fetch is not defined');

    // Attempting require
    const requireCode = `
      require('fs');
    `;
    const resRequire = await executeCodeMode(requireCode);
    expect(resRequire.status).toBe('error');
    expect(resRequire.error).toContain('require is not defined');
  });

  it('exposes stego_code_mode and stego_api_docs over JSON-RPC 2.0 handshake', async () => {
    // 1. tools/list should now contain 8 tools
    const listRes = await handleJsonRpc({
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/list',
    });

    const listResult = listRes?.result as unknown as {
      tools: Array<{ name: string; description?: string }>;
    };
    expect(listResult.tools).toHaveLength(11);
    const names = listResult.tools.map((t) => t.name);
    expect(names).toContain('stego_code_mode');
    expect(names).toContain('stego_api_docs');

    // 2. Call stego_api_docs
    const docsRes = await handleJsonRpc({
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: {
        name: 'stego_api_docs',
        arguments: {},
      },
    });

    const docsResult = docsRes?.result as unknown as {
      content: Array<{ type: string; text: string }>;
    };
    const docsText = docsResult.content[0]?.text ?? '{}';
    const parsedDocs = JSON.parse(docsText) as { apiDocs: string };
    expect(parsedDocs.apiDocs).toContain('declare namespace ombrix');

    // 3. Call stego_code_mode via JSON-RPC
    const codeRes = await handleJsonRpc({
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/call',
      params: {
        name: 'stego_code_mode',
        arguments: {
          code: `
            const key = await ombrix.keygen('diceware', { words: 3 });
            return { phrase: key.passkey, wordCount: key.wordCount };
          `,
        },
      },
    });

    const codeResult = codeRes?.result as unknown as {
      content: Array<{ type: string; text: string }>;
    };
    const codeText = codeResult.content[0]?.text ?? '{}';
    const parsedCode = JSON.parse(codeText) as {
      status: string;
      result: { wordCount: number; phrase: string };
    };
    expect(parsedCode.status).toBe('success');
    expect(parsedCode.result.wordCount).toBe(3);
    expect(parsedCode.result.phrase.split('-')).toHaveLength(3);
  });
});
