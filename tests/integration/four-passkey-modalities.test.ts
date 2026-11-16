import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCli } from '../../packages/cli/src/cli.js';
import { decodePng, encodePng } from '../../packages/cli/src/png-codec.js';
import {
  computePerceptualHashFromRgba,
  decryptWithPasskey,
  deriveBiometricKey,
  deriveKeyFromImage,
  encryptWithPasskey,
  generateDicewarePassphrase,
  generateRandomPasskey32,
  initCrypto,
  normalizePasskeyInput,
} from '../../packages/crypto-adapter/src/index.js';
import { createOmbrixSandboxApi } from '../../packages/mcp-server/src/code-mode.js';
import { handleJsonRpc } from '../../packages/mcp-server/src/server.js';
import { hyperMatrixMethod } from '../../packages/stego-advanced/src/hyperMatrix.js';

interface ToolCallResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

function getText(result: ToolCallResult): string {
  const item = result.content[0];
  if (!item) throw new Error('Missing content in tool result');
  return item.text;
}

function createCarrier(width = 128, height = 128, patternOffset = 0) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (i * 7 + patternOffset) % 256;
    data[i + 1] = (i * 13 + patternOffset * 3) % 256;
    data[i + 2] = (i * 29 + patternOffset * 5) % 256;
    data[i + 3] = 255;
  }
  return { width, height, data };
}

