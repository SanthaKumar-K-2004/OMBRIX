import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
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
  jpegDctStego,
  pvdStego,
  robustResilientStego,
} from '@ombrix/stego-advanced';
import type { CarrierImage } from '@ombrix/stego-interface';
import { pngLsbMatching } from '@ombrix/stego-lab';
import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import { decodePng, encodePng } from './png.js';

export interface CodeModeResult {
  status: 'success' | 'error';
  result?: unknown;
  error?: string;
  logs: string[];
  executionTimeMs: number;
}

export interface EmbedOptions {
  method?:
    | 'hyper-matrix'
    | 'robust-resilient'
    | 'dwt'
    | 'pvd'
    | 'matching'
    | 'lsb'
    | 'dct'
    | string;
  passkey?: string;
  outputPath?: string;
  recipientKey?: string;
  signingKey?: string;
}

export interface ExtractOptions {
  method?:
    | 'auto'
    | 'hyper-matrix'
    | 'robust-resilient'
    | 'dwt'
    | 'pvd'
    | 'matching'
    | 'lsb'
    | 'dct'
    | string;
  passkey?: string;
  outputPath?: string;
  recipientKey?: string;
  senderKey?: string;
}

let cryptoReady = false;
async function ensureCryptoInitialized(): Promise<void> {
  if (!cryptoReady) {
    await initCrypto();
    cryptoReady = true;
  }
}

/**
 * Creates the high-level `ombrix` API sandbox for Code Mode.
 */
