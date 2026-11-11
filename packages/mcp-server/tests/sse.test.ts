import type * as http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startSseServer } from '../src/sse.js';

describe('MCP SSE Server', () => {
  let server: http.Server;
  const testPort = 17860;

  beforeAll(async () => {
    server = startSseServer(testPort);
    await new Promise<void>((resolve) => server.on('listening', resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('responds with 200 and health info on GET /health', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.transport).toBe('sse');
    expect(data.toolsCount).toBeGreaterThan(0);
  });

  it('serves landing page HTML on GET /', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('OMBRIX MCP 2.0 Server');
    expect(html).toContain('/sse');
  });

  it('opens an SSE stream on GET /sse and processes JSON-RPC message via POST /message', async () => {
    const sseRes = await fetch(`http://127.0.0.1:${testPort}/sse`);
    expect(sseRes.status).toBe(200);
    expect(sseRes.headers.get('content-type')).toBe('text/event-stream');

    const reader = sseRes.body?.getReader();
    expect(reader).toBeDefined();

    // Read the initial 'endpoint' event
    const firstChunk = await reader!.read();
    const firstText = new TextDecoder().decode(firstChunk.value);
    expect(firstText).toContain('event: endpoint');

    const match = firstText.match(/data:\s*(\/message\?sessionId=([a-f0-9-]+))/);
    expect(match).toBeTruthy();
    const postPath = match![1];

    // Send a JSON-RPC tools/list request via POST
    const postRes = await fetch(`http://127.0.0.1:${testPort}${postPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-123',
        method: 'tools/list',
      }),
    });
    expect(postRes.status).toBe(202);

    // Read response from the SSE stream
    const secondChunk = await reader!.read();
    const secondText = new TextDecoder().decode(secondChunk.value);
    expect(secondText).toContain('event: message');
    expect(secondText).toContain('"id":"test-123"');
    expect(secondText).toContain('stego_embed');

    await reader!.cancel();
  });
});
