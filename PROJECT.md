# Project: OMBRIX (Phase 1 Foundation)

## Architecture
OMBRIX is an air-gapped, zero-leak, high-security steganographic carrier studio and payload delivery platform. Phase 1 establishes the production-grade foundation across three workspace boundaries:
1. **`packages/image-validation` (`@ombrix/image-validation`)**: Pure TypeScript library providing memory-safe, high-speed static PNG validation, chunk sequencing, APNG rejection, dimension/pixel bounding, and decompression bomb protection.
2. **`packages/payload-protocol` (`@ombrix/payload-protocol`)**: Pure TypeScript binary serialization and parsing library for the `OMB1` versioned envelope format, featuring fixed 48-byte headers, CRC-32 checksums, 2 MiB bounded payloads, and canonical signature input generation.
3. **`apps/web` (`@ombrix/web`)**: Production web application shell built with Vite 6, React 19, and Tailwind CSS. Implements the high-fidelity dark aesthetic from `Design.jpeg` (Obsidian, Violet Core, Aurora Purple, Neon Blue, Teal Accent), responsive container hierarchy, typography (Sora, Inter, JetBrains Mono), and the initial Studio workflow integrating image validation and payload envelope handling.

```
+-----------------------------------------------------------------------+
|                              apps/web                                 |
|      (React 19, Vite 6, Tailwind CSS, Sora / Inter / JetBrains Mono)  |
|                                                                       |
|   +-----------------------+               +-----------------------+   |
|   |   Carrier Inspector   |               |    Payload Editor     |   |
|   +-----------+-----------+               +-----------+-----------+   |
+---------------|---------------------------------------|---------------+
                |                                       |
                v                                       v
+-------------------------------+       +-------------------------------+
|   packages/image-validation   |       |   packages/payload-protocol   |
| - 8-byte PNG signature        |       | - 48-byte OMB1 fixed header   |
| - IHDR chunk bounds           |       | - CRC-32 header checksum      |
| - APNG chunk rejection        |       | - 2 MiB bounded length        |
| - Decompression bomb pre-check|       | - Big-Endian canonical codec  |
+-------------------------------+       +-------------------------------+
```

