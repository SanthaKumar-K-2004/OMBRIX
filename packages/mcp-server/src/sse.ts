import * as crypto from 'node:crypto';
import * as http from 'node:http';
import { handleJsonRpc } from './server.js';
import { MCP_TOOLS } from './tools.js';

/**
 * HTML Landing Page displayed on Hugging Face Spaces root (GET /)
 */
function getLandingPageHtml(host: string): string {
  const toolsHtml = MCP_TOOLS.map(
    (t) => `
    <div class="tool-card">
      <div class="tool-header">
        <span class="tool-name">${t.name}</span>
        <span class="tool-badge">MCP Tool</span>
      </div>
      <p class="tool-desc">${t.description}</p>
    </div>
  `,
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OMBRIX MCP 2.0 Server | Hugging Face Spaces</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --card-border: #1f2937;
      --accent: #00f0ff;
      --accent-gold: #fbbf24;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      padding: 2rem 1rem;
    }
    .container { max-width: 900px; margin: 0 auto; }
    header {
      text-align: center;
      margin-bottom: 2.5rem;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 2rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(0, 240, 255, 0.1);
      border: 1px solid rgba(0, 240, 255, 0.3);
      color: var(--accent);
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 10px #10b981;
    }
    h1 {
      font-size: 2.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, #ffffff 0%, var(--accent) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.75rem;
    }
    p.lead { color: var(--text-muted); font-size: 1.15rem; max-width: 650px; margin: 0 auto; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    h2 { font-size: 1.25rem; margin-bottom: 1rem; color: #fff; display: flex; align-items: center; gap: 0.5rem; }
    pre {
      background: #030712;
      border: 1px solid #1f2937;
      border-radius: 8px;
      padding: 1rem;
      overflow-x: auto;
      font-family: var(--font-mono);
      font-size: 0.9rem;
      color: #38bdf8;
    }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .tool-card {
      background: #0b1120;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 1rem;
    }
    .tool-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .tool-name { font-family: var(--font-mono); font-weight: 700; color: var(--accent); font-size: 0.95rem; }
    .tool-badge { font-size: 0.7rem; background: #1e293b; color: var(--text-muted); padding: 0.15rem 0.5rem; border-radius: 4px; }
    .tool-desc { font-size: 0.85rem; color: var(--text-muted); line-height: 1.4; }
    footer { text-align: center; margin-top: 3rem; color: var(--text-muted); font-size: 0.85rem; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="badge">
        <span class="status-dot"></span>
        <span>Hugging Face Space &bull; Active &bull; Port 7860</span>
      </div>
      <h1>OMBRIX MCP 2.0 Server</h1>
      <p class="lead">Zero-Telemetry Forensic Steganography &amp; Visual Cryptanalysis Engine for Claude Desktop, Cursor, and AI Agents.</p>
    </header>

    <div class="card">
      <h2>🔌 Connect URL (Server-Sent Events)</h2>
      <p style="color: var(--text-muted); margin-bottom: 0.75rem; font-size: 0.95rem;">
        Paste this direct URL into your AI agent's remote MCP configuration:
      </p>
      <pre>https://${host}/sse</pre>
    </div>

    <div class="card">
      <h2>💻 Claude Desktop / Cursor Configuration</h2>
      <p style="color: var(--text-muted); margin-bottom: 0.75rem; font-size: 0.95rem;">
        Add to your <code>claude_desktop_config.json</code> or Cursor MCP settings:
      </p>
      <pre>{
  "mcpServers": {
    "ombrix": {
      "url": "https://${host}/sse"
    }
  }
}</pre>
    </div>

    <div class="card">
      <h2>🛠️ Available MCP Tools (${MCP_TOOLS.length})</h2>
      <div class="grid">
        ${toolsHtml}
      </div>
    </div>

    <footer>
      <p>OMBRIX &bull; Air-Gapped Zero-Telemetry Protocol &bull; <a href="https://github.com/SanthaKumar-K-2004/OMBRIX" target="_blank" rel="noreferrer">GitHub Repository</a> &bull; <a href="https://ombrix-stego.vercel.app/" target="_blank" rel="noreferrer">Web Studio</a></p>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Starts the Server-Sent Events (SSE) HTTP Server for remote hosting (e.g. Hugging Face Spaces).
 */
export function startSseServer(port = 7860): http.Server {
  const sessions = new Map<string, http.ServerResponse>();

  const server = http.createServer(async (req, res) => {
    const rawHost = req.headers.host || `localhost:${port}`;

    // Enable permissive CORS for AI client connectivity
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://${rawHost}`);

    // Health check endpoint
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          transport: 'sse',
          version: '0.1.1',
          toolsCount: MCP_TOOLS.length,
          activeSessions: sessions.size,
        }),
      );
      return;
    }

    // Server-Sent Events stream initialization (GET /sse)
    if (url.pathname === '/sse' && req.method === 'GET') {
      const sessionId = crypto.randomUUID();
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });

      sessions.set(sessionId, res);

      // Send initial endpoint event pointing to the POST message URL with session token
      res.write(`event: endpoint\ndata: /message?sessionId=${sessionId}\n\n`);

      // Heartbeat ping every 25 seconds to keep connection alive through cloud proxies
      const heartbeat = setInterval(() => {
        if (!res.writableEnded) {
          res.write(': keepalive\n\n');
        }
      }, 25000);

      req.on('close', () => {
        clearInterval(heartbeat);
        sessions.delete(sessionId);
      });
      return;
    }

    // JSON-RPC message receiver (POST /message?sessionId=<sessionId>)
    if (url.pathname === '/message' && req.method === 'POST') {
      const sessionId = url.searchParams.get('sessionId');
      if (!sessionId || !sessions.has(sessionId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid, missing, or expired sessionId' }));
        return;
      }

      const sessionRes = sessions.get(sessionId)!;

      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', async () => {
        try {
          const jsonRpc = JSON.parse(body);

          // Return HTTP 202 Accepted immediately per MCP SSE specification
          res.writeHead(202, { 'Content-Type': 'text/plain' });
          res.end('Accepted');

          // Process the JSON-RPC request and pipe response over the active SSE stream
          const response = await handleJsonRpc(jsonRpc);
          if (response !== null && !sessionRes.writableEnded) {
            sessionRes.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
          }
        } catch (err) {
          if (!sessionRes.writableEnded) {
            sessionRes.write(
              `event: message\ndata: ${JSON.stringify({
                jsonrpc: '2.0',
                error: {
                  code: -32700,
                  message: `Parse error: ${(err as Error).message}`,
                },
              })}\n\n`,
            );
          }
        }
      });
      return;
    }

    // Web landing page and documentation (GET /)
    if (url.pathname === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getLandingPageHtml(rawHost));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(port, () => {
    process.stderr.write(
      `[OMBRIX MCP] Server-Sent Events (SSE) server listening on http://0.0.0.0:${port}\n`,
    );
    process.stderr.write(`[OMBRIX MCP] Connect URL: http://0.0.0.0:${port}/sse\n`);
  });

  return server;
}