export function createOmbrixSandboxApi(logs: string[]) {
  const logCapture = (...args: unknown[]) => {
    const formatted = args
      .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ');
    logs.push(formatted);
  };

  return {
    console: {
      log: logCapture,
      info: logCapture,
      warn: logCapture,
      error: logCapture,
    },
    ombrix: {
      load(filePath: string): CarrierImage {
        const resolved = path.resolve(filePath);
        if (!fs.existsSync(resolved)) {
          throw new Error(`Carrier image not found: ${resolved}`);
        }
        const bytes = new Uint8Array(fs.readFileSync(resolved));
        return decodePng(bytes);
      },

      save(carrier: CarrierImage, outputPath: string): string {
        const resolved = path.resolve(outputPath);
        const encoded = encodePng(carrier);
        const dir = path.dirname(resolved);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(resolved, encoded);
        return resolved;
      },

      createCarrier(
        width: number,
        height: number,
        fillRgba: [number, number, number, number] = [128, 128, 128, 255],
      ): CarrierImage {
        const data = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < data.length; i += 4) {
          data[i] = fillRgba[0];
          data[i + 1] = fillRgba[1];
          data[i + 2] = fillRgba[2];
          data[i + 3] = fillRgba[3];
        }
        return {
          width,
          height,
          data,
          colorType: 6,
          bitDepth: 8,
        };
      },

      inspect(carrierOrPath: CarrierImage | string) {
        let carrier: CarrierImage;
        let filePath: string | undefined;

        if (typeof carrierOrPath === 'string') {
          filePath = path.resolve(carrierOrPath);
          const bytes = new Uint8Array(fs.readFileSync(filePath));
          carrier = decodePng(bytes);
        } else {
          carrier = carrierOrPath;
        }

        const totalPixels = carrier.width * carrier.height;
        const lsbCap = Math.floor((totalPixels * 3) / 8);
        const hyperCap = Math.floor(lsbCap * 0.75);
        const dwtCap = Math.floor(totalPixels / 4 / 8);
        const pvdCap = Math.floor(totalPixels / 2);
        const robustCap = Math.floor(lsbCap * 0.33);

        return {
          filePath,
          width: carrier.width,
          height: carrier.height,
          totalPixels,
          capacities: {
            hyperMatrixBytes: hyperCap,
            robustResilientBytes: robustCap,
            sequentialLsbBytes: lsbCap,
            lsbMatchingBytes: lsbCap,
            pvdBytes: pvdCap,
            dwtHaarBytes: dwtCap,
          },
        };
      },

      async embed(
        carrierOrPath: CarrierImage | string,
        payload: string | Uint8Array,
        options: EmbedOptions = {},
      ) {
        let carrier: CarrierImage;
        if (typeof carrierOrPath === 'string') {
          const resolved = path.resolve(carrierOrPath);
          const bytes = new Uint8Array(fs.readFileSync(resolved));
          carrier = decodePng(bytes);
        } else {
          carrier = carrierOrPath;
        }

        let payloadBytes: Uint8Array;
        if (typeof payload === 'string') {
          payloadBytes = new TextEncoder().encode(payload);
        } else {
          payloadBytes = payload;
        }

        let encrypted = false;
        let finalPayload = payloadBytes;
        if (options.passkey) {
          await ensureCryptoInitialized();
          finalPayload = encryptWithPasskey(payloadBytes, options.passkey);
          encrypted = true;
        }

        const method = (options.method ?? 'hyper-matrix').toLowerCase();
        let stegoCarrier: CarrierImage;

        if (method === 'hyper-matrix' || method === 'hypermatrix') {
          stegoCarrier = await hyperMatrixMethod.embed(carrier, finalPayload);
        } else if (method === 'robust-resilient' || method === 'robust') {
          stegoCarrier = await robustResilientStego.embed(carrier, finalPayload);
        } else if (method === 'dwt') {
          stegoCarrier = await haarDwtStego.embed(carrier, finalPayload);
        } else if (method === 'pvd') {
          stegoCarrier = await pvdStego.embed(carrier, finalPayload);
        } else if (method === 'matching') {
          stegoCarrier = await pngLsbMatching.embed(carrier, finalPayload);
        } else if (method === 'dct') {
          stegoCarrier = await jpegDctStego.embed(carrier, finalPayload);
        } else if (method === 'lsb' && (options.recipientKey || options.signingKey)) {
          stegoCarrier = await Ombrix.embed(carrier, finalPayload, {
            recipientPublicKey: options.recipientKey,
            signingPrivateKey: options.signingKey,
          });
        } else {
          stegoCarrier = await pngLsbSequential.embed(carrier, finalPayload);
        }

        let writtenPath: string | undefined;
        if (options.outputPath) {
          const resolved = path.resolve(options.outputPath);
          const encoded = encodePng(stegoCarrier);
          const dir = path.dirname(resolved);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(resolved, encoded);
          writtenPath = resolved;
        }

        return {
          carrier: stegoCarrier,
          outputPath: writtenPath,
          algorithm: method.toUpperCase(),
          payloadBytes: payloadBytes.length,
          encryptedWithPasskey: encrypted,
        };
      },

      async extract(stegoOrPath: CarrierImage | string, options: ExtractOptions = {}) {
        let carrier: CarrierImage;
        if (typeof stegoOrPath === 'string') {
          const resolved = path.resolve(stegoOrPath);
          const bytes = new Uint8Array(fs.readFileSync(resolved));
          carrier = decodePng(bytes);
        } else {
          carrier = stegoOrPath;
        }

        const method = (options.method ?? 'auto').toLowerCase();
        let rawExtracted: Uint8Array;
        let isSigned = false;
        let isEncrypted = false;
        let signatureVerified: boolean | undefined = undefined;

        if (method === 'hyper-matrix' || method === 'hypermatrix') {
          rawExtracted = await hyperMatrixMethod.extract(carrier);
        } else if (method === 'robust-resilient' || method === 'robust') {
          rawExtracted = await robustResilientStego.extract(carrier);
        } else if (method === 'dwt') {
          rawExtracted = await haarDwtStego.extract(carrier);
        } else if (method === 'pvd') {
          rawExtracted = await pvdStego.extract(carrier);
        } else if (method === 'matching') {
          rawExtracted = await pngLsbMatching.extract(carrier);
        } else if (method === 'dct') {
          rawExtracted = await jpegDctStego.extract(carrier);
        } else if (method === 'lsb') {
          const res = await Ombrix.extract(carrier, {
            recipientPrivateKey: options.recipientKey,
            senderSigningPublicKey: options.senderKey,
          });
          rawExtracted = res.payload;
          isSigned = res.isSigned;
          isEncrypted = res.isEncrypted;
          signatureVerified = res.signatureVerified;
        } else {
          // Auto-detection
          try {
            rawExtracted = await hyperMatrixMethod.extract(carrier);
          } catch {
            const res = await Ombrix.extract(carrier, {
              recipientPrivateKey: options.recipientKey,
              senderSigningPublicKey: options.senderKey,
            });
            rawExtracted = res.payload;
            isSigned = res.isSigned;
            isEncrypted = res.isEncrypted;
            signatureVerified = res.signatureVerified;
          }
        }

        let decryptedBytes = rawExtracted;
        let passkeyDecrypted = false;

        if (isPasskeyEncrypted(rawExtracted)) {
          if (!options.passkey) {
            throw new Error(
              'Payload is encrypted with an Argon2id passkey. Passkey parameter required to decrypt.',
            );
          }
          await ensureCryptoInitialized();
          decryptedBytes = decryptWithPasskey(rawExtracted, options.passkey);
          passkeyDecrypted = true;
        }

        let writtenPath: string | undefined;
        if (options.outputPath) {
          const resolved = path.resolve(options.outputPath);
          const dir = path.dirname(resolved);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(resolved, decryptedBytes);
          writtenPath = resolved;
        }

        let text = '';
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(decryptedBytes);
        } catch {
          text = `[Binary Data: ${decryptedBytes.length} bytes]`;
        }

        return {
          payload: decryptedBytes,
          text,
          length: decryptedBytes.length,
          outputPath: writtenPath,
          passkeyDecrypted,
          isSigned,
          isEncrypted,
          signatureVerified,
        };
      },

      scan(carrierOrPath: CarrierImage | string) {
        let carrier: CarrierImage;
        if (typeof carrierOrPath === 'string') {
          const resolved = path.resolve(carrierOrPath);
          const bytes = new Uint8Array(fs.readFileSync(resolved));
          carrier = decodePng(bytes);
        } else {
          carrier = carrierOrPath;
        }

        return Ombrix.scan(carrier);
      },

      async benchmark(carrierOrPath: CarrierImage | string, payload?: string | Uint8Array) {
        let carrier: CarrierImage;
        if (typeof carrierOrPath === 'string') {
          const resolved = path.resolve(carrierOrPath);
          const bytes = new Uint8Array(fs.readFileSync(resolved));
          carrier = decodePng(bytes);
        } else {
          carrier = carrierOrPath;
        }

        let payloadBytes: Uint8Array;
        if (!payload) {
          payloadBytes = new TextEncoder().encode('OMBRIX Code Mode Fidelity Benchmark 2026');
        } else if (typeof payload === 'string') {
          payloadBytes = new TextEncoder().encode(payload);
        } else {
          payloadBytes = payload;
        }

        return Ombrix.benchmark(carrier, payloadBytes);
      },

      async keygen(
        type: 'diceware' | 'crypto32' | 'keypair' | 'signing' = 'diceware',
        options: { words?: number } = {},
      ) {
        await ensureCryptoInitialized();

        if (type === 'crypto32') {
          const token = generateRandomPasskey32('formatted');
          return {
            type: 'crypto32',
            passkey: token,
            rawHex: token.replace(/-/g, '').toLowerCase(),
            entropyBits: 256,
          };
        }

        if (type === 'keypair') {
          const kp = generateEncryptionKeyPair();
          return {
            type: 'keypair (X25519)',
            publicKeyBase64: Buffer.from(kp.publicKey).toString('base64'),
            privateKeyBase64: Buffer.from(kp.privateKey).toString('base64'),
          };
        }

        if (type === 'signing') {
          const kp = generateSigningKeyPair();
          return {
            type: 'signing (Ed25519)',
            publicKeyBase64: Buffer.from(kp.publicKey).toString('base64'),
            privateKeyBase64: Buffer.from(kp.privateKey).toString('base64'),
          };
        }

        const words = options.words ?? 4;
        const phrase = generateDicewarePassphrase(words, '-');
        return {
          type: 'diceware',
          passkey: phrase,
          wordCount: words,
          entropyBits: words * 12.92,
        };
      },

      read(filePath: string, asText = true): string | Uint8Array {
        const resolved = path.resolve(filePath);
        if (!fs.existsSync(resolved)) throw new Error(`File not found: ${resolved}`);
        const buf = fs.readFileSync(resolved);
        return asText ? buf.toString('utf8') : new Uint8Array(buf);
      },

      write(filePath: string, data: string | Uint8Array): string {
        const resolved = path.resolve(filePath);
        const dir = path.dirname(resolved);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (typeof data === 'string') {
          fs.writeFileSync(resolved, data, 'utf8');
        } else {
          fs.writeFileSync(resolved, data);
        }
        return resolved;
      },

      exists(filePath: string): boolean {
        return fs.existsSync(path.resolve(filePath));
      },
    },
  };
}