## Feature Inventory
Every feature identified during the Survey phase is enumerated below with its assigned milestone.

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Monorepo hygiene & formatting | Resolve root trailing newline diffs in `biome.json` and `tsconfig*.json` | M1 | Survey 1 |
| 2 | PNG Magic Bytes Validation | Enforce 8-byte signature `89 50 4E 47 0D 0A 1A 0A` | M1 | Survey 2, Blueprint §12 |
| 3 | IHDR Chunk Validation | Validate first chunk is IHDR, length=13, valid color/depth matrix | M1 | Survey 2, W3C PNG Spec |
| 4 | Image Dimension Bounds | Enforce $1 \le W \le 4096$ and $1 \le H \le 4096$ | M1 | Survey 2, Master Prompt §4.4 |
| 5 | Pixel Area Limit | Enforce $W \times H \le 12,000,000$ pixels | M1 | Survey 2, Master Prompt §4.4 |
| 6 | Compressed File Size Limit | Enforce input file size $\le 15$ MiB ($15,728,640$ bytes) | M1 | Survey 2, Blueprint §12 |
| 7 | APNG Chunk Rejection | Detect and reject `acTL`, `fcTL`, and `fdAT` animation chunks | M1 | Survey 2, `ORIGINAL_REQUEST.md` |
| 8 | Decompression Bomb Protection | Pre-check scanline raw bytes ($> 64$ MB) and compression ratio ($> 500:1$) | M1 | Survey 2, `ORIGINAL_REQUEST.md` |
| 9 | Chunk Stream Traversal | Enforce consecutive IDAT chunks, CRC-32 validation, and clean IEND termination | M1 | Survey 2, W3C PNG Spec |
| 10 | Typed Image Validation Errors | Complete error hierarchy extending `ImageValidationError` | M1 | Survey 2 |
| 11 | OMB1 Magic Bytes & Version | Validate `"OMB1"` (`0x4F4D4231`) prefix and protocol version `1` | M2 | Survey 2, Blueprint §10 |
| 12 | Fixed 48-Byte Header Codec | Serialize and parse 48-byte binary header with Big-Endian fields | M2 | Survey 2, Blueprint §10 |
| 13 | Header CRC-32 Checksum | Compute and verify IEEE 802.3 CRC-32 over header bytes 0..43 | M2 | Survey 2, `ORIGINAL_REQUEST.md` |
| 14 | Bounded Payload Enforcement | Reject payloads exceeding 2 MiB ($2,097,152$ bytes) before allocation | M2 | Survey 2, Master Prompt §4.4 |
| 15 | Canonical Envelope Serialization | Deterministic round-trip serialization of header, payload, and trailer | M2 | Survey 2, `ORIGINAL_REQUEST.md` |
| 16 | Canonical Signature Input | Define and export bytes for Ed25519 signing (Header 0..43 + Payload) | M2 | Survey 2, Blueprint §10 |
| 17 | Protocol Flags & Optional Trailer | Handle timestamp, recipient fingerprint, file flag, and Ed25519 trailer | M2 | Survey 2, Blueprint §10 |
| 18 | Typed Protocol Errors | Complete error hierarchy extending `PayloadProtocolError` | M2 | Survey 2 |
| 19 | Populate `docs/protocol-v1.md` | Document authoritative OMB1 specification in the repository | M2 | Survey 1, Survey 2 |
| 20 | Design Tokens & Tailwind Theme | Implement Obsidian `#0B0F19`, Violet `#7C3AED`, Aurora `#A855F7`, Neon `#3B82F6`, Teal `#14B8A6` | M3 | Survey 3, `Design.jpeg` |
| 21 | Typography Integration | Sora (Headlines), Inter (UI/Body), JetBrains Mono (Diagnostics) | M3 | Survey 3, `Design.jpeg` |
| 22 | Isometric Emblem & Logo Component | Responsive 3D prism logo SVG matching `Design.jpeg` | M3 | Survey 3, `Design.jpeg` |
| 23 | Application Shell Layout | Header, Suite Navigation, Responsive Container, and Status Bar | M3 | Survey 3, `Design.jpeg` |
| 24 | Studio Carrier Inspector UI | Drag-and-drop PNG dropzone with live validation checklist & metadata display | M3 | Survey 3, Blueprint §12 |
| 25 | Studio Payload Editor UI | Text/binary payload input, live OMB1 envelope preview, and CRC32 telemetry | M3 | Survey 3, Blueprint §10 |
| 26 | Lean Production Bundle & Scripts | Clean Vite 6 bundle, `pnpm dev` and `pnpm build` compatibility | M3 | Survey 1, Survey 3 |
| 27 | Opaque-Box E2E Test Suite | 4-tier test suite covering feature coverage, boundaries, pairs, and workloads | M4 | Master Prompt, Project Pattern |
| 28 | Monorepo Full Verification | Root typecheck, Biome check, and test suite pass with 0 errors | M4 | `ORIGINAL_REQUEST.md` |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | `image-validation` | Implement `@ombrix/image-validation` package with comprehensive Vitest suite | none | PLANNED |
| 2 | `payload-protocol` | Implement `@ombrix/payload-protocol` package and populate `docs/protocol-v1.md` | none | PLANNED |
| 3 | `app-shell-ui` | Implement `@ombrix/web` shell, design system tokens, and Studio UI | M1, M2 | PLANNED |
| 4 | `e2e-verification` | E2E testing track, monorepo test integration, build verification, and final audit | M1, M2, M3 | PLANNED |

## Interface Contracts

### `@ombrix/image-validation` Interface Contract
```typescript
export interface PngValidationLimits {
  maxFileSize?: number;          // Default: 15 * 1024 * 1024 (15 MiB)
  maxWidth?: number;             // Default: 4096
  maxHeight?: number;            // Default: 4096
  maxPixels?: number;            // Default: 12_000_000
  maxUncompressedBytes?: number; // Default: 64 * 1024 * 1024 (64 MiB)
  maxDecompressionRatio?: number;// Default: 500
}

export interface PngMetadata {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  colorTypeName: 'grayscale' | 'rgb' | 'palette' | 'grayscale-alpha' | 'rgba';
  channels: number;
  hasAlpha: boolean;
  interlaceMethod: 0 | 1;
  compressedSizeBytes: number;
  estimatedUncompressedBytes: number;
  totalPixels: number;
  chunkTypes: string[];
}

export type ValidationResult =
  | { valid: true; metadata: PngMetadata; warnings?: string[] }
  | { valid: false; error: ImageValidationError };

export function validatePng(buffer: Uint8Array, limits?: PngValidationLimits): ValidationResult;
export function validatePngOrThrow(buffer: Uint8Array, limits?: PngValidationLimits): PngMetadata;
```

