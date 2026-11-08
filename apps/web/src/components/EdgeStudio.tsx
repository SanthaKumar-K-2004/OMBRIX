import {
  type CarrierImage,
  Ombrix,
  generateEncryptionKeyPair,
  generateSigningKeyPair,
  toBase64,
} from '@ombrix/edge-sdk';
import {
  Box,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Cpu,
  Layers,
  Play,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

type SdkSnippetType = 'basic' | 'encrypted' | 'lens' | 'benchmark' | 'link' | 'batch';

export const EdgeStudio: React.FC = () => {
  const [selectedSnippet, setSelectedSnippet] = useState<SdkSnippetType>('encrypted');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedInstall, setCopiedInstall] = useState<boolean>(false);
  const [executionOutput, setExecutionOutput] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  const snippets: Record<SdkSnippetType, { title: string; subtitle: string; code: string }> = {
    basic: {
      title: 'Basic Steganography',
      subtitle: 'Deterministic sequential RGB LSB embed and extract',
      code: `import { Ombrix } from '@ombrix/edge-sdk';

// 1. Prepare carrier (RGBA raster buffer)
const carrier = {
  width: 80,
  height: 80,
  data: new Uint8ClampedArray(80 * 80 * 4), // 25.6 KB raster
};

// 2. Embed payload into RGB least significant bits
const stegoCarrier = await Ombrix.embed(
  carrier,
  'Hello from OMBRIX Edge SDK!'
);

// 3. Extract payload
const result = await Ombrix.extract(stegoCarrier);
console.log('Extracted message:', result.text);`,
    },
    encrypted: {
      title: 'Encrypted & Signed Messaging',
      subtitle: 'X25519 sealed box + Ed25519 digital signature in OMB1 envelope',
      code: `import {
  Ombrix,
  generateSigningKeyPair,
  generateEncryptionKeyPair,
  toBase64,
} from '@ombrix/edge-sdk';

// 1. Generate cryptographic keypairs
const aliceSigning = generateSigningKeyPair();
const bobEncryption = generateEncryptionKeyPair();

// 2. Encrypt & Sign & Embed into Carrier
const stegoCarrier = await Ombrix.embed(
  carrier,
  'Tactical coordinates: 48.8584° N, 2.2945° E',
  {
    recipientPublicKey: toBase64(bobEncryption.publicKey),
    signingPrivateKey: toBase64(aliceSigning.privateKey),
  }
);

// 3. Extract & Authenticate & Decrypt
const result = await Ombrix.extract(stegoCarrier, {
  recipientPublicKey: toBase64(bobEncryption.publicKey),
  recipientPrivateKey: toBase64(bobEncryption.privateKey),
  senderSigningPublicKey: toBase64(aliceSigning.publicKey),
});

console.log('Decrypted text:', result.text);
console.log('Signature valid:', result.signatureVerified);`,
    },
    lens: {
      title: 'Carrier Lens & Visual Diagnostics',
      subtitle: 'Multi-channel bitplanes and 256-bin RGB frequency histograms',
      code: `import { Ombrix } from '@ombrix/edge-sdk';

// Run visual diagnostics on carrier
const diagnostics = Ombrix.inspect(carrier);

console.log('Red Bit 0 plane pixels:', diagnostics.bitplanes.red.alteredPixelCount);
console.log('RGB Histograms (256 bins):', diagnostics.histogram.r.length);`,
    },
    benchmark: {
      title: 'Stego Lab Algorithm Benchmark',
      subtitle: 'Side-by-side empirical testing: LSB Sequential vs LSB Matching (±1)',
      code: `import { Ombrix } from '@ombrix/edge-sdk';

const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const benchmarkResults = await Ombrix.benchmark(carrier, payload);

for (const report of benchmarkResults) {
  console.log(\`Method: \${report.methodName}\`);
  console.log(\`  PSNR: \${report.distortion.psnr.toFixed(2)} dB\`);
  console.log(\`  MSE: \${report.distortion.mse.toFixed(4)}\`);
  console.log(\`  Latency: \${report.embedDurationMs.toFixed(2)} ms\`);
}`,
    },
    link: {
      title: 'Ephemeral Link Sharing',
      subtitle: 'Self-verifying container with BLAKE2b hash ring and TTL expiration',
      code: `import { Ombrix } from '@ombrix/edge-sdk';

// 1. Create 24h ephemeral container with BLAKE2b carrier hash ring
const { uri, container } = await Ombrix.createShareLink({
  expiresInSeconds: 86400, // 24 hours
  carrierBytes: pngCarrierBytes,
  payloadBytes: new TextEncoder().encode('Confidential Ephemeral Secret'),
  passphrase: 'optional-argon2id-passphrase',
});

console.log('Shareable URI:', uri);

// 2. Open and verify carrier integrity
const opened = await Ombrix.openShareLink(uri, {
  carrierBytes: pngCarrierBytes,
  passphrase: 'optional-argon2id-passphrase',
});

console.log('Carrier intact:', opened.carrierVerified);
console.log('Expired:', opened.isExpired);`,
    },
    batch: {
      title: 'Multi-Carrier Batch Pipeline',
      subtitle: 'Capacity auditing, multi-carrier payload striping, and concurrent workers',
      code: `import { Ombrix } from '@ombrix/edge-sdk';

// 1. Audit batch capacity across multiple images
const audit = Ombrix.auditBatchCarriers([
  { name: 'cover-1.png', carrier: carrier1 },
  { name: 'cover-2.png', carrier: carrier2 },
]);

console.log('Total usable capacity:', audit.totalCapacityBytes);

// 2. Stripe large payload across carriers with 12-byte framing
const largeSecret = new Uint8Array(5000);
const tasks = Ombrix.splitPayloadAcrossCarriers(largeSecret, audit.items);

// 3. Execute concurrent batch embedding
const embedResults = await Ombrix.runBatchEmbed(tasks, { concurrency: 2 });
console.log('Completed tasks:', embedResults.length);`,
    },
  };

  const currentSnippet = snippets[selectedSnippet];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentSnippet.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyInstall = () => {
    navigator.clipboard.writeText('pnpm add @ombrix/edge-sdk');
    setCopiedInstall(true);
    setTimeout(() => setCopiedInstall(false), 2000);
  };

  const handleLiveExecute = async () => {
    setIsExecuting(true);
    setExecutionOutput(null);

    const logs: string[] = [];
    const log = (...args: unknown[]) => {
      logs.push(
        args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '),
      );
    };

    try {
      await Ombrix.init();
      log('[OMBRIX Runtime] Libsodium and Edge SDK initialized.');

      // Synthetic 60x60 carrier for live execution
      const dummyCarrier: CarrierImage = {
        width: 60,
        height: 60,
        data: new Uint8ClampedArray(60 * 60 * 4),
      };
      for (let i = 0; i < dummyCarrier.data.length; i += 4) {
        dummyCarrier.data[i] = (i * 5) % 256;
        dummyCarrier.data[i + 1] = (i * 9) % 256;
        dummyCarrier.data[i + 2] = (i * 13) % 256;
        dummyCarrier.data[i + 3] = 255;
      }

      if (selectedSnippet === 'basic') {
        const t0 = performance.now();
        const stego = await Ombrix.embed(dummyCarrier, 'Hello from live browser execution!');
        const res = await Ombrix.extract(stego);
        const elapsed = (performance.now() - t0).toFixed(2);
        log(`✓ Embed and Extract completed in ${elapsed} ms`);
        log(`Extracted text: "${res.text}"`);
        log(`Encrypted: ${res.isEncrypted}, Signed: ${res.isSigned}`);
      } else if (selectedSnippet === 'encrypted') {
        const alice = generateSigningKeyPair();
        const bob = generateEncryptionKeyPair();
        const t0 = performance.now();
        const stego = await Ombrix.embed(dummyCarrier, 'Top Secret Payload Delivered', {
          recipientPublicKey: toBase64(bob.publicKey),
          signingPrivateKey: toBase64(alice.privateKey),
        });
        const res = await Ombrix.extract(stego, {
          recipientPublicKey: toBase64(bob.publicKey),
          recipientPrivateKey: toBase64(bob.privateKey),
          senderSigningPublicKey: toBase64(alice.publicKey),
        });
        const elapsed = (performance.now() - t0).toFixed(2);
        log(`✓ Encrypted Sealed-Box Roundtrip in ${elapsed} ms`);
        log(`Decrypted text: "${res.text}"`);
        log(`Signature Authenticated: ${res.signatureVerified}`);
        log(`Sender Fingerprint: ${res.senderFingerprint}`);
      } else if (selectedSnippet === 'lens') {
        const diag = Ombrix.inspect(dummyCarrier);
        log('✓ Visual inspection completed:');
        log(`Red LSB plane buffer: ${diag.bitplanes.red.width}x${diag.bitplanes.red.height} px`);
        log(
          `Histogram bins: R=${diag.histogram.r.length}, G=${diag.histogram.g.length}, B=${diag.histogram.b.length}`,
        );
      } else if (selectedSnippet === 'benchmark') {
        const payload = new Uint8Array([1, 2, 3, 4, 5]);
        const reports = await Ombrix.benchmark(dummyCarrier, payload);
        log(`✓ Benchmark completed across ${reports.length} stego algorithms:`);
        for (const r of reports) {
          log(
            `  • ${r.methodName} -> PSNR: ${r.distortion.psnr.toFixed(2)} dB, Latency: ${r.embedDurationMs.toFixed(2)} ms`,
          );
        }
      } else if (selectedSnippet === 'link') {
        const dummyBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2]);
        const { uri, container } = await Ombrix.createShareLink({
          expiresInSeconds: 3600,
          carrierBytes: dummyBytes,
          payloadBytes: new TextEncoder().encode('Link Secret Token'),
        });
        log('✓ Created Link container:');
        log(
          `Magic: ${container.magic}, Expiration: ${new Date(container.metadata.expiresAt).toLocaleTimeString()}`,
        );
        log(`URI Fragment: ${uri.slice(0, 60)}...`);
        const opened = await Ombrix.openShareLink(uri, { carrierBytes: dummyBytes });
        log(`Integrity Verified: ${opened.carrierVerified}`);
        log(`Unpacked text: "${new TextDecoder().decode(opened.payloadBytes)}"`);
      } else if (selectedSnippet === 'batch') {
        const audit = Ombrix.auditBatchCarriers([
          { name: 'cover-a.png', carrier: dummyCarrier },
          { name: 'cover-b.png', carrier: dummyCarrier },
        ]);
        log(`✓ Audited ${audit.totalCarriers} carriers.`);
        log(`Total batch usable capacity: ${audit.totalCapacityBytes.toLocaleString()} bytes`);
      }
    } catch (err) {
      log(`✗ Execution error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExecuting(false);
      setExecutionOutput(logs.join('\n'));
    }
  };

  const monorepoPackages = [
    {
      name: '@ombrix/edge-sdk',
      desc: 'Unified public facade combining all 10 modules with zero config',
    },
    {
      name: '@ombrix/image-validation',
      desc: 'Header signature, strict chunk parsing, APNG & decompression bomb defense',
    },
    {
      name: '@ombrix/payload-protocol',
      desc: 'Canonical binary envelope serializer/parser for OMB1 format',
    },
    {
      name: '@ombrix/stego-interface',
      desc: 'Abstract steganography contracts, capacity reporting, and typed errors',
    },
    {
      name: '@ombrix/stego-png-lsb',
      desc: 'Sequential raster RGB LSB deterministic baseline engine',
    },
    {
      name: '@ombrix/stego-worker',
      desc: 'Dedicated Web Worker sandbox with zero-copy transferable buffers',
    },
    {
      name: '@ombrix/crypto-adapter',
      desc: 'Vetted Libsodium sealed boxes, Ed25519 detached signatures, and Argon2id',
    },
    {
      name: '@ombrix/carrier-lens',
      desc: 'Visual forensics: bitplane slicing (B0-B7) and 256-bin RGB histograms',
    },
    {
      name: '@ombrix/stego-lab',
      desc: 'LSB Matching (±1), MSE, PSNR, SSIM, and comparative benchmarks',
    },
    {
      name: '@ombrix/transit-trace',
      desc: 'Lossy JPEG/resize transit simulator and Westfeld Chi-Square forensics',
    },
    {
      name: '@ombrix/link-sharing',
      desc: 'Zero-server ephemeral sharing with TTL expiration and BLAKE2b hash rings',
    },
    {
      name: '@ombrix/batch-pipeline',
      desc: 'Multi-carrier capacity auditing, striped chunker, and worker execution',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#111827] via-[#1E1B4B]/30 to-[#111827] border border-[#1E293B] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/40">
              Developer SDK
            </span>
            <span className="text-xs text-[#64748B]">• Unified Developer SDK & Public API</span>
          </div>
          <h2 className="text-2xl font-bold font-['Sora'] text-white mt-1">
            OMBRIX Edge — Developer SDK & Interactive Playground
          </h2>
          <p className="text-xs text-[#94A3B8] max-w-2xl mt-1">
            Build production-grade privacy tools using our pure TypeScript monorepo packages. Zero
            external servers, strictly typed, vetted cryptography, and 100% client-side execution.
          </p>
        </div>

        {/* Install Command Pill */}
        <button
          type="button"
          onClick={handleCopyInstall}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B0F19] hover:bg-[#1E293B] border border-[#1E293B] text-xs font-mono text-[#94A3B8] hover:text-white transition-all shadow-sm"
        >
          <Terminal className="w-3.5 h-3.5 text-[#3B82F6]" />
          <span>pnpm add @ombrix/edge-sdk</span>
          {copiedInstall ? (
            <Check className="w-3.5 h-3.5 text-[#14B8A6]" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-[#64748B]" />
          )}
        </button>
      </div>

      {/* Interactive Code Playground Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Workflow Selector */}
        <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-4">
          <h3 className="text-base font-bold font-['Sora'] text-white flex items-center gap-2">
            <Code2 className="w-4 h-4 text-[#A855F7]" />
            <span>Workflow Showcase</span>
          </h3>

          <div className="space-y-1.5">
            {(
              [
                { id: 'basic', label: '1. Basic Steganography', icon: Box },
                { id: 'encrypted', label: '2. Encrypted & Signed', icon: ShieldCheck },
                { id: 'lens', label: '3. Carrier Lens & Bitplanes', icon: Sparkles },
                { id: 'benchmark', label: '4. Stego Lab Benchmark', icon: Cpu },
                { id: 'link', label: '5. Ephemeral Link Sharing', icon: Layers },
                { id: 'batch', label: '6. Batch Multi-Carrier', icon: Terminal },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const isActive = selectedSnippet === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedSnippet(item.id);
                    setExecutionOutput(null);
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-medium text-left flex items-center gap-2.5 transition-all ${
                    isActive
                      ? 'bg-[#7C3AED]/20 border border-[#7C3AED] text-white shadow-sm'
                      : 'bg-[#0B0F19] border border-transparent text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#A855F7]' : 'text-[#64748B]'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#1E293B] space-y-2">
            <button
              type="button"
              disabled={isExecuting}
              onClick={handleLiveExecute}
              className="w-full py-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-[#7C3AED]/20 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              <span>{isExecuting ? 'Executing in Sandbox...' : 'Run in Browser Sandbox'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Code Viewer & Live Console */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold font-['Sora'] text-white">
                  {currentSnippet.title}
                </h3>
                <p className="text-[11px] text-[#64748B]">{currentSnippet.subtitle}</p>
              </div>

              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B0F19] hover:bg-[#1E293B] text-[#94A3B8] hover:text-white text-xs font-mono border border-[#1E293B] transition-all"
              >
                {copiedCode ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#14B8A6]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-[11px] font-mono text-[#E2E8F0] overflow-x-auto leading-relaxed">
              <code>{currentSnippet.code}</code>
            </pre>
          </div>

          {/* Live Sandbox Execution Output */}
          {executionOutput && (
            <div className="p-5 rounded-2xl bg-[#0B0F19] border border-[#14B8A6]/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#14B8A6] font-bold flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Sandbox Live Console Output</span>
                </span>
                <span className="text-[10px] text-[#64748B]">Browser WebAssembly & Web Crypto</span>
              </div>
              <pre className="p-3 rounded-lg bg-[#111827] border border-[#1E293B] text-xs font-mono text-white whitespace-pre-wrap">
                {executionOutput}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Monorepo Architecture Directory */}
      <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E293B] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold font-['Sora'] text-white">
              OMBRIX Monorepo Architecture & Package Directory
            </h3>
            <p className="text-xs text-[#94A3B8]">
              All 12 packages strictly tested, audited, and published with zero server dependencies
            </p>
          </div>
          <span className="text-xs font-mono text-[#14B8A6] px-2.5 py-1 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/30">
            100% Vitest & Strict TypeScript
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {monorepoPackages.map((pkg) => (
            <div
              key={pkg.name}
              className="p-3.5 rounded-xl bg-[#0B0F19] border border-[#1E293B] space-y-1 hover:border-[#3B82F6]/40 transition-colors"
            >
              <div className="font-mono text-xs font-semibold text-[#3B82F6] flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5" />
                <span>{pkg.name}</span>
              </div>
              <p className="text-[11px] text-[#94A3B8] leading-snug">{pkg.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
