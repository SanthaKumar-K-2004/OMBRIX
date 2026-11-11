import { MCP_TOOLS, executeTool } from './tools.js';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Handles incoming JSON-RPC 2.0 requests per Model Context Protocol specification.
 */
export async function handleJsonRpc(request: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  const { id, method, params } = request;

  // Notifications (requests without id) don't return responses
  if (method === 'notifications/initialized') {
    return null;
  }

  if (method === 'ping') {
    return { jsonrpc: '2.0', id, result: {} };
  }

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'ombrix-mcp',
          version: '0.1.1',
          description: 'Zero-knowledge undetectable steganography and visual forensics suite.',
          icons: [
            {
              src: 'https://spidysanta-ombrix-mcp.hf.space/icon.svg',
              mimeType: 'image/svg+xml',
              sizes: ['512x512'],
            },
          ],
        },
      },
    };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: MCP_TOOLS,
      },
    };
  }

  if (method === 'tools/call') {
    const toolName = String(params?.name || '');
    const toolArgs = (params?.arguments as Record<string, unknown>) || {};

    try {
      const output = await executeTool(toolName, toolArgs);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(output, null, 2),
            },
          ],
        },
      };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error executing ${toolName}: ${(err as Error).message}`,
            },
          ],
        },
      };
    }
  }

  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: -32601,
      message: `Method not found: ${method}`,
    },
  };
}

/**
 * Starts the stdio JSON-RPC MCP server.
 */
export function startMcpServer(): void {
  let buffer = '';

  process.stdin.setEncoding('utf8');

  process.stdin.on('data', async (chunk: string) => {
    buffer += chunk;

    // Support both Content-Length headers and standard MCP newline-delimited JSON
    while (buffer.length > 0) {
      const trimmed = buffer.trimStart();
      if (trimmed.startsWith('Content-Length:')) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        const sepLen = headerEnd !== -1 ? 4 : 2;
        const actualHeaderEnd = headerEnd !== -1 ? headerEnd : buffer.indexOf('\n\n');
        if (actualHeaderEnd === -1) break;

        const headerLine = buffer.slice(0, actualHeaderEnd);
        const match = headerLine.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          buffer = buffer.slice(actualHeaderEnd + sepLen);
          continue;
        }

        const length = Number.parseInt(match[1] ?? '0', 10);
        const messageStart = actualHeaderEnd + sepLen;
        if (buffer.length < messageStart + length) {
          break; // wait for more data
        }

        const rawJson = buffer.slice(messageStart, messageStart + length);
        buffer = buffer.slice(messageStart + length);

        if (rawJson.trim()) {
          await processMessage(rawJson.trim());
        }
      } else {
        const newlineIdx = buffer.indexOf('\n');
        if (newlineIdx === -1) {
          // If buffer contains a complete single-line JSON without trailing newline, process it
          const rawCandidate = buffer.trim();
          if (rawCandidate.startsWith('{') && rawCandidate.endsWith('}')) {
            try {
              JSON.parse(rawCandidate);
              buffer = '';
              await processMessage(rawCandidate);
            } catch {
              // wait for more chunks
            }
          }
          break;
        }

        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);

        if (line) {
          await processMessage(line);
        }
      }
    }
  });

  process.stdin.on('end', async () => {
    const remaining = buffer.trim();
    if (remaining) {
      await processMessage(remaining);
    }
  });

  async function processMessage(raw: string) {
    if (!raw || raw.trim().length === 0) return;
    try {
      const req: JsonRpcRequest = JSON.parse(raw);
      const res = await handleJsonRpc(req);
      if (res !== null) {
        sendResponse(res);
      }
    } catch (e) {
      sendResponse({
        jsonrpc: '2.0',
        error: {
          code: -32700,
          message: `Parse error: ${(e as Error).message}`,
        },
      });
    }
  }

  function sendResponse(res: JsonRpcResponse) {
    const payload = JSON.stringify(res);
    // Standard MCP stdio output: newline-delimited JSON (NDJSON)
    process.stdout.write(`${payload}\n`);
  }

  process.stderr.write('[OMBRIX MCP] Server started on stdio. Ready for AI agent tool calls.\n');
}