describe('Universal Four Passkey Modalities Integration Test Suite', () => {
  let tmpDir: string;

  beforeAll(async () => {
    await initCrypto();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ombrix-four-modalities-'));
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  // =========================================================================
  // Modality 1: Memorable Words (Diceware)
  // =========================================================================
  describe('Modality 1: Memorable Words (Diceware Mnemonic Passphrase)', () => {
    const testSecret = 'MISSION_TOP_SECRET_COORDINATES_52.3702_4.8952';
    const canonicalDiceware = 'correct-horse-battery-staple';
    const spacedUppercase = 'CORRECT HORSE BATTERY STAPLE';
    const mixedCaseWithDashes = 'Correct-Horse-Battery-Staple';
    const mixedCaseWithSpaces = 'Correct Horse Battery Staple';

    it('normalizes Diceware across space, hyphen, and mixed-case representations', () => {
      const norm1 = normalizePasskeyInput(canonicalDiceware);
      const norm2 = normalizePasskeyInput(spacedUppercase);
      const norm3 = normalizePasskeyInput(mixedCaseWithDashes);
      const norm4 = normalizePasskeyInput(mixedCaseWithSpaces);

      expect(norm1).toBe(canonicalDiceware);
      expect(norm2).toBe(canonicalDiceware);
      expect(norm3).toBe(canonicalDiceware);
      expect(norm4).toBe(canonicalDiceware);
    });

    it('CLI embed with spaced mixed-case -> MCP extract with hyphenated lowercase', async () => {
      const cover = createCarrier(128, 128, 10);
      const coverPath = path.join(tmpDir, 'diceware-cover.png');
      const stegoPath = path.join(tmpDir, 'diceware-stego.png');
      fs.writeFileSync(coverPath, encodePng(cover));

      // Embed via CLI using spaced uppercase/mixed input
      const cliEmbedRes = await runCli([
        'embed',
        coverPath,
        '-p',
        testSecret,
        '-k',
        mixedCaseWithSpaces,
        '-m',
        'hyper-matrix',
        '-o',
        stegoPath,
      ]);
      expect(cliEmbedRes.exitCode).toBe(0);

      // Extract via MCP using canonical hyphenated lowercase
      const mcpRes = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 301,
        method: 'tools/call',
        params: {
          name: 'stego_extract',
          arguments: {
            stegoPath,
            passkey: canonicalDiceware,
            method: 'auto',
          },
        },
      });

      const result = mcpRes?.result as unknown as ToolCallResult;
      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(getText(result));
      expect(parsed.previewText).toBe(testSecret);
      expect(parsed.wasEncrypted).toBe(true);
    });

    it('Code Mode API embed -> CLI extract using Diceware phrase', async () => {
      const cover = createCarrier(128, 128, 20);
      const codeModeStegoPath = path.join(tmpDir, 'codemode-diceware-stego.png');
      const logs: string[] = [];
      const sandbox = createOmbrixSandboxApi(logs);

      // Embed via Code Mode API
      await sandbox.ombrix.embed(cover, testSecret, {
        method: 'hyper-matrix',
        passkey: spacedUppercase,
        outputPath: codeModeStegoPath,
      });

      // Extract via CLI
      const cliExtractRes = await runCli(['extract', codeModeStegoPath, '-k', mixedCaseWithDashes]);
      expect(cliExtractRes.exitCode).toBe(0);
      expect(cliExtractRes.stdout).toContain(testSecret);
    });
  });

  // =========================================================================
  // Modality 2: Photo as Key
  // =========================================================================
  describe('Modality 2: Photo as Key (Perceptual & Raw Entropy)', () => {
    const testSecret = 'BIOMETRIC_AIRGAP_SATELLITE_UPLINK_ALPHA';
    let keyPhotoPath: string;

    beforeAll(() => {
      // Create a deterministic 64x64 key photo with rich visual gradients
      const keyPhoto = createCarrier(64, 64, 77);
      keyPhotoPath = path.join(tmpDir, 'shared-key-photo.png');
      fs.writeFileSync(keyPhotoPath, encodePng(keyPhoto));
    });

    it('generates consistent perceptual photo key across Web, CLI, and MCP', async () => {
      // 1. Web computation
      const fileBytes = new Uint8Array(fs.readFileSync(keyPhotoPath));
      const carrier = decodePng(fileBytes);
      const webPercKey = computePerceptualHashFromRgba(carrier.width, carrier.height, carrier.data);
      const webHex = Buffer.from(webPercKey).toString('hex').toUpperCase();

      // 2. CLI keygen photo
      const cliKeygenRes = await runCli(['keygen', 'photo', keyPhotoPath]);
      expect(cliKeygenRes.exitCode).toBe(0);
      expect(cliKeygenRes.stdout).toContain(webHex);

      // 3. MCP stego_keygen type=photo
      const mcpKeygenRes = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 302,
        method: 'tools/call',
        params: {
          name: 'stego_keygen',
          arguments: {
            type: 'photo',
            imagePath: keyPhotoPath,
            photoMode: 'perceptual',
          },
        },
      });
      const result = mcpKeygenRes?.result as unknown as ToolCallResult;
      expect(result.isError).toBeFalsy();
      const mcpData = JSON.parse(getText(result));
      expect(mcpData.passkey).toBe(webHex);
      expect(mcpData.photoMode).toBe('perceptual');
    });

    it('CLI embed with --key-image -> MCP stego_extract with keyImagePath (Perceptual)', async () => {
      const cover = createCarrier(128, 128, 30);
      const coverPath = path.join(tmpDir, 'photo-carrier-cover.png');
      const stegoPath = path.join(tmpDir, 'photo-carrier-stego.png');
      fs.writeFileSync(coverPath, encodePng(cover));

      // CLI embed with --key-image
      const cliEmbedRes = await runCli([
        'embed',
        coverPath,
        '-p',
        testSecret,
        '--key-image',
        keyPhotoPath,
        '-m',
        'hyper-matrix',
        '-o',
        stegoPath,
      ]);
      expect(cliEmbedRes.exitCode).toBe(0);
      expect(cliEmbedRes.stdout).toContain('Derived 32-byte cryptographic key');

      // MCP stego_extract with keyImagePath
      const mcpExtractRes = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 303,
        method: 'tools/call',
        params: {
          name: 'stego_extract',
          arguments: {
            stegoPath,
            keyImagePath: keyPhotoPath,
            photoKeyMode: 'perceptual',
            method: 'auto',
          },
        },
      });

      const result = mcpExtractRes?.result as unknown as ToolCallResult;
      expect(result.isError).toBeFalsy();
      const extData = JSON.parse(getText(result));
      expect(extData.previewText).toBe(testSecret);
      expect(extData.wasEncrypted).toBe(true);
    });

    it('MCP stego_embed with keyImagePath (raw mode) -> CLI extract with --key-image --photo-mode raw', async () => {
      const cover = createCarrier(128, 128, 40);
      const coverPath = path.join(tmpDir, 'photo-raw-cover.png');
      const stegoPath = path.join(tmpDir, 'photo-raw-stego.png');
      fs.writeFileSync(coverPath, encodePng(cover));

      // MCP stego_embed with keyImagePath in raw mode
      const mcpEmbedRes = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 304,
        method: 'tools/call',
        params: {
          name: 'stego_embed',
          arguments: {
            carrierPath: coverPath,
            payload: testSecret,
            keyImagePath: keyPhotoPath,
            photoKeyMode: 'raw',
            method: 'hyper-matrix',
            outputPath: stegoPath,
          },
        },
      });

      const embedResult = mcpEmbedRes?.result as unknown as ToolCallResult;
      expect(embedResult.isError).toBeFalsy();

      // CLI extract with --key-image and --photo-mode raw
      const cliExtractRes = await runCli([
        'extract',
        stegoPath,
        '--key-image',
        keyPhotoPath,
        '--photo-mode',
        'raw',
      ]);
      expect(cliExtractRes.exitCode).toBe(0);
      expect(cliExtractRes.stdout).toContain(testSecret);
    });

    it('Code Mode API embed with keyImage -> Code Mode API extract with keyImage', async () => {
      const cover = createCarrier(128, 128, 50);
      const logs: string[] = [];
      const sandbox = createOmbrixSandboxApi(logs);

      // Embed via Code Mode API using keyImage
      const embedResult = await sandbox.ombrix.embed(cover, testSecret, {
        method: 'hyper-matrix',
        keyImage: keyPhotoPath,
        photoKeyMode: 'perceptual',
      });
      expect(embedResult.encryptedWithPasskey).toBe(true);

      // Extract via Code Mode API using keyImage
      const extractResult = await sandbox.ombrix.extract(embedResult.carrier, {
        method: 'hyper-matrix',
        keyImage: keyPhotoPath,
        photoKeyMode: 'perceptual',
      });
      expect(extractResult.text).toBe(testSecret);
      expect(extractResult.passkeyDecrypted).toBe(true);
    });
  });

  // =========================================================================
  // Modality 3: 32-Byte Token (Crypto32)
  // =========================================================================
  describe('Modality 3: 32-Byte Hex Token (Crypto32 Token)', () => {
    const testSecret = 'QUANTUM_RESILIENT_VAULT_DEPOSIT_BLOCK_7749';

    it('handles formatted vs raw hex cross-decryption with whitespace and casing resilience', async () => {
      const formattedToken = generateRandomPasskey32('formatted');
      const rawHex = formattedToken.replace(/-/g, '').toLowerCase();
      const spacedFormatted = formattedToken.replace(/-/g, ' ');

      // Web App normalization: 64-hex strings normalize to canonical formatted uppercase token
      expect(normalizePasskeyInput(formattedToken)).toBe(formattedToken);
      expect(normalizePasskeyInput(spacedFormatted)).toBe(formattedToken);
      expect(normalizePasskeyInput(rawHex)).toBe(formattedToken);

      const cover = createCarrier(128, 128, 60);
      const coverPath = path.join(tmpDir, 'crypto32-cover.png');
      const stegoPath = path.join(tmpDir, 'crypto32-stego.png');
      fs.writeFileSync(coverPath, encodePng(cover));

      // CLI embed with formatted token
      const cliEmbedRes = await runCli([
        'embed',
        coverPath,
        '-p',
        testSecret,
        '-k',
        formattedToken,
        '-m',
        'hyper-matrix',
        '-o',
        stegoPath,
      ]);
      expect(cliEmbedRes.exitCode).toBe(0);

      // MCP extract with raw hex token (without hyphens)
      const mcpExtractRes = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 305,
        method: 'tools/call',
        params: {
          name: 'stego_extract',
          arguments: {
            stegoPath,
            passkey: rawHex,
            method: 'auto',
          },
        },
      });

      const result = mcpExtractRes?.result as unknown as ToolCallResult;
      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(getText(result));
      expect(parsed.previewText).toBe(testSecret);
    });
  });

  // =========================================================================
  // Modality 4: Device Biometrics (WebAuthn Credential Key Derivation)
  // =========================================================================
  describe('Modality 4: Device Biometrics (WebAuthn Platform Authenticator)', () => {
    const testSecret = 'BIOMETRIC_ENCLAVE_SIGNATURE_0xDEADBEEF';

    it('deterministically derives 32-byte key from WebAuthn credential rawId', () => {
      const mockRawId = new Uint8Array([
        0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0xfe, 0xdc, 0xba, 0x98, 0x76, 0x54, 0x32,
        0x10, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
        0x88, 0x99,
      ]);

      const key1 = deriveBiometricKey(mockRawId);
      const key2 = deriveBiometricKey(mockRawId);

      expect(key1.length).toBe(32);
      expect(Buffer.from(key1).toString('hex')).toBe(Buffer.from(key2).toString('hex'));

      // Tampered rawId yields completely divergent key
      const tamperedId = new Uint8Array(mockRawId);
      tamperedId[0] ^= 0x01;
      const keyTampered = deriveBiometricKey(tamperedId);
      expect(Buffer.from(keyTampered).toString('hex')).not.toBe(Buffer.from(key1).toString('hex'));
    });

    it('interoperates biometric-derived key between Web encryption and CLI/MCP decryption', async () => {
      // Simulate Web App biometric enrollment / authentication
      const credentialRawId = new Uint8Array(32);
      for (let i = 0; i < 32; i++) credentialRawId[i] = (i * 17 + 3) & 0xff;
      const derivedKeyBytes = deriveBiometricKey(credentialRawId);
      const biometricPasskeyHex = Buffer.from(derivedKeyBytes).toString('hex').toUpperCase();

      // Web App embeds secret using biometric passkey
      const carrier = createCarrier(128, 128, 70);
      const encryptedPayload = encryptWithPasskey(testSecret, biometricPasskeyHex);
      const webStego = await hyperMatrixMethod.embed(carrier, encryptedPayload, {
        passphrase: biometricPasskeyHex,
      });

      const bioStegoPath = path.join(tmpDir, 'biometric-stego.png');
      fs.writeFileSync(bioStegoPath, encodePng(webStego));

      // CLI extraction using the derived biometric passkey hex
      const cliExtract = await runCli(['extract', bioStegoPath, '-k', biometricPasskeyHex]);
      expect(cliExtract.exitCode).toBe(0);
      expect(cliExtract.stdout).toContain(testSecret);

      // MCP extraction using the derived biometric passkey hex
      const mcpExtract = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 306,
        method: 'tools/call',
        params: {
          name: 'stego_extract',
          arguments: {
            stegoPath: bioStegoPath,
            passkey: biometricPasskeyHex,
            method: 'auto',
          },
        },
      });

      const result = mcpExtract?.result as unknown as ToolCallResult;
      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(getText(result));
      expect(parsed.previewText).toBe(testSecret);
    });
  });
});