### `@ombrix/payload-protocol` Interface Contract
```typescript
export const OMB1_MAGIC = new Uint8Array([0x4f, 0x4d, 0x42, 0x31]); // 'OMB1'
export const OMB1_VERSION = 1;
export const OMB1_HEADER_LENGTH = 48;
export const MAX_PAYLOAD_LENGTH = 2 * 1024 * 1024; // 2 MiB

export enum CipherSuiteId {
  NONE = 0x00,
  X25519_XSALSA20_POLY1305 = 0x01,
  HPKE_X25519_CHACHA20 = 0x02,
}

export enum EnvelopeFlags {
  HAS_SIGNATURE = 0x0001,
  HAS_RECIPIENT_FINGERPRINT = 0x0002,
  HAS_TIMESTAMP = 0x0004,
  IS_FILE = 0x0008,
}

export interface EnvelopeHeader {
  version: number;
  suiteId: CipherSuiteId;
  flags: number;
  messageId: Uint8Array; // 16 bytes
  timestamp: bigint;     // uint64 unix epoch ms
  recipientFingerprint: bigint; // uint64
  payloadLength: number; // uint32
  headerChecksum: number; // uint32 CRC-32
}

export interface ParsedEnvelope {
  header: EnvelopeHeader;
  payload: Uint8Array;
  signerKeyId?: Uint8Array; // 8 bytes if HAS_SIGNATURE
  signature?: Uint8Array;   // 64 bytes if HAS_SIGNATURE
}

export interface SerializeEnvelopeOptions {
  suiteId?: CipherSuiteId;
  messageId?: Uint8Array;
  timestamp?: bigint | number;
  recipientFingerprint?: bigint;
  isFile?: boolean;
  signerKeyId?: Uint8Array;
  signature?: Uint8Array;
}

export function serializeEnvelope(payload: Uint8Array, options?: SerializeEnvelopeOptions): Uint8Array;
export function parseEnvelope(data: Uint8Array, options?: { strict?: boolean }): ParsedEnvelope;
export function getCanonicalSignatureBytes(envelopeBytesOrHeader: Uint8Array, payload?: Uint8Array): Uint8Array;
```

## Code Layout
```
/home/santhakumar/Documents/projects/OMBRIX/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
├── biome.json
├── vitest.workspace.ts
├── docs/
│   └── protocol-v1.md                 # Authored in M2
├── packages/
│   ├── image-validation/              # Owned exclusively by M1 Worker
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── png.ts
│   │   │   ├── crc32.ts
│   │   │   ├── types.ts
│   │   │   └── errors.ts
│   │   └── tests/
│   │       ├── valid-png.test.ts
│   │       ├── apng.test.ts
│   │       ├── dimensions.test.ts
│   │       ├── decompression-bomb.test.ts
│   │       └── errors.test.ts
│   └── payload-protocol/              # Owned exclusively by M2 Worker
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── src/
│       │   ├── index.ts
│       │   ├── envelope.ts
│       │   ├── crc32.ts
│       │   ├── types.ts
│       │   └── errors.ts
│       └── tests/
│           ├── round-trip.test.ts
│           ├── checksum.test.ts
│           ├── length-bounds.test.ts
│           └── malformed.test.ts
├── apps/
│   └── web/                           # Owned exclusively by M3 Worker
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── index.css
│           ├── components/
│           │   ├── shell/
│           │   ├── ui/
│           │   └── studio/
│           └── hooks/
└── tests/                             # Owned exclusively by M4 Test Writer
    └── e2e/
        ├── e2e-integration.test.ts
        └── vectors/
