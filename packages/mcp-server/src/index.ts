#!/usr/bin/env node
import { startMcpServer } from './server.js';

export { startMcpServer, handleJsonRpc } from './server.js';
export { MCP_TOOLS, executeTool } from './tools.js';

// Auto-run when invoked directly as a binary
if (
  process.argv[1] &&
  (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('ombrix-mcp'))
) {
  startMcpServer();
}
