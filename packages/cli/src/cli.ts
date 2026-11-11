import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  decryptWithPasskey,
  encryptWithPasskey,
  generateDicewarePassphrase,
  generateEncryptionKeyPair,
  generateRandomPasskey32,
  generateSigningKeyPair,
  initCrypto,
  isPasskeyEncrypted,
} from '@ombrix/crypto-adapter';
import { Ombrix, type StegoMethod } from '@ombrix/edge-sdk';
import { startMcpServer } from '@ombrix/mcp-server';
import {
  haarDwtStego,
  hyperMatrixMethod,
  jpegDctStego,
  pvdStego,
  robustResilientStego,
} from '@ombrix/stego-advanced';
import type { ForensicsConsensusReport } from '@ombrix/stego-forensics';
import { pngLsbMatching } from '@ombrix/stego-lab';
import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import { getMcpClientTargets, installMcpToClient, promptUser } from './mcp-installer.js';
import { decodePng, encodePng } from './png-codec.js';

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const VERSION = '0.1.0';

const HELP_BANNER = `
  ██████╗ ███╗   ███╗██████╗ ██████╗ ██╗██╗  ██╗
 ██╔═══██╗████╗ ████║██╔══██╗██╔══██╗██║╚██╗██╔╝
 ██║   ██║██╔████╔██║██████╔╝██████╔╝██║ ╚███╔╝ 
 ██║   ██║██║╚██╔╝██║██╔══██╗██╔══██╗██║ ██╔██╗ 
 ╚██████╔╝██║ ╚═╝ ██║██████╔╝██║  ██║██║██╔╝ ██╗
  ╚═════╝ ╚═╝     ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝
  OMBRIX CLI v${VERSION} — Zero-Telemetry Forensic Steganography Suite

USAGE:
  ombrix <command> [options]

COMMANDS:
  embed <carrierPath> [options]       Embed a message or file into a carrier PNG
  extract <stegoPath> [options]       Extract hidden message from a stego PNG
  scan <imagePath> [options]          Run multi-detector forensic steganalysis
  inspect <imagePath>                 Analyze carrier capacity across 7 algorithms
  benchmark <carrierPath> [options]   Compare algorithms on carrier (PSNR, MSE, SSIM)
  keygen [diceware|crypto32|keypair]  Generate cryptographic passkeys or keypairs
  mcp <install|show|run> [target]     AI Agent Model Context Protocol (MCP) commands
  experiment <carrierPath> [options]  Generate Section 16.5 Reproducibility Record
  verify <stegoPath>                  Verify carrier integrity and OMB1 envelope
  version, --version, -v              Print OMBRIX CLI version
  help, --help, -h                    Display this help guide

EMBED OPTIONS:
  -p, --payload <text>        Plaintext string to hide
  -f, --file <filePath>       File to read payload from
  -k, --passkey <key>         Argon2id + XChaCha20-Poly1305 symmetric passkey
  -m, --method <name>         Algorithm: hyper-matrix (default), robust, lsb, matching, pvd, dwt, dct
  -o, --output <path>         Output stego PNG path
  --recipient-key <key>       X25519 public key (Base64) for authenticated encryption
  --signing-key <key>         Ed25519 private key (Base64) for detached digital signature

EXTRACT OPTIONS:
  -k, --passkey <key>         Secret passkey if payload is Argon2id encrypted
  -o, --output <path>         Write extracted payload to file (default: stdout)
  -m, --method <name>         Algorithm (or auto for smart detection)
  --recipient-key <key>       X25519 private key (Base64) for payload decryption
  --sender-key <key>          Ed25519 public key (Base64) to verify signature

MCP COMMANDS:
  mcp install [client]        Auto-detect & register MCP server with Claude Desktop, Cursor, etc.
  mcp show                    Print MCP configuration JSON blocks for all clients
  mcp run                     Start stdio MCP server for direct AI agent integration

SCAN OPTIONS:
  --json                      Output raw JSON forensics report
`;