/**
 * Executes user JavaScript/TypeScript code inside the air-gapped sandboxed VM.
 */
export async function executeCodeMode(code: string, timeoutMs = 15000): Promise<CodeModeResult> {
  const startTime = Date.now();
  const logs: string[] = [];

  const api = createOmbrixSandboxApi(logs);

  // Contextual sandbox without access to process, child_process, network, or require
  const sandbox = {
    ...api,
    Uint8Array,
    Uint8ClampedArray,
    ArrayBuffer,
    TextEncoder,
    TextDecoder,
    Math,
    JSON,
    Date,
    Promise,
    Error,
    TypeError,
    RangeError,
    parseInt: Number.parseInt,
    parseFloat: Number.parseFloat,
    isNaN: Number.isNaN,
    isFinite: Number.isFinite,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Set,
    Map,
    Buffer: {
      from: (data: string | Uint8Array | readonly number[], enc?: BufferEncoding) =>
        Buffer.from(data as string, enc),
    },
  };

  const context = vm.createContext(sandbox);

  // Wrap inside async immediately invoked function expression
  const wrappedCode = `(async () => {
    ${code}
  })()`;

  try {
    const script = new vm.Script(wrappedCode);
    const resultPromise = script.runInContext(context, {
      timeout: timeoutMs,
      displayErrors: true,
    });

    const evaluated = await Promise.race([
      resultPromise,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Code execution timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);

    const executionTimeMs = Date.now() - startTime;
    return {
      status: 'success',
      result: evaluated,
      logs,
      executionTimeMs,
    };
  } catch (err) {
    const executionTimeMs = Date.now() - startTime;
    return {
      status: 'error',
      error: (err as Error).message || String(err),
      logs,
      executionTimeMs,
    };
  }
}

/**
 * Returns concise TypeScript definitions of the Code Mode API for AI discovery.
 */
export function getCodeModeApiDocs(): string {
  return `/**
 * OMBRIX Code Mode MCP 2.0 API Specification
 * Write sandboxed JavaScript/TypeScript to orchestrate multi-step steganography workflows.
 */
declare namespace ombrix {
  interface CarrierImage {
    width: number;
    height: number;
    data: Uint8ClampedArray;
    colorType: number;
    bitDepth: number;
  }

  // Load and Save
  function load(filePath: string): CarrierImage;
  function save(carrier: CarrierImage, outputPath: string): string;
  function createCarrier(width: number, height: number, fillRgba?: [number, number, number, number]): CarrierImage;
  function inspect(carrierOrPath: CarrierImage | string): {
    width: number;
    height: number;
    totalPixels: number;
    capacities: Record<string, number>;
  };

  // Embed and Extract
  function embed(
    carrierOrPath: CarrierImage | string,
    payload: string | Uint8Array,
    options?: {
      method?: 'hyper-matrix' | 'robust-resilient' | 'dwt' | 'pvd' | 'matching' | 'lsb' | 'dct';
      passkey?: string;
      outputPath?: string;
      recipientKey?: string;
      signingKey?: string;
    }
  ): Promise<{ carrier: CarrierImage; outputPath?: string; algorithm: string; payloadBytes: number }>;

  function extract(
    stegoOrPath: CarrierImage | string,
    options?: {
      method?: 'auto' | 'hyper-matrix' | 'robust-resilient' | 'dwt' | 'pvd' | 'matching' | 'lsb' | 'dct';
      passkey?: string;
      outputPath?: string;
      recipientKey?: string;
      senderKey?: string;
    }
  ): Promise<{ payload: Uint8Array; text: string; length: number; passkeyDecrypted: boolean }>;

  // Forensics & Distortion
  function scan(carrierOrPath: CarrierImage | string): {
    verdict: 'CLEAN' | 'SUSPICIOUS_ANOMALY' | 'STEGO_CONTAINER_CONFIRMED';
    overallAnomalyScore: number;
    confidence: number;
    detectors: { rs: any; spa: any; chiSquare: any; noiseResidual: any };
  };

  function benchmark(
    carrierOrPath: CarrierImage | string,
    payload?: string | Uint8Array
  ): Promise<Array<{ methodName: string; distortion: { psnr: number; ssim: number; mse: number } }>>;

  // Key Generation
  function keygen(
    type?: 'diceware' | 'crypto32' | 'keypair' | 'signing',
    options?: { words?: number }
  ): Promise<{ type: string; passkey?: string; rawHex?: string; publicKeyBase64?: string; privateKeyBase64?: string }>;

  // Safe Filesystem Helpers
  function read(filePath: string, asText?: boolean): string | Uint8Array;
  function write(filePath: string, data: string | Uint8Array): string;
  function exists(filePath: string): boolean;
}

// Global console is captured: console.log(), console.info(), console.warn(), console.error()
// Return any object, string, or metric from your script to send it back to the agent.
`;
}
