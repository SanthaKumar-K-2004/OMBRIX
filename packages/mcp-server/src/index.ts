#!/usr/bin/env node
import { startMcpServer } from './server.js';
import { startSseServer } from './sse.js';

export { startMcpServer, handleJsonRpc } from './server.js';
export { startSseServer } from './sse.js';
export { MCP_TOOLS, executeTool } from './tools.js';
export { executeCodeMode, getCodeModeApiDocs } from './code-mode.js';

// Auto-run when invoked directly as the MCP server entrypoint
const argv1 = process.argv[1] || '';
if (
  argv1 &&
  !process.env.VITEST &&
  (argv1.endsWith('mcp-server/dist/index.js') ||
    argv1.includes('ombrix-mcp-server') ||
    argv1.endsWith('/bin/ombrix-mcp') ||
    argv1.endsWith('spaces/huggingface/index.js'))
) {
  const isSse =
    process.argv.includes('--sse') ||
    process.env.MCP_TRANSPORT === 'sse' ||
    Boolean(process.env.SPACE_ID); // Hugging Face Spaces sets SPACE_ID

  if (isSse) {
    const port = Number(process.env.PORT || 7860);
    startSseServer(port);
  } else {
    startMcpServer();
  }
}
