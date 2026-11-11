#!/usr/bin/env node
import { startMcpServer } from './server.js';
import { startSseServer } from './sse.js';

export { startMcpServer, handleJsonRpc } from './server.js';
export { startSseServer } from './sse.js';
export { MCP_TOOLS, executeTool } from './tools.js';
export { executeCodeMode, getCodeModeApiDocs } from './code-mode.js';

// Auto-run when invoked directly as a binary (CLI, npx, stdio, or HTTP SSE)
if (
  process.argv[1] &&
  !process.env.VITEST &&
  (process.argv[1].endsWith('index.js') ||
    process.argv[1].includes('ombrix-mcp') ||
    process.argv[1].includes('mcp'))
) {
  const isSse =
    process.argv.includes('--sse') ||
    process.env.MCP_TRANSPORT === 'sse' ||
    Boolean(process.env.PORT);

  if (isSse) {
    const port = Number(process.env.PORT || 7860);
    startSseServer(port);
  } else {
    startMcpServer();
  }
}
