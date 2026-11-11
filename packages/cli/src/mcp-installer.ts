import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as readline from 'node:readline';

export interface McpClientTarget {
  id: string;
  name: string;
  configPath: string;
  detected: boolean;
  format: 'claude_desktop' | 'cursor' | 'claude_code' | 'windsurf' | 'antigravity';
}

/**
 * Returns default paths for known AI client MCP configurations across OS platforms.
 */
export function getMcpClientTargets(): McpClientTarget[] {
  const home = os.homedir();
  const platform = os.platform();

  let claudeDesktopPath = '';
  if (platform === 'darwin') {
    claudeDesktopPath = path.join(
      home,
      'Library',
      'Application Support',
      'Claude',
      'claude_desktop_config.json',
    );
  } else if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    claudeDesktopPath = path.join(appData, 'Claude', 'claude_desktop_config.json');
  } else {
    // Linux / Unix
    claudeDesktopPath = path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
  }

  const cursorUserPath = path.join(home, '.cursor', 'mcp.json');
  const claudeCodePath = path.join(home, '.claude.json');
  const windsurfPath = path.join(home, '.codeium', 'windsurf', 'mcp_config.json');
  const antigravityPath = path.join(home, '.gemini', 'antigravity', 'mcp_config.json');

  return [
    {
      id: 'claude',
      name: 'Claude Desktop',
      configPath: claudeDesktopPath,
      detected: fs.existsSync(claudeDesktopPath),
      format: 'claude_desktop',
    },
    {
      id: 'cursor',
      name: 'Cursor IDE',
      configPath: cursorUserPath,
      detected: fs.existsSync(cursorUserPath),
      format: 'cursor',
    },
    {
      id: 'claude_code',
      name: 'Claude Code CLI',
      configPath: claudeCodePath,
      detected: fs.existsSync(claudeCodePath),
      format: 'claude_code',
    },
    {
      id: 'windsurf',
      name: 'Windsurf IDE',
      configPath: windsurfPath,
      detected: fs.existsSync(windsurfPath),
      format: 'windsurf',
    },
    {
      id: 'antigravity',
      name: 'Google Antigravity',
      configPath: antigravityPath,
      detected: fs.existsSync(path.dirname(antigravityPath)),
      format: 'antigravity',
    },
  ];
}

/**
 * Generates the standard OMBRIX MCP configuration definition.
 */
export function generateMcpEntry(useLocalPath = false): {
  command: string;
  args: string[];
  env?: Record<string, string>;
} {
  if (useLocalPath) {
    // Try to locate built packages/mcp-server/dist/index.js relative to monorepo
    const mcpDist = path.resolve(__dirname, '../../mcp-server/dist/index.js');
    if (fs.existsSync(mcpDist)) {
      return {
        command: 'node',
        args: [mcpDist],
      };
    }
  }

  return {
    command: 'npx',
    args: ['-y', '@ombrix/mcp-server'],
  };
}

/**
 * Injects OMBRIX MCP server into a client's configuration file safely with automatic backup.
 */
export function installMcpToClient(
  target: McpClientTarget,
  useLocalPath = false,
): { success: boolean; message: string; backupPath?: string } {
  const mcpEntry = generateMcpEntry(useLocalPath);
  const dir = path.dirname(target.configPath);

  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      return {
        success: false,
        message: `Failed to create directory ${dir}: ${(e as Error).message}`,
      };
    }
  }

  let configData: Record<string, unknown> = {};
  let backupPath: string | undefined;

  if (fs.existsSync(target.configPath)) {
    try {
      const raw = fs.readFileSync(target.configPath, 'utf8');
      const trimmed = raw.trim();
      configData = trimmed ? JSON.parse(trimmed) : {};

      // Create backup
      backupPath = `${target.configPath}.ombrix-backup-${Date.now()}`;
      fs.writeFileSync(backupPath, raw, 'utf8');
    } catch (_e) {
      configData = {};
    }
  }

  if (!configData.mcpServers || typeof configData.mcpServers !== 'object') {
    configData.mcpServers = {};
  }

  (configData.mcpServers as Record<string, unknown>).ombrix = mcpEntry;

  try {
    fs.writeFileSync(target.configPath, JSON.stringify(configData, null, 2), 'utf8');
    return {
      success: true,
      message: `Successfully configured OMBRIX MCP in ${target.name} (${target.configPath})`,
      backupPath,
    };
  } catch (e) {
    return {
      success: false,
      message: `Failed to write config to ${target.configPath}: ${(e as Error).message}`,
    };
  }
}

/**
 * Interactive prompt helper for terminal users.
 */
export async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
