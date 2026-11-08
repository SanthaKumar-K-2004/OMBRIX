import * as fs from 'node:fs';
import * as path from 'node:path';
import { Ombrix, type StegoMethod } from '@ombrix/edge-sdk';
import { haarDwtStego, jpegDctStego, pvdStego } from '@ombrix/stego-advanced';
import type { ForensicsConsensusReport } from '@ombrix/stego-forensics';
import { pngLsbMatching } from '@ombrix/stego-lab';
import { pngLsbSequential } from '@ombrix/stego-png-lsb';
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
  benchmark <carrierPath> [options]   Compare algorithms on carrier (PSNR, MSE, SSIM)
  experiment <carrierPath> [options]  Generate Section 16.5 Reproducibility Record
  verify <stegoPath>                  Verify carrier integrity and OMB1 envelope
  version, --version, -v              Print OMBRIX CLI version
  help, --help, -h                    Display this help guide

EMBED OPTIONS:
  -p, --payload <text>        Plaintext string to hide
  -f, --file <filePath>       File to read payload from
  -m, --method <name>         Algorithm: lsb (default), matching, pvd, dwt, dct
  -o, --output <path>         Output stego PNG path
  --recipient-key <key>       X25519 public key (Base64) for authenticated encryption
  --signing-key <key>         Ed25519 private key (Base64) for detached digital signature

EXTRACT OPTIONS:
  -o, --output <path>         Write extracted payload to file (default: stdout)
  -m, --method <name>         Algorithm (if raw embedding used)
  --recipient-key <key>       X25519 private key (Base64) for payload decryption
  --sender-key <key>          Ed25519 public key (Base64) to verify signature

SCAN OPTIONS:
  --json                      Output raw JSON forensics report
`;

function resolveMethod(name?: string): StegoMethod {
  switch (name?.toLowerCase()) {
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
        let recipientKey: string | undefined;
        let signingKey: string | undefined;

        for (let i = 1; i < cmdArgs.length; i++) {
          const arg = cmdArgs[i];
          if ((arg === '-p' || arg === '--payload') && i + 1 < cmdArgs.length) {
            payloadStr = cmdArgs[++i];
          } else if ((arg === '-f' || arg === '--file') && i + 1 < cmdArgs.length) {
            filePath = cmdArgs[++i];
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

        const carrierBytes = new Uint8Array(fs.readFileSync(carrierPath));
        const carrier = decodePng(carrierBytes);

        let stegoCarrier = carrier;
        if (methodStr === 'lsb') {
          stegoCarrier = await Ombrix.embed(carrier, payloadBytes, {
            recipientPublicKey: recipientKey,
            signingPrivateKey: signingKey,
          });
        } else if (methodStr === 'pvd') {
          stegoCarrier = await Ombrix.embedPvd(carrier, payloadBytes);
        } else if (methodStr === 'dwt') {
          stegoCarrier = await Ombrix.embedDwt(carrier, payloadBytes);
        } else if (methodStr === 'dct') {
          stegoCarrier = await Ombrix.embedDct(carrier, payloadBytes);
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
        let recipientKey: string | undefined;
        let senderKey: string | undefined;

        for (let i = 1; i < cmdArgs.length; i++) {
          const arg = cmdArgs[i];
          if ((arg === '-o' || arg === '--output') && i + 1 < cmdArgs.length) {
            outputPath = cmdArgs[++i];
          } else if ((arg === '-m' || arg === '--method') && i + 1 < cmdArgs.length) {
            methodStr = cmdArgs[++i];
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

        if (methodStr === 'pvd') {
          extractedBytes = await Ombrix.extractPvd(stegoCarrier);
        } else if (methodStr === 'dwt') {
          extractedBytes = await Ombrix.extractDwt(stegoCarrier);
        } else if (methodStr === 'dct') {
          extractedBytes = await Ombrix.extractDct(stegoCarrier);
        } else {
          const res = await Ombrix.extract(stegoCarrier, {
            recipientPrivateKey: recipientKey,
            senderSigningPublicKey: senderKey,
          });
          extractedBytes = res.payload;
          isEncrypted = res.isEncrypted;
          isSigned = res.isSigned;
          signatureVerified = res.signatureVerified ?? false;
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
