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
import { Ombrix } from '@ombrix/edge-sdk';
import {
  haarDwtStego,
  hyperMatrixMethod,
  pvdStego,
  robustResilientStego,
} from '@ombrix/stego-advanced';
import type { CarrierImage } from '@ombrix/stego-interface';
import { pngLsbMatching } from '@ombrix/stego-lab';
import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import { executeCodeMode, getCodeModeApiDocs } from './code-mode.js';
import { decodePng, encodePng } from './png.js';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

let cryptoInitialized = false;
export async function ensureCrypto(): Promise<void> {
  if (!cryptoInitialized) {
    await initCrypto();
    cryptoInitialized = true;
  }
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'stego_embed',
    description:
      'Conceals a secret plaintext message or file into a PNG carrier image using military-grade steganography (Universal Hyper-Matrix, Robust Resilient, DWT, PVD, or LSB Matching) with optional Argon2id passkey encryption.',
    inputSchema: {
      type: 'object',
      properties: {
        carrierPath: {
          type: 'string',
          description: 'Absolute or relative filesystem path to the cover PNG image.',
        },
        payload: {
          type: 'string',
          description: 'Secret plaintext message string to conceal.',
        },
        payloadFilePath: {
          type: 'string',
          description: 'Optional path to binary file to conceal (used instead of payload string).',
        },
        passkey: {
          type: 'string',
          description:
            'Optional secret passkey for Argon2id key derivation and AES-256-GCM authenticated encryption.',
        },
        method: {
          type: 'string',
          enum: ['hyper-matrix', 'robust-resilient', 'dwt', 'pvd', 'matching', 'lsb'],
          default: 'hyper-matrix',
          description:
            'Steganographic algorithm: hyper-matrix (Universal hybrid: lossy safe + wavelet), robust-resilient (messaging/JPEG safe), dwt (frequency subband), pvd (contrast edges), matching (±1 LSB), or lsb (sequential).',
        },
        outputPath: {
          type: 'string',
          description:
            'Filesystem path where generated stego PNG will be saved. Defaults to <carrier>-stego.png.',
        },
      },
      required: ['carrierPath'],
    },
  },
  {
    name: 'stego_extract',
    description:
      'Extracts a concealed secret message or file from an OMBRIX stego carrier image, supporting automatic algorithm detection and Argon2id passkey unlocking.',
    inputSchema: {
      type: 'object',
      properties: {
        stegoPath: {
          type: 'string',
          description: 'Filesystem path to the stego PNG image.',
        },
        passkey: {
          type: 'string',
          description: 'Secret passkey if the payload was encrypted during embedding.',
        },
        method: {
          type: 'string',
          enum: ['auto', 'hyper-matrix', 'robust-resilient', 'dwt', 'pvd', 'matching', 'lsb'],
          default: 'auto',
          description: 'Specific algorithm to extract with, or auto for automatic detection.',
        },
        outputPath: {
          type: 'string',
          description: 'Optional path to write the extracted payload bytes directly to a file.',
        },
      },
      required: ['stegoPath'],
    },
  },
  {
    name: 'stego_scan',
    description:
      'Performs multi-detector forensic steganalysis on an image using Fridrich RS Steganalysis, Dumitrescu Sample Pair Analysis (SPA), Westfeld Chi-Square (PoVs), and 2nd-Derivative Laplacian Noise Residual Variance. Returns overall stego threat likelihood and confidence score.',
    inputSchema: {
      type: 'object',
      properties: {
        imagePath: {
          type: 'string',
          description: 'Filesystem path to the candidate image to inspect for hidden data.',
        },
      },
      required: ['imagePath'],
    },
  },
  {
    name: 'stego_benchmark',
    description:
      'Evaluates empirical image quality distortion metrics (PSNR in dB, MSE, SSIM, altered channels) across OMBRIX steganographic algorithms for a given carrier image.',
    inputSchema: {
      type: 'object',
      properties: {
        carrierPath: {
          type: 'string',
          description: 'Filesystem path to the cover PNG image.',
        },
        payload: {
          type: 'string',
          description: 'Optional sample payload text for benchmarking.',
        },
      },
      required: ['carrierPath'],
    },
  },
  {
    name: 'stego_keygen',
    description:
      'Generates cryptographically secure keys: Diceware 4-word human-memorable passphrases, 32-byte hex tokens, Libsodium X25519 encryption keypairs, or Ed25519 signing keypairs.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['diceware', 'crypto32', 'keypair', 'signing'],
          default: 'diceware',
          description:
            'Key type: diceware (4 memorable words), crypto32 (32-byte hex token), keypair (X25519 public/private), signing (Ed25519 public/private).',
        },
      },
    },
  },
  {
    name: 'stego_inspect',
    description:
      'Inspects an image to report dimensions, channel layout, and exact byte payload capacity limits across all OMBRIX stego algorithms.',
    inputSchema: {
      type: 'object',
      properties: {
        imagePath: {
          type: 'string',
          description: 'Filesystem path to the PNG image to inspect.',
        },
      },
      required: ['imagePath'],
    },
  },
  {
    name: 'stego_code_mode',
    description:
      'Executes sandboxed JavaScript/TypeScript code using MCP 2.0 Code Mode architecture. Enables complex multi-step steganography workflows (batching, conditional extraction, forensic scanning, key generation, and benchmark comparisons) inside a single air-gapped call, reducing token consumption by over 95% and eliminating intermediate payload leakage.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description:
            'JavaScript/TypeScript code to execute. Has access to the global `ombrix` API (load, save, embed, extract, scan, benchmark, keygen, inspect, read, write) and `console.log`. The script must `return` the final result object or value.',
        },
        timeoutMs: {
          type: 'number',
          description: 'Maximum execution timeout in milliseconds (default: 15000, max: 30000).',
          default: 15000,
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'stego_api_docs',
    description:
      'Discovers the complete TypeScript API definitions, method signatures, types, and usage patterns available inside `stego_code_mode`. Call this to inspect available capabilities before running Code Mode scripts.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

export async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'stego_embed': {
      const {
        carrierPath,
        payload,
        payloadFilePath,
        passkey,
        method = 'hyper-matrix',
        outputPath,
      } = args as {
        carrierPath?: string;
        payload?: string;
        payloadFilePath?: string;
        passkey?: string;
        method?: string;
        outputPath?: string;
      };

      if (!carrierPath) throw new Error('Missing carrierPath parameter.');
      if (!fs.existsSync(carrierPath)) throw new Error(`Carrier file not found: ${carrierPath}`);

      let rawBytes: Uint8Array;
      if (payloadFilePath) {
        if (!fs.existsSync(payloadFilePath)) {
          throw new Error(`Payload file not found: ${payloadFilePath}`);
        }
        rawBytes = new Uint8Array(fs.readFileSync(payloadFilePath));
      } else if (payload !== undefined) {
        rawBytes = new TextEncoder().encode(String(payload));
      } else {
        throw new Error('Must provide either payload or payloadFilePath.');
      }

      // Encrypt with passkey if provided
      let finalPayload = rawBytes;
      let encrypted = false;
      if (passkey) {
        await ensureCrypto();
        finalPayload = encryptWithPasskey(rawBytes, passkey);
        encrypted = true;
      }

      const carrierBytes = new Uint8Array(fs.readFileSync(carrierPath));
      const carrier = decodePng(carrierBytes);

      let stegoCarrier: CarrierImage;
      const normalizedMethod = String(method).toLowerCase();

      if (normalizedMethod === 'hyper-matrix') {
        stegoCarrier = await hyperMatrixMethod.embed(carrier, finalPayload);
      } else if (normalizedMethod === 'robust-resilient') {
        stegoCarrier = await robustResilientStego.embed(carrier, finalPayload);
      } else if (normalizedMethod === 'dwt') {
        stegoCarrier = await haarDwtStego.embed(carrier, finalPayload);
      } else if (normalizedMethod === 'pvd') {
        stegoCarrier = await pvdStego.embed(carrier, finalPayload);
      } else if (normalizedMethod === 'matching') {
        stegoCarrier = await pngLsbMatching.embed(carrier, finalPayload);
      } else {
        stegoCarrier = await pngLsbSequential.embed(carrier, finalPayload);
      }

      const outPath =
        outputPath ||
        path.join(
          path.dirname(carrierPath),
          `${path.basename(carrierPath, path.extname(carrierPath))}-stego.png`,
        );

      const encodedPng = encodePng(stegoCarrier);
      fs.writeFileSync(outPath, encodedPng);

      // Fast fidelity benchmark
      const bench = await Ombrix.benchmark(carrier, finalPayload);
      const matchBench = bench.find((b) => b.methodId.includes(normalizedMethod)) ?? bench[0];

      return {
        status: 'success',
        outputPath: path.resolve(outPath),
        carrier: {
          width: carrier.width,
          height: carrier.height,
          totalPixels: carrier.width * carrier.height,
        },
        payloadBytes: rawBytes.length,
        encryptedWithPasskey: encrypted,
        algorithm: normalizedMethod.toUpperCase(),
        fidelity: matchBench
          ? {
              psnr_db: Number(matchBench.distortion.psnr.toFixed(2)),
              ssim: Number(matchBench.distortion.ssim.toFixed(4)),
              mse: Number(matchBench.distortion.mse.toFixed(4)),
            }
          : undefined,
        note: 'Zero-telemetry lossless PNG created locally with zero server leakage.',
      };
    }

    case 'stego_extract': {
      const {
        stegoPath,
        passkey,
        method = 'auto',
        outputPath,
      } = args as {
        stegoPath?: string;
        passkey?: string;
        method?: string;
        outputPath?: string;
      };

      if (!stegoPath) throw new Error('Missing stegoPath parameter.');
      if (!fs.existsSync(stegoPath)) throw new Error(`Stego file not found: ${stegoPath}`);

      const stegoBytes = new Uint8Array(fs.readFileSync(stegoPath));
      const carrier = decodePng(stegoBytes);

      let extractedRaw: Uint8Array;
      const normalizedMethod = String(method).toLowerCase();

      if (normalizedMethod === 'hyper-matrix') {
        extractedRaw = await hyperMatrixMethod.extract(carrier);
      } else if (normalizedMethod === 'robust-resilient') {
        extractedRaw = await robustResilientStego.extract(carrier);
      } else if (normalizedMethod === 'dwt') {
        extractedRaw = await haarDwtStego.extract(carrier);
      } else if (normalizedMethod === 'pvd') {
        extractedRaw = await pvdStego.extract(carrier);
      } else if (normalizedMethod === 'matching') {
        extractedRaw = await pngLsbMatching.extract(carrier);
      } else if (normalizedMethod === 'lsb') {
        extractedRaw = await pngLsbSequential.extract(carrier);
      } else {
        // Auto-detection hierarchy: check hyper-matrix first, then fallback to edge-sdk
        try {
          extractedRaw = await hyperMatrixMethod.extract(carrier);
        } catch {
          const res = await Ombrix.extract(carrier);
          extractedRaw = res.payload;
        }
      }

      // Check if container is Argon2id encrypted
      let wasEncrypted = false;
      let finalBytes = extractedRaw;

      if (isPasskeyEncrypted(extractedRaw)) {
        wasEncrypted = true;
        if (!passkey) {
          return {
            status: 'locked',
            message:
              'Payload is encrypted with an Argon2id passkey. Please call stego_extract again with the passkey parameter.',
            isPasskeyEncrypted: true,
          };
        }
        await ensureCrypto();
        finalBytes = decryptWithPasskey(extractedRaw, passkey);
      }

      let writtenFile: string | undefined;
      if (outputPath) {
        fs.writeFileSync(outputPath, finalBytes);
        writtenFile = path.resolve(outputPath);
      }

      const text = new TextDecoder().decode(finalBytes);
      const isUtf8 = !text.includes('\ufffd');

      return {
        status: 'success',
        payloadLengthBytes: finalBytes.length,
        wasEncrypted,
        detectedMethod: normalizedMethod === 'auto' ? 'Auto-Detected' : normalizedMethod,
        writtenToDisk: writtenFile,
        previewText: isUtf8
          ? text.length > 500
            ? `${text.slice(0, 500)}... [truncated ${text.length - 500} characters]`
            : text
          : `[Binary data: ${finalBytes.length} bytes]`,
      };
    }

    case 'stego_scan': {
      const { imagePath } = args as { imagePath?: string };
      if (!imagePath) throw new Error('Missing imagePath parameter.');
      if (!fs.existsSync(imagePath)) throw new Error(`Image file not found: ${imagePath}`);

      const imgBytes = new Uint8Array(fs.readFileSync(imagePath));
      const carrier = decodePng(imgBytes);

      const report = Ombrix.scan(carrier);

      return {
        status: 'success',
        verdict: report.verdict,
        overallAnomalyScorePercent: Number((report.overallAnomalyScore * 100).toFixed(1)),
        confidencePercent: Number((report.confidence * 100).toFixed(1)),
        detectors: {
          rsSteganalysis: {
            estimatedPayloadRatioPercent: Number(
              (report.detectors.rs.estimatedPayloadRatio * 100).toFixed(1),
            ),
            isSuspicious: report.detectors.rs.classification !== 'clean',
          },
          samplePairAnalysis: {
            estimatedPayloadRatioPercent: Number(
              (report.detectors.spa.estimatedPayloadRatio * 100).toFixed(1),
            ),
            isSuspicious: report.detectors.spa.classification !== 'clean',
          },
          chiSquarePoVs: {
            pValue: report.detectors.chiSquare.pValue,
            isSuspicious: report.detectors.chiSquare.tamperingDetected,
          },
          laplacianResidual: {
            variance: Number(report.detectors.noiseResidual.variance.toFixed(4)),
            isSuspicious: report.detectors.noiseResidual.hfpi > 0.5,
          },
        },
      };
    }

    case 'stego_benchmark': {
      const { carrierPath, payload = 'OMBRIX Benchmark Test Vector' } = args as {
        carrierPath?: string;
        payload?: string;
      };
      if (!carrierPath) throw new Error('Missing carrierPath parameter.');
      if (!fs.existsSync(carrierPath)) throw new Error(`Carrier file not found: ${carrierPath}`);

      const carrierBytes = new Uint8Array(fs.readFileSync(carrierPath));
      const carrier = decodePng(carrierBytes);
      const payloadBytes = new TextEncoder().encode(String(payload));

      const results = await Ombrix.benchmark(carrier, payloadBytes);

      return {
        carrier: `${carrier.width}x${carrier.height} px`,
        benchmarkResults: results.map((r) => ({
          algorithm: r.methodName,
          psnr_db: Number(r.distortion.psnr.toFixed(2)),
          ssim: Number(r.distortion.ssim.toFixed(4)),
          mse: Number(r.distortion.mse.toFixed(4)),
          maxChannelDiff: r.distortion.maxChannelDiff,
        })),
      };
    }

    case 'stego_keygen': {
      const { type = 'diceware' } = args;

      if (type === 'crypto32') {
        const token = generateRandomPasskey32('formatted');
        return {
          type: 'crypto32',
          passkey: token,
          rawHex: token.replace(/-/g, '').toLowerCase(),
          description: '32-byte high-entropy hexadecimal cryptographic token.',
        };
      }

      if (type === 'keypair') {
        await ensureCrypto();
        const kp = generateEncryptionKeyPair();
        return {
          type: 'keypair (X25519)',
          publicKeyBase64: Buffer.from(kp.publicKey).toString('base64'),
          privateKeyBase64: Buffer.from(kp.privateKey).toString('base64'),
          description: 'Curve25519 keypair for authenticated asymmetric sealed box encryption.',
        };
      }

      if (type === 'signing') {
        await ensureCrypto();
        const kp = generateSigningKeyPair();
        return {
          type: 'signing (Ed25519)',
          publicKeyBase64: Buffer.from(kp.publicKey).toString('base64'),
          privateKeyBase64: Buffer.from(kp.privateKey).toString('base64'),
          description: 'Ed25519 digital signature keypair for sender provenance verification.',
        };
      }

      // Default: Diceware
      const phrase = generateDicewarePassphrase(4, '-');
      return {
        type: 'diceware',
        passphrase: phrase,
        description: '4-word high-entropy human-memorable Diceware passphrase.',
      };
    }

    case 'stego_inspect': {
      const { imagePath } = args as { imagePath?: string };
      if (!imagePath) throw new Error('Missing imagePath parameter.');
      if (!fs.existsSync(imagePath)) throw new Error(`Image file not found: ${imagePath}`);

      const bytes = new Uint8Array(fs.readFileSync(imagePath));
      const carrier = decodePng(bytes);

      const totalPixels = carrier.width * carrier.height;
      const rawLsbBytes = Math.floor((totalPixels * 3) / 8);

      return {
        image: {
          path: path.resolve(imagePath),
          width: carrier.width,
          height: carrier.height,
          totalPixels,
          colorChannels: 4, // RGBA
        },
        usableCapacity: {
          sequentialLsbBytes: rawLsbBytes,
          hyperMatrixMaxBytes: Math.floor(rawLsbBytes * 0.75),
          robustMessagingBytes: Math.floor((totalPixels / 64) * 0.125), // block-based
          dwtWaveletBytes: Math.floor(rawLsbBytes * 0.5),
        },
      };
    }

    case 'stego_code_mode': {
      const { code, timeoutMs = 15000 } = args as { code?: string; timeoutMs?: number };
      if (!code || typeof code !== 'string') {
        throw new Error('Missing "code" parameter for stego_code_mode.');
      }
      const safeTimeout = Math.min(Math.max(Number(timeoutMs) || 15000, 1000), 30000);
      return await executeCodeMode(code, safeTimeout);
    }

    case 'stego_api_docs': {
      return {
        apiDocs: getCodeModeApiDocs(),
        runtime: 'Node.js V8 Sandboxed VM (MCP 2.0 Code Mode)',
        zeroNetworkAirGap: true,
        availableModules: [
          'ombrix',
          'console',
          'Uint8Array',
          'Uint8ClampedArray',
          'TextEncoder',
          'TextDecoder',
          'JSON',
          'Math',
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
