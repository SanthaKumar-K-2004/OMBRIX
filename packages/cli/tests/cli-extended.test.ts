import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCli } from '../src/cli.js';
import { encodePng } from '../src/png-codec.js';

describe('OMBRIX CLI - Extended Features & MCP Installer Suite', () => {
  let tmpDir: string;
  let carrierPath: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ombrix-cli-ext-test-'));

    // Create a 64x64 RGBA test PNG
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 100 + ((i >> 4) % 100);
      data[i + 1] = 120 + ((i >> 5) % 100);
      data[i + 2] = 140 + ((i >> 6) % 100);
      data[i + 3] = 255;
    }

    const pngBytes = encodePng({
      width,
      height,
      data,
      colorType: 6,
      bitDepth: 8,
    });

    carrierPath = path.join(tmpDir, 'carrier.png');
    fs.writeFileSync(carrierPath, pngBytes);
  });

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('runs keygen for all supported key formats', async () => {
    // 1. Diceware
    const resDice = await runCli(['keygen', 'diceware', '5']);
    expect(resDice.exitCode).toBe(0);
    expect(resDice.stdout).toContain('Diceware Passphrase');
    expect(resDice.stdout).toContain('5 words');

    // 2. Crypto32
    const resCrypto = await runCli(['keygen', 'crypto32']);
    expect(resCrypto.exitCode).toBe(0);
    expect(resCrypto.stdout).toContain('32-Byte Cryptographic Token');
    expect(resCrypto.stdout).toContain('256-bit entropy');

    // 3. Curve25519 Keypair
    const resKeypair = await runCli(['keygen', 'keypair']);
    expect(resKeypair.exitCode).toBe(0);
    expect(resKeypair.stdout).toContain('Curve25519 Keypair');
    expect(resKeypair.stdout).toContain('Public Key:');
    expect(resKeypair.stdout).toContain('Private Key:');

    // 4. Ed25519 Signing Keypair
    const resSigning = await runCli(['keygen', 'signing']);
    expect(resSigning.exitCode).toBe(0);
    expect(resSigning.stdout).toContain('Ed25519 Signature Keypair');
  });

  it('inspects carrier image capacity across steganographic algorithms', async () => {
    const res = await runCli(['inspect', carrierPath]);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('OMBRIX Carrier Image Inspection');
    expect(res.stdout).toContain('64 × 64 pixels');
    expect(res.stdout).toContain('Universal Hyper-Matrix');
    expect(res.stdout).toContain('Robust Resilient');
    expect(res.stdout).toContain('Sequential LSB');
  });

  it('embeds and extracts with Argon2id passkey protection via CLI', async () => {
    const stegoOut = path.join(tmpDir, 'stego-passkey.png');
    const secret = 'TACTICAL_PAYLOAD_AUTHORIZED_2026';
    const passkey = 'timber-mountain-silver-compass';

    // 1. Embed with passkey
    const embedRes = await runCli([
      'embed',
      carrierPath,
      '-p',
      secret,
      '-k',
      passkey,
      '-m',
      'hyper-matrix',
      '-o',
      stegoOut,
    ]);

    expect(embedRes.exitCode).toBe(0);
    expect(embedRes.stdout).toContain('Payload embedded successfully');
    expect(embedRes.stdout).toContain('Argon2id KDF');

    // 2. Extract without passkey should fail with guidance
    const extractFail = await runCli(['extract', stegoOut]);
    expect(extractFail.exitCode).toBe(1);
    expect(extractFail.stderr).toContain('Passkey Required');

    // 3. Extract with wrong passkey should fail
    const extractWrong = await runCli(['extract', stegoOut, '-k', 'wrong-passkey']);
    expect(extractWrong.exitCode).toBe(1);

    // 4. Extract with correct passkey succeeds
    const extractSuccess = await runCli(['extract', stegoOut, '-k', passkey]);
    expect(extractSuccess.exitCode).toBe(0);
    expect(extractSuccess.stdout).toContain(secret);
  });

  it('displays MCP client configurations via mcp show', async () => {
    const res = await runCli(['mcp', 'show']);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('Claude Desktop');
    expect(res.stdout).toContain('Cursor IDE');
    expect(res.stdout).toContain('Google Antigravity');
    expect(res.stdout).toContain('@ombrix/mcp-server');
  });

  it('runs automated mcp installer targeting known assistant', async () => {
    const res = await runCli(['mcp', 'install', 'cursor']);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('Cursor IDE');
    expect(res.stdout).toContain('Installation complete!');
  });
});
