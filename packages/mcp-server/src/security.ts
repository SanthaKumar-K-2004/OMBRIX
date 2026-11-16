import * as dns from 'node:dns/promises';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Custom error class for security violations (path traversal, SSRF, unauthorized access).
 */
export class SecurityError extends Error {
  readonly code: string;
  readonly hint?: string;

  constructor(code: string, message: string, hint?: string) {
    super(`${code}: ${message}`);
    this.name = 'SecurityError';
    this.code = code;
    this.hint = hint;
  }
}

/**
 * Returns the canonical configured root directory for OMBRIX file access.
 * Defaults to process.cwd() unless overridden by process.env.OMBRIX_ROOT.
 */
export function getOmbrixRoot(): string {
  const envRoot = process.env.OMBRIX_ROOT;
  if (envRoot?.trim()) {
    return path.resolve(envRoot.trim());
  }
  return process.cwd();
}

/**
 * Allowed output file extensions for safe writing.
 */
const ALLOWED_OUTPUT_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.txt',
  '.bin',
  '.json',
  '.dat',
  '.csv',
  '.md',
]);

function isPathInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Validates that a requested file path is confined within OMBRIX_ROOT or os.tmpdir(),
 * does not traverse out via '..', and is not a protected system file.
 */
export function validatePathConfinement(
  targetPath: string,
  options: {
    forWrite?: boolean;
    overwrite?: boolean;
    paramName?: string;
  } = {},
): string {
  const param = options.paramName || 'path';
  if (!targetPath || typeof targetPath !== 'string') {
    throw new SecurityError(
      'E_INVALID_PATH',
      `Parameter '${param}' must be a non-empty string path.`,
    );
  }

  // Detect Claude Web cloud container path
  if (targetPath.startsWith('/mnt/user-data/') || targetPath.startsWith('/mnt/data/')) {
    throw new SecurityError(
      'E_CARRIER_NOT_FOUND',
      `${param} path '${targetPath}' is an internal cloud container path in Claude web. The OMBRIX MCP server cannot access Claude web containers directly. Hint: To use local files, run Claude Desktop with OMBRIX MCP configured locally on your computer, or provide an image URL via ${param}Url, or a Base64 string via ${param}Base64.`,
    );
  }

  const root = getOmbrixRoot();
  const absolutePath = path.resolve(root, targetPath);

  // System temp directory is also permitted for transient operations
  const osTmp = os.tmpdir();
  let realOsTmp = osTmp;
  try {
    realOsTmp = fs.realpathSync(osTmp);
  } catch {
    // ignore
  }

  const isAllowedPath = (p: string) => {
    if (root === path.resolve('/')) return true;
    return isPathInside(root, p) || isPathInside(osTmp, p) || isPathInside(realOsTmp, p);
  };

  // Check explicit traversal segments
  const segments = targetPath.split(/[/\\]/);
  if (segments.includes('..')) {
    if (!isAllowedPath(absolutePath)) {
      throw new SecurityError(
        'E_ACCESS_DENIED',
        `Access denied: '${targetPath}' attempts directory traversal outside permitted directories.`,
        `Configure OMBRIX_ROOT environment variable if access to '${absolutePath}' is intended.`,
      );
    }
  }

  if (options.forWrite) {
    if (!isAllowedPath(absolutePath)) {
      throw new SecurityError(
        'E_ACCESS_DENIED',
        `Access denied: '${targetPath}' resolves outside permitted root directory '${root}'.`,
        `Configure OMBRIX_ROOT environment variable if access to '${absolutePath}' is intended.`,
      );
    }

    const ext = path.extname(absolutePath).toLowerCase();
    if (!ext || !ALLOWED_OUTPUT_EXTENSIONS.has(ext)) {
      throw new SecurityError(
        'E_INVALID_EXTENSION',
        `Output file extension '${ext || 'none'}' is not permitted. Permitted extensions: ${Array.from(ALLOWED_OUTPUT_EXTENSIONS).join(', ')}`,
      );
    }

    if (fs.existsSync(absolutePath) && !options.overwrite) {
      throw new SecurityError(
        'E_FILE_EXISTS',
        `File already exists at '${absolutePath}'. Set overwrite: true to allow replacing existing files.`,
        'Pass { "overwrite": true } in tool options if you wish to overwrite this file.',
      );
    }
  } else {
    // For read operations:
    // If file exists, enforce strict boundary confinement, symlink resolution, and hidden file protection
    if (fs.existsSync(absolutePath)) {
      if (!isAllowedPath(absolutePath)) {
        throw new SecurityError(
          'E_ACCESS_DENIED',
          `Access denied: '${targetPath}' resolves outside permitted root directory '${root}'.`,
          `Configure OMBRIX_ROOT environment variable if access to '${absolutePath}' is intended.`,
        );
      }

      // Prevent accessing hidden system files / sensitive dotfiles (.env, .bashrc, .ssh, .git)
      const base = path.basename(absolutePath);
      if (base.startsWith('.') && base !== '.png') {
        throw new SecurityError(
          'E_ACCESS_DENIED',
          `Access to hidden system/configuration file '${base}' is restricted.`,
        );
      }

      try {
        const real = fs.realpathSync(absolutePath);
        if (!isAllowedPath(real)) {
          throw new SecurityError(
            'E_ACCESS_DENIED',
            `Symlink traversal denied: '${targetPath}' points outside permitted directory.`,
          );
        }
      } catch (err) {
        if (err instanceof SecurityError) throw err;
      }
    }
  }

  // Prevent accessing hidden system files even for non-existent target in write mode
  const base = path.basename(absolutePath);
  if (base.startsWith('.') && base !== '.png') {
    throw new SecurityError(
      'E_ACCESS_DENIED',
      `Access to hidden system/configuration file '${base}' is restricted.`,
    );
  }

  return absolutePath;
}

