import { execFile, execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface NativeFileDialogOptions {
  title?: string;
  startDir?: string;
  timeoutMs?: number;
}

/**
 * Checks whether the current host environment has an active desktop GUI display.
 */
export function hasGuiEnvironment(): boolean {
  const platform = os.platform();
  if (platform === 'darwin' || platform === 'win32') {
    return true;
  }
  // Linux / Unix
  return Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
}

/**
 * Opens a native OS file dialog allowing the user to select a PNG carrier file with 1 click.
 * Works natively on macOS (AppleScript Cocoa), Windows (PowerShell WinForms), and Linux (kdialog, zenity, or python3 tkinter).
 *
 * Returns the absolute path of the selected file, or null if cancelled / timed out / headless.
 */
export async function openNativeFileDialog(
  options: NativeFileDialogOptions = {},
): Promise<string | null> {
  if (!hasGuiEnvironment()) {
    return null;
  }

  const title = options.title || 'Select Carrier PNG Image - OMBRIX';
  const startDir =
    options.startDir && fs.existsSync(options.startDir)
      ? options.startDir
      : path.join(os.homedir(), 'Pictures');
  const timeout = options.timeoutMs || 60000; // 60 seconds default timeout

  const platform = os.platform();

  if (platform === 'darwin') {
    // macOS: AppleScript native Cocoa file chooser
    const script = `POSIX path of (choose file with prompt "${title.replace(/"/g, '\\"')}" of type {"public.png", "png"})`;
    return runDialogProcess('osascript', ['-e', script], timeout);
  }

  if (platform === 'win32') {
    // Windows: PowerShell native OpenFileDialog
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms;
$d = New-Object System.Windows.Forms.OpenFileDialog;
$d.Title = '${title.replace(/'/g, "''")}';
$d.Filter = 'PNG Images (*.png)|*.png|All Files (*.*)|*.*';
if (Test-Path '${startDir.replace(/'/g, "''")}') { $d.InitialDirectory = '${startDir.replace(/'/g, "''")}'; }
if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $d.FileName
}
`.trim();
    return runDialogProcess(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', psScript],
      timeout,
    );
  }

  // Linux: probe kdialog -> zenity -> python3 tkinter
  if (isCommandAvailable('kdialog')) {
    return runDialogProcess(
      'kdialog',
      ['--title', title, '--getopenfilename', startDir, '*.png|PNG Images (*.png)'],
      timeout,
    );
  }

  if (isCommandAvailable('zenity')) {
    return runDialogProcess(
      'zenity',
      [
        '--file-selection',
        `--title=${title}`,
        `--filename=${startDir}/`,
        '--file-filter=PNG Images (*.png) | *.png',
      ],
      timeout,
    );
  }

  if (isCommandAvailable('python3')) {
    // Tkinter native fallback
    const pyScript = `
import sys, os
try:
    import tkinter as tk
    from tkinter import filedialog
    root = tk.Tk()
    root.withdraw()
    try:
        root.attributes('-topmost', True)
    except Exception:
        pass
    init_dir = r"${startDir}" if os.path.isdir(r"${startDir}") else os.path.expanduser("~")
    fp = filedialog.askopenfilename(
        title="${title}",
        initialdir=init_dir,
        filetypes=[("PNG Images", "*.png"), ("All Files", "*.*")]
    )
    if fp:
        print(fp)
except Exception:
    sys.exit(1)
`.trim();
    return runDialogProcess('python3', ['-c', pyScript], timeout);
  }

  return null;
}

/**
 * Searches standard user directories to locate the most recently created or modified PNG image.
 */
export function findLatestCarrierImage(options?: { searchDirs?: string[] }): string | null {
  const home = os.homedir();
  const searchDirs = options?.searchDirs || [
    path.join(home, 'Pictures', 'Screenshots'),
    path.join(home, 'Downloads'),
    path.join(home, 'Pictures'),
    path.join(home, 'Desktop'),
    process.cwd(),
  ];

  let latestPath: string | null = null;
  let latestMtime = 0;

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;

    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (!entry.toLowerCase().endsWith('.png')) continue;
        const fullPath = path.join(dir, entry);
        try {
          const stats = fs.statSync(fullPath);
          if (stats.isFile() && stats.mtimeMs > latestMtime) {
            latestMtime = stats.mtimeMs;
            latestPath = fullPath;
          }
        } catch {
          // Skip inaccessible file
        }
      }
    } catch {
      // Skip inaccessible directory
    }
  }

  return latestPath;
}

/**
 * Intelligently resolves a bare filename or Claude virtual container path (/mnt/data/...)
 * to a real, accessible local file path on the host system.
 */
export function resolveFuzzyCarrierPath(targetPath: string): string | null {
  const trimmed = targetPath.trim();
  if (!trimmed) return null;

  // Direct exact match
  if (fs.existsSync(trimmed)) {
    return path.resolve(trimmed);
  }

  // Extract base filename (handles /mnt/data/image.png, C:\fake\image.png, or image.png)
  const filename = path.basename(trimmed);
  const home = os.homedir();

  const candidateDirs = [
    path.join(home, 'Pictures', 'Screenshots'),
    path.join(home, 'Downloads'),
    path.join(home, 'Pictures'),
    path.join(home, 'Desktop'),
    path.join(home, 'Documents'),
    path.join(home, 'Claude'),
    process.cwd(),
    home,
  ];

  for (const dir of candidateDirs) {
    const candidate = path.join(dir, filename);
    if (fs.existsSync(candidate)) {
      try {
        const stats = fs.statSync(candidate);
        if (stats.isFile()) {
          return candidate;
        }
      } catch {
        // Skip inaccessible
      }
    }
  }

  return null;
}

function runDialogProcess(cmd: string, args: string[], timeout: number): Promise<string | null> {
  return new Promise((resolve) => {
    let completed = false;
    const proc = execFile(cmd, args, { timeout }, (err, stdout) => {
      if (completed) return;
      completed = true;

      if (err || !stdout) {
        resolve(null);
        return;
      }

      const result = stdout.toString().trim();
      if (result && fs.existsSync(result)) {
        resolve(path.resolve(result));
      } else {
        resolve(null);
      }
    });

    // Hard fallback timeout
    setTimeout(() => {
      if (!completed) {
        completed = true;
        try {
          proc.kill();
        } catch {
          // ignore
        }
        resolve(null);
      }
    }, timeout + 500);
  });
}

function isCommandAvailable(cmd: string): boolean {
  try {
    const checkCmd = os.platform() === 'win32' ? 'where' : 'which';
    execFileSync(checkCmd, [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