function resolveMethod(name?: string): StegoMethod {
  switch (name?.toLowerCase()) {
    case 'hyper-matrix':
    case 'hypermatrix':
      return hyperMatrixMethod;
    case 'robust-resilient':
    case 'robust':
      return robustResilientStego;
    case 'matching':
      return pngLsbMatching;
    case 'pvd':
      return pvdStego;
    case 'dwt':
      return haarDwtStego;
    case 'dct':
      return jpegDctStego;
    default:
      return pngLsbSequential;
  }
}

export async function runCli(args: string[]): Promise<CliResult> {
  let stdout = '';
  let stderr = '';

  const log = (msg: string) => {
    stdout += `${msg}\n`;
  };
  const err = (msg: string) => {
    stderr += `${msg}\n`;
  };

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    log(HELP_BANNER);
    return { exitCode: 0, stdout, stderr };
  }

  if (args[0] === 'version' || args[0] === '--version' || args[0] === '-v') {
    log(`OMBRIX CLI v${VERSION}`);
    return { exitCode: 0, stdout, stderr };
  }

  const command = args[0];
  const cmdArgs = args.slice(1);

  try {
    switch (command) {
      case 'embed': {
        const carrierPath = cmdArgs[0];
        if (!carrierPath || carrierPath.startsWith('-')) {
          err('Error: Missing <carrierPath> for embed command');
          return { exitCode: 1, stdout, stderr };
        }

        let payloadStr: string | undefined;
        let filePath: string | undefined;
        let methodStr = 'lsb';
        let outputPath: string | undefined;
        let passkey: string | undefined;
        let recipientKey: string | undefined;
        let signingKey: string | undefined;

        for (let i = 1; i < cmdArgs.length; i++) {
          const arg = cmdArgs[i];
          if ((arg === '-p' || arg === '--payload') && i + 1 < cmdArgs.length) {
            payloadStr = cmdArgs[++i];
          } else if ((arg === '-f' || arg === '--file') && i + 1 < cmdArgs.length) {
            filePath = cmdArgs[++i];
          } else if ((arg === '-k' || arg === '--passkey') && i + 1 < cmdArgs.length) {
            passkey = cmdArgs[++i];
          } else if ((arg === '-m' || arg === '--method') && i + 1 < cmdArgs.length) {
            methodStr = cmdArgs[++i] ?? 'lsb';
          } else if ((arg === '-o' || arg === '--output') && i + 1 < cmdArgs.length) {
            outputPath = cmdArgs[++i];
          } else if (arg === '--recipient-key' && i + 1 < cmdArgs.length) {
            recipientKey = cmdArgs[++i];
          } else if (arg === '--signing-key' && i + 1 < cmdArgs.length) {
            signingKey = cmdArgs[++i];
          }
        }

        let payloadBytes: Uint8Array;
        if (filePath) {
          payloadBytes = new Uint8Array(fs.readFileSync(filePath));
        } else if (payloadStr !== undefined) {
          payloadBytes = new TextEncoder().encode(payloadStr);
        } else {
          err('Error: Must provide payload via -p/--payload or -f/--file');
          return { exitCode: 1, stdout, stderr };
        }

        if (passkey) {
          await initCrypto();
          payloadBytes = encryptWithPasskey(payloadBytes, passkey);
        }

        const carrierBytes = new Uint8Array(fs.readFileSync(carrierPath));
        const carrier = decodePng(carrierBytes);

        let stegoCarrier = carrier;
        const normMethod = methodStr.toLowerCase();
        if (normMethod === 'hyper-matrix' || normMethod === 'hypermatrix') {
          stegoCarrier = await hyperMatrixMethod.embed(carrier, payloadBytes);
        } else if (normMethod === 'robust-resilient' || normMethod === 'robust') {
          stegoCarrier = await robustResilientStego.embed(carrier, payloadBytes);
        } else if (normMethod === 'pvd') {
          stegoCarrier = await Ombrix.embedPvd(carrier, payloadBytes);
        } else if (normMethod === 'dwt') {
          stegoCarrier = await Ombrix.embedDwt(carrier, payloadBytes);
        } else if (normMethod === 'dct') {
          stegoCarrier = await Ombrix.embedDct(carrier, payloadBytes);
        } else if (normMethod === 'lsb') {
          stegoCarrier = await Ombrix.embed(carrier, payloadBytes, {
            recipientPublicKey: recipientKey,
            signingPrivateKey: signingKey,
          });
        } else {
          const method = resolveMethod(methodStr);
          stegoCarrier = await method.embed(carrier, payloadBytes);
        }

        const outPng = encodePng(stegoCarrier);
        const resolvedOut =
          outputPath ??
          path.join(
            path.dirname(carrierPath),
            `${path.basename(carrierPath, path.extname(carrierPath))}-stego.png`,
          );
        fs.writeFileSync(resolvedOut, outPng);

        const lab = await Ombrix.benchmark(carrier, payloadBytes);
        const methodBench = lab.find((b) => b.methodId.includes(methodStr)) ?? lab[0];

        log('\x1b[32m✔ Payload embedded successfully\x1b[0m');
        log(`  Carrier:    ${carrierPath} (${carrier.width}x${carrier.height} px)`);
        log(`  Payload:    ${payloadBytes.length} bytes`);
        if (passkey) {
          log('  Encryption: Argon2id KDF + XChaCha20-Poly1305 (Passkey-protected)');
        }
        log(`  Algorithm:  ${methodStr.toUpperCase()}`);
        if (methodBench) {
          log(`  PSNR:       ${methodBench.distortion.psnr.toFixed(2)} dB`);
          log(`  SSIM:       ${methodBench.distortion.ssim.toFixed(4)}`);
        }
        log(`  Output:     ${resolvedOut}`);
        return { exitCode: 0, stdout, stderr };
      }

      case 'extract': {
        const stegoPath = cmdArgs[0];
        if (!stegoPath || stegoPath.startsWith('-')) {
          err('Error: Missing <stegoPath> for extract command');
          return { exitCode: 1, stdout, stderr };
        }

        let outputPath: string | undefined;
        let methodStr: string | undefined;
        let passkey: string | undefined;
        let recipientKey: string | undefined;
        let senderKey: string | undefined;

        for (let i = 1; i < cmdArgs.length; i++) {
          const arg = cmdArgs[i];
          if ((arg === '-o' || arg === '--output') && i + 1 < cmdArgs.length) {
            outputPath = cmdArgs[++i];
          } else if ((arg === '-m' || arg === '--method') && i + 1 < cmdArgs.length) {
            methodStr = cmdArgs[++i];
          } else if ((arg === '-k' || arg === '--passkey') && i + 1 < cmdArgs.length) {
            passkey = cmdArgs[++i];
          } else if (arg === '--recipient-key' && i + 1 < cmdArgs.length) {
            recipientKey = cmdArgs[++i];
          } else if (arg === '--sender-key' && i + 1 < cmdArgs.length) {
            senderKey = cmdArgs[++i];
          }
        }

        const stegoBytes = new Uint8Array(fs.readFileSync(stegoPath));
        const stegoCarrier = decodePng(stegoBytes);

        let extractedBytes: Uint8Array;
        let isEncrypted = false;
        let isSigned = false;
        let signatureVerified = false;

        const normMethod = methodStr?.toLowerCase();
        if (normMethod === 'hyper-matrix' || normMethod === 'hypermatrix') {
          extractedBytes = await hyperMatrixMethod.extract(stegoCarrier);
        } else if (normMethod === 'robust-resilient' || normMethod === 'robust') {
          extractedBytes = await robustResilientStego.extract(stegoCarrier);
        } else if (normMethod === 'pvd') {
          extractedBytes = await Ombrix.extractPvd(stegoCarrier);
        } else if (normMethod === 'dwt') {
          extractedBytes = await Ombrix.extractDwt(stegoCarrier);
        } else if (normMethod === 'dct') {
          extractedBytes = await Ombrix.extractDct(stegoCarrier);
        } else if (normMethod === 'matching') {
          extractedBytes = await pngLsbMatching.extract(stegoCarrier);
        } else if (normMethod === 'lsb') {
          const res = await Ombrix.extract(stegoCarrier, {
            recipientPrivateKey: recipientKey,
            senderSigningPublicKey: senderKey,
          });
          extractedBytes = res.payload;
          isEncrypted = res.isEncrypted;
          isSigned = res.isSigned;
          signatureVerified = res.signatureVerified ?? false;
        } else {
          // Auto-detection: try hyper-matrix first, then fallback to Ombrix.extract
          try {
            extractedBytes = await hyperMatrixMethod.extract(stegoCarrier);
          } catch {
            const res = await Ombrix.extract(stegoCarrier, {
              recipientPrivateKey: recipientKey,
              senderSigningPublicKey: senderKey,
            });
            extractedBytes = res.payload;
            isEncrypted = res.isEncrypted;
            isSigned = res.isSigned;
            signatureVerified = res.signatureVerified ?? false;
          }
        }

        // Passkey decryption check
        if (isPasskeyEncrypted(extractedBytes)) {
          if (!passkey) {
            err('\x1b[31m[Passkey Required]\x1b[0m Payload is protected with an Argon2id passkey.');
            err('Please supply the secret passkey with -k / --passkey <passkey>');
            return { exitCode: 1, stdout, stderr };
          }
          await initCrypto();
          extractedBytes = decryptWithPasskey(extractedBytes, passkey);
          log('\x1b[36m[Security]\x1b[0m Payload decrypted via Argon2id + XChaCha20-Poly1305');
        }

        if (outputPath) {
          fs.writeFileSync(outputPath, extractedBytes);
          log(
            `\x1b[32m✔ Payload extracted to ${outputPath}\x1b[0m (${extractedBytes.length} bytes)`,
          );
        } else {
          const text = new TextDecoder().decode(extractedBytes);
          log(text);
        }

        if (isEncrypted) {
          log('\x1b[36m[Security]\x1b[0m Payload decrypted via Curve25519/Poly1305');
        }
        if (isSigned) {
          log(
            signatureVerified
              ? '\x1b[32m[Signature]\x1b[0m Ed25519 digital signature verified'
              : '\x1b[31m[Signature]\x1b[0m Ed25519 signature NOT verified',
          );
        }

        return { exitCode: 0, stdout, stderr };
      }

      case 'scan': {
        const imagePath = cmdArgs[0];
        if (!imagePath || imagePath.startsWith('-')) {
          err('Error: Missing <imagePath> for scan command');
          return { exitCode: 1, stdout, stderr };
        }

        const isJson = cmdArgs.includes('--json');
        const imgBytes = new Uint8Array(fs.readFileSync(imagePath));
        const carrier = decodePng(imgBytes);

        const report: ForensicsConsensusReport = Ombrix.scan(carrier);

        if (isJson) {
          log(JSON.stringify(report, null, 2));
        } else {
          log('\n\x1b[1mOMBRIX Multi-Detector Steganalysis Report\x1b[0m');
          log(`Image: ${imagePath} (${carrier.width}x${carrier.height} px)\n`);
          log(`  Overall Verdict:       \x1b[1m${report.verdict}\x1b[0m`);
          log(`  Anomaly Score:         ${(report.overallAnomalyScore * 100).toFixed(1)}%`);
          log(`  Confidence:            ${(report.confidence * 100).toFixed(1)}%\n`);
          log('\x1b[1mDETECTOR METRICS:\x1b[0m');
          log(
            `  Fridrich RS Steg:      ${(report.detectors.rs.estimatedPayloadRatio * 100).toFixed(1)}% est. payload`,
          );
          log(
            `  Sample Pair Analysis:  ${(report.detectors.spa.estimatedPayloadRatio * 100).toFixed(1)}% est. payload`,
          );
          log(`  Chi-Square (PoVs):     p = ${report.detectors.chiSquare.pValue.toExponential(3)}`);
          log(
            `  Laplacian Residual:    var = ${report.detectors.noiseResidual.variance.toFixed(4)}`,
          );
        }

        return { exitCode: 0, stdout, stderr };
      }

      case 'inspect': {
        const imgPath = cmdArgs[0];
        if (!imgPath || imgPath.startsWith('-')) {
          err('Error: Missing <imagePath> for inspect command');
          return { exitCode: 1, stdout, stderr };
        }

        const bytes = new Uint8Array(fs.readFileSync(imgPath));
        const carrier = decodePng(bytes);
        const totalPixels = carrier.width * carrier.height;
        const lsbCap = Math.floor((totalPixels * 3) / 8);
        const hyperCap = Math.floor(lsbCap * 0.75);
        const dwtCap = Math.floor(totalPixels / 4 / 8);
        const pvdCap = Math.floor(totalPixels / 2);

        log('\n\x1b[1mOMBRIX Carrier Image Inspection\x1b[0m');
        log(`  File:        ${imgPath}`);
        log(
          `  Dimensions:  ${carrier.width} × ${carrier.height} pixels (${totalPixels.toLocaleString()} total)`,
        );
        log('  Channels:    RGBA (3 color planes, 1 alpha)');
        log('\n\x1b[1mPayload Capacities Across Steganographic Algorithms:\x1b[0m');
        log(
          `  • Universal Hyper-Matrix (Optimal):   ~${hyperCap.toLocaleString()} bytes (${(hyperCap / 1024).toFixed(1)} KB)`,
        );
        log(
          `  • Robust Resilient (Error-Corrected): ~${Math.floor(lsbCap * 0.33).toLocaleString()} bytes`,
        );
        log(
          `  • Sequential LSB (1 bpp):              ~${lsbCap.toLocaleString()} bytes (${(lsbCap / 1024).toFixed(1)} KB)`,
        );
        log(`  • LSB Matching (±1 Embedding):         ~${lsbCap.toLocaleString()} bytes`);
        log(`  • Pixel Value Differencing (PVD):      ~${pvdCap.toLocaleString()} bytes`);
        log(`  • Wavelet Transform (DWT Haar):        ~${dwtCap.toLocaleString()} bytes\n`);
        return { exitCode: 0, stdout, stderr };
      }

      case 'keygen': {
        const sub = cmdArgs[0] ?? 'diceware';
        await initCrypto();

        if (sub === 'crypto32' || sub === 'hex' || sub === 'token') {
          const token = generateRandomPasskey32('formatted');
          log('\n\x1b[1mOMBRIX 32-Byte Cryptographic Token\x1b[0m (256-bit entropy)');
          log(`  Token:   \x1b[32m${token}\x1b[0m`);
          log(`  Hex:     ${token.replace(/-/g, '').toLowerCase()}`);
          log('  Usage:   ombrix embed carrier.png -p "secret" -k <token>\n');
        } else if (sub === 'keypair' || sub === 'x25519') {
          const kp = generateEncryptionKeyPair();
          const pubB64 = Buffer.from(kp.publicKey).toString('base64');
          const privB64 = Buffer.from(kp.privateKey).toString('base64');
          log('\n\x1b[1mOMBRIX Curve25519 Keypair\x1b[0m (Asymmetric Sealed Box)');
          log(`  Public Key:   \x1b[32m${pubB64}\x1b[0m`);
          log(`  Private Key:  \x1b[33m${privB64}\x1b[0m (KEEP SECRET)`);
          log('  Usage:        ombrix embed carrier.png -p "msg" --recipient-key <publicKey>\n');
        } else if (sub === 'signing' || sub === 'ed25519') {
          const kp = generateSigningKeyPair();
          const pubB64 = Buffer.from(kp.publicKey).toString('base64');
          const privB64 = Buffer.from(kp.privateKey).toString('base64');
          log('\n\x1b[1mOMBRIX Ed25519 Signature Keypair\x1b[0m (Cryptographic Provenance)');
          log(`  Public Key:   \x1b[32m${pubB64}\x1b[0m`);
          log(`  Private Key:  \x1b[33m${privB64}\x1b[0m (KEEP SECRET)`);
          log('  Usage:        ombrix embed carrier.png -p "msg" --signing-key <privateKey>\n');
        } else {
          // diceware
          let words = 4;
          if (cmdArgs[1]) {
            const parsed = Number.parseInt(cmdArgs[1], 10);
            if (!Number.isNaN(parsed) && parsed >= 3 && parsed <= 12) words = parsed;
          }
          const phrase = generateDicewarePassphrase(words, '-');
          log(
            `\n\x1b[1mOMBRIX Diceware Passphrase\x1b[0m (${words} words, ~${(words * 12.92).toFixed(1)} bits entropy)`,
          );
          log(`  Passphrase: \x1b[32m${phrase}\x1b[0m`);
          log('  Usage:      ombrix embed carrier.png -p "secret" -k <passphrase>\n');
        }
        return { exitCode: 0, stdout, stderr };
      }

      case 'mcp': {
        const sub = cmdArgs[0] ?? 'install';

        if (sub === 'run') {
          startMcpServer();
          return { exitCode: 0, stdout, stderr };
        }

        if (sub === 'show') {
          log('\n\x1b[1mOMBRIX MCP Server Configurations\x1b[0m');
          log('Use these configuration snippets in your AI assistant:\n');
          log('\x1b[36mClaude Desktop (~/.config/Claude/claude_desktop_config.json):\x1b[0m');
          log(
            JSON.stringify(
              {
                mcpServers: {
                  ombrix: {
                    command: 'npx',
                    args: ['-y', '@ombrix/mcp-server'],
                  },
                },
              },
              null,
              2,
            ),
          );
          log('\n\x1b[36mCursor IDE (~/.cursor/mcp.json):\x1b[0m');
          log(
            JSON.stringify(
              {
                mcpServers: {
                  ombrix: {
                    command: 'npx',
                    args: ['-y', '@ombrix/mcp-server'],
                  },
                },
              },
              null,
              2,
            ),
          );
          log('\n\x1b[36mGoogle Antigravity (~/.gemini/antigravity/mcp_config.json):\x1b[0m');
          log(
            JSON.stringify(
              {
                mcpServers: {
                  ombrix: {
                    command: 'npx',
                    args: ['-y', '@ombrix/mcp-server'],
                  },
                },
              },
              null,
              2,
            ),
          );
          return { exitCode: 0, stdout, stderr };
        }

        if (sub === 'install' || sub === 'setup') {
          const targets = getMcpClientTargets();
          const explicitTarget = cmdArgs[1];

          log('\n\x1b[1m╔════════════════════════════════════════════════════════════╗\x1b[0m');
          log('\x1b[1m║   OMBRIX Model Context Protocol (MCP) Client Installer    ║\x1b[0m');
          log('\x1b[1m╚════════════════════════════════════════════════════════════╝\x1b[0m\n');

          let selectedTargets: typeof targets = [];

          if (explicitTarget) {
            const match = targets.find(
              (t) =>
                t.id.toLowerCase() === explicitTarget.toLowerCase() ||
                t.name.toLowerCase().includes(explicitTarget.toLowerCase()),
            );
            if (!match) {
              err(
                `Unknown client target: "${explicitTarget}". Available: ${targets.map((t) => t.id).join(', ')}`,
              );
              return { exitCode: 1, stdout, stderr };
            }
            selectedTargets = [match];
          } else {
            log('Detected AI Assistants on this system:');
            targets.forEach((t, idx) => {
              const status = t.detected
                ? '\x1b[32m✔ DETECTED\x1b[0m'
                : '\x1b[90m(not found)\x1b[0m';
              log(`  [${idx + 1}] ${t.name.padEnd(20)} ${status}  (${t.configPath})`);
            });
            log('  [A] All detected clients');
            log('  [Q] Cancel / Quit\n');

            if (process.stdin.isTTY) {
              const choice = await promptUser(
                'Which client would you like to configure? (Enter number, "A" for all, or "Q" to quit): ',
              );
              const trimmed = choice.trim().toUpperCase();

              if (trimmed === 'Q') {
                log('Installation cancelled.');
                return { exitCode: 0, stdout, stderr };
              }
              if (trimmed === 'A') {
                selectedTargets = targets.filter((t) => t.detected);
                if (selectedTargets.length === 0) {
                  selectedTargets = targets;
                }
              } else {
                const num = Number.parseInt(trimmed, 10);
                if (!Number.isNaN(num) && num >= 1 && num <= targets.length) {
                  selectedTargets = [targets[num - 1]!];
                } else {
                  err(`Invalid choice: ${choice}`);
                  return { exitCode: 1, stdout, stderr };
                }
              }
            } else {
              // Non-interactive fallback
              selectedTargets = targets.filter((t) => t.detected);
              if (selectedTargets.length === 0) {
                selectedTargets = [targets[0]!];
              }
            }
          }

          log('\nInstalling OMBRIX MCP Server...');
          for (const target of selectedTargets) {
            const result = installMcpToClient(target);
            if (result.success) {
              log(`\x1b[32m✔\x1b[0m Configured \x1b[1m${target.name}\x1b[0m`);
              log(`  Path: ${target.configPath}`);
              if (result.backupPath) {
                log(`  Backup: ${result.backupPath}`);
              }
            } else {
              log(
                `\x1b[31m✖\x1b[0m Failed to configure \x1b[1m${target.name}\x1b[0m: ${result.message}`,
              );
            }
          }

          log('\n\x1b[32m✔ Installation complete!\x1b[0m');
          log('Restart your AI assistant to activate the OMBRIX steganography tools:\n');
          log('  • stego_embed      — Conceal secrets into images with optional Argon2id passkeys');
          log('  • stego_extract    — Decrypt & extract hidden payloads with auto-detection');
          log(
            '  • stego_scan       — Multi-detector forensic steganalysis (RS, SPA, Chi-Sq, Laplacian)',
          );
          log('  • stego_inspect    — Analyze carrier capacity across 7 algorithms');
          log('  • stego_keygen     — Generate Diceware, 32-byte tokens, X25519/Ed25519 keypairs');
          log('  • stego_benchmark  — Compute PSNR, MSE, SSIM image quality metrics\n');
          return { exitCode: 0, stdout, stderr };
        }

        err(`Unknown mcp subcommand: '${sub}'. Usage: ombrix mcp <install|show|run>`);
        return { exitCode: 1, stdout, stderr };
      }

      case 'benchmark': {
        const carrierPath = cmdArgs[0];
        if (!carrierPath || carrierPath.startsWith('-')) {
          err('Error: Missing <carrierPath> for benchmark command');
          return { exitCode: 1, stdout, stderr };
        }

        const isJson = cmdArgs.includes('--json');
        let payloadStr = 'Benchmark test payload for OMBRIX algorithm matrix';
        for (let i = 1; i < cmdArgs.length; i++) {
          if ((cmdArgs[i] === '-p' || cmdArgs[i] === '--payload') && i + 1 < cmdArgs.length) {
            payloadStr = cmdArgs[++i] ?? payloadStr;
          }
        }

        const carrierBytes = new Uint8Array(fs.readFileSync(carrierPath));
        const carrier = decodePng(carrierBytes);
        const payloadBytes = new TextEncoder().encode(payloadStr);

        const results = await Ombrix.benchmark(carrier, payloadBytes);

        if (isJson) {
          log(JSON.stringify(results, null, 2));
        } else {
          log('\n\x1b[1mOMBRIX Algorithm Benchmark Matrix\x1b[0m');
          log(`Carrier: ${carrierPath} (${carrier.width}x${carrier.height})\n`);
          log('Method                 PSNR (dB)   SSIM     MSE      Alter%  AlterMax');
          log('---------------------------------------------------------------------');
          const totalChannels = carrier.width * carrier.height * 3;
          for (const r of results) {
            const m = r.methodName.padEnd(22);
            const psnr = r.distortion.psnr.toFixed(2).padStart(9);
            const ssim = r.distortion.ssim.toFixed(4).padStart(8);
            const mse = r.distortion.mse.toFixed(4).padStart(8);
            const alterPct = (
              ((r.distortion.totalAlteredChannels ?? 0) / (totalChannels || 1)) *
              100
            )
              .toFixed(1)
              .padStart(7);
            const alterMax = String(r.distortion.maxChannelDiff ?? 0).padStart(8);
            log(`${m} ${psnr} ${ssim} ${mse} ${alterPct}% ${alterMax}`);
          }
        }

        return { exitCode: 0, stdout, stderr };
      }

      case 'experiment': {
        const carrierPath = cmdArgs[0];
        if (!carrierPath || carrierPath.startsWith('-')) {
          err('Error: Missing <carrierPath> for experiment command');
          return { exitCode: 1, stdout, stderr };
        }

        let payloadStr = 'OMBRIX Standard Section 16.5 Experiment';
        let methodStr = 'lsb';
        let outputPath: string | undefined;
        let isJson = false;

        for (let i = 1; i < cmdArgs.length; i++) {
          const arg = cmdArgs[i];
          if ((arg === '-p' || arg === '--payload') && i + 1 < cmdArgs.length) {
            payloadStr = cmdArgs[++i] ?? payloadStr;
          } else if ((arg === '-m' || arg === '--method') && i + 1 < cmdArgs.length) {
            methodStr = cmdArgs[++i] ?? 'lsb';
          } else if ((arg === '-o' || arg === '--output') && i + 1 < cmdArgs.length) {
            outputPath = cmdArgs[++i];
          } else if (arg === '--json') {
            isJson = true;
          }
        }

        const carrierBytes = new Uint8Array(fs.readFileSync(carrierPath));
        const carrier = decodePng(carrierBytes);
        const payloadBytes = new TextEncoder().encode(payloadStr);
        const method = resolveMethod(methodStr);

        const exp = await Ombrix.runExperiment(carrier, payloadBytes, method, {
          title: `CLI Experiment: ${method.name}`,
          description: `Generated via OMBRIX CLI on ${carrierPath}`,
          author: 'OMBRIX CLI User',
        });

        const jsonOut = Ombrix.serializeExperiment(exp);

        if (outputPath) {
          fs.writeFileSync(outputPath, jsonOut);
          log(`\x1b[32m✔ Experiment record saved to ${outputPath}\x1b[0m`);
        } else if (isJson) {
          log(jsonOut);
        } else {
          const defaultOut = `${path.basename(carrierPath, path.extname(carrierPath))}.ombrix-experiment.json`;
          fs.writeFileSync(defaultOut, jsonOut);
          log(`\x1b[32m✔ Experiment record generated:\x1b[0m ${defaultOut}`);
          log(`  Experiment ID: ${exp.experimentId}`);
          log(`  PSNR:          ${exp.metrics.distortion.psnr.toFixed(2)} dB`);
          log(`  Forensics:     ${exp.forensics.consensusVerdict}`);
        }

        return { exitCode: 0, stdout, stderr };
      }

      case 'verify': {
        const stegoPath = cmdArgs[0];
        if (!stegoPath || stegoPath.startsWith('-')) {
          err('Error: Missing <stegoPath> for verify command');
          return { exitCode: 1, stdout, stderr };
        }

        const stegoBytes = new Uint8Array(fs.readFileSync(stegoPath));
        const carrier = decodePng(stegoBytes);

        try {
          const extracted = await Ombrix.extract(carrier);
          log('\x1b[32m✔ Verified OMB1 steganographic container\x1b[0m');
          log(`  Payload size: ${extracted.payload.length} bytes`);
          log(`  Encrypted:    ${extracted.isEncrypted}`);
          log(`  Signed:       ${extracted.isSigned}`);
          return { exitCode: 0, stdout, stderr };
        } catch {
          log('\x1b[33mℹ Carrier is clean or contains no detectable OMB1 envelope\x1b[0m');
          return { exitCode: 0, stdout, stderr };
        }
      }

      default:
        err(`Unknown command: '${command}'. Run 'ombrix help' for available commands.`);
        return { exitCode: 1, stdout, stderr };
    }
  } catch (e) {
    err(`Execution error: ${(e as Error).message}`);
    return { exitCode: 1, stdout, stderr };
  }
}