/**
 * Checks whether an IP address belongs to private, loopback, or cloud-metadata ranges.
 */
export function isPrivateOrLoopbackIp(ip: string): boolean {
  if (!net.isIP(ip)) return false;

  // IPv4 checks
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === undefined || b === undefined) return false;

    // Loopback: 127.0.0.0/8
    if (a === 127) return true;
    // Current network: 0.0.0.0/8
    if (a === 0) return true;
    // RFC 1918 Private: 10.0.0.0/8
    if (a === 10) return true;
    // RFC 1918 Private: 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // RFC 1918 Private: 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // Link-local / Cloud metadata: 169.254.0.0/16 (AWS/GCP/Azure: 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // CGNAT / Shared: 100.64.0.0/10
    if (a === 100 && b >= 64 && b <= 127) return true;
    // Broadcast: 255.255.255.255
    if (ip === '255.255.255.255') return true;

    return false;
  }

  // IPv6 checks
  const clean = ip.toLowerCase();
  // IPv6 Loopback (::1)
  if (clean === '::1' || clean === '0:0:0:0:0:0:0:1') return true;
  // IPv6 Unspecified (::)
  if (clean === '::' || clean === '0:0:0:0:0:0:0:0') return true;
  // IPv6 Unique Local (fc00::/7)
  if (clean.startsWith('fc') || clean.startsWith('fd')) return true;
  // IPv6 Link-Local (fe80::/10)
  if (
    clean.startsWith('fe8') ||
    clean.startsWith('fe9') ||
    clean.startsWith('fea') ||
    clean.startsWith('feb')
  )
    return true;
  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  if (clean.startsWith('::ffff:')) {
    const v4 = clean.replace('::ffff:', '');
    return isPrivateOrLoopbackIp(v4);
  }

  return false;
}

/**
 * Fetches an image from an external URL safely:
 * - Restricts protocol strictly to http / https
 * - Prevents SSRF attacks against internal network, localhost, and AWS/GCP cloud metadata
 * - Limits response byte size to 25 MB
 * - Enforces a strict 10s timeout via AbortController
 */
export async function safeFetchUrl(
  urlStr: string,
  options: {
    maxBytes?: number;
    timeoutMs?: number;
  } = {},
): Promise<Uint8Array> {
  const maxBytes = options.maxBytes ?? 25 * 1024 * 1024; // 25 MB max
  const timeoutMs = options.timeoutMs ?? 10000; // 10s max

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlStr);
  } catch {
    throw new SecurityError('E_INVALID_URL', `Malformed URL provided: ${urlStr}`);
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new SecurityError(
      'E_INVALID_PROTOCOL',
      `Unsupported protocol '${parsedUrl.protocol}'. Only http: and https: URLs are permitted.`,
    );
  }

  const hostname = parsedUrl.hostname;
  if (!hostname || hostname.toLowerCase() === 'localhost') {
    throw new SecurityError(
      'E_SSRF_BLOCKED',
      `Access to localhost or loopback domain '${hostname}' is blocked.`,
    );
  }

  // Perform DNS resolution to inspect resolved IP address
  try {
    const lookupResult = await dns.lookup(hostname, { all: true });
    for (const record of lookupResult) {
      if (isPrivateOrLoopbackIp(record.address)) {
        throw new SecurityError(
          'E_SSRF_BLOCKED',
          `Access to private/internal IP address '${record.address}' for host '${hostname}' is blocked.`,
          'OMBRIX MCP forbids connecting to internal network, link-local, or cloud metadata services.',
        );
      }
    }
  } catch (err) {
    if (err instanceof SecurityError) throw err;
    throw new SecurityError(
      'E_DNS_FAILED',
      `DNS lookup failed for host '${hostname}': ${(err as Error).message}`,
    );
  }

  // Fetch with AbortSignal timeout and manual redirect control
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      redirect: 'follow', // Fetch handles redirect; we validate response
      headers: {
        'User-Agent': 'OMBRIX-MCP-Stego/0.1.5 (+https://github.com/SanthaKumar-K-2004/OMBRIX)',
        Accept: 'image/png,image/*;q=0.9,*/*;q=0.1',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP fetch failed with status ${res.status} ${res.statusText}`);
    }

    // Stream and enforce byte limit
    const reader = res.body?.getReader();
    if (!reader) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength > maxBytes) {
        throw new SecurityError(
          'E_FILE_TOO_LARGE',
          `Downloaded image exceeds maximum size limit of ${maxBytes} bytes.`,
        );
      }
      return new Uint8Array(buf);
    }

    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        receivedBytes += value.length;
        if (receivedBytes > maxBytes) {
          reader.cancel();
          throw new SecurityError(
            'E_FILE_TOO_LARGE',
            `Downloaded image exceeds maximum size limit of ${maxBytes} bytes (${receivedBytes} bytes received).`,
          );
        }
        chunks.push(value);
      }
    }

    const out = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new SecurityError('E_TIMEOUT', `Image fetch timed out after ${timeoutMs}ms: ${urlStr}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
