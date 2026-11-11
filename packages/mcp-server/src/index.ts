#!/usr/bin/env node
import { startMcpServer } from './server.js';

export { startMcpServer, handleJsonRpc } from './server.js';
export { MCP_TOOLS, executeTool } from './tools.js';
export { executeCodeMode, getCodeModeApiDocs } from './code-mode.js';

// Auto-run when invoked directly as a binary (CLI, npx, or stdio)
if (
  process.argv[1] &&
  !process.env.VITEST &&
  (process.argv[1].endsWith('index.js') ||
    process.argv[1].includes('ombrix-mcp') ||
    process.argv[1].includes('mcp'))
) {
  startMcpServer();
}
