# OMBRIX Architecture Documentation

**Document Status:** v1.0  
**Project:** OMBRIX — Local-First Secure Media Messaging & Steganography Research

---

## 1. Monorepo Organization

The OMBRIX repository is organized as a pnpm monorepo with strict package boundaries:

```
OMBRIX/
├── apps/
│   └── web/                   # Vite 6 + React 19 + Tailwind CSS application shell & 8 studios
├── packages/
│   ├── image-validation/     # Static PNG validation, chunk inspection, decompression bomb defense
│   ├── payload-protocol/     # OMB1 binary envelope parser & serializer
│   ├── stego-interface/      # Common steganography contracts, options, and error hierarchies
│   ├── stego-png-lsb/        # Baseline sequential RGB LSB embed & extract engine
│   ├── stego-worker/         # Dedicated Web Worker sandbox with cancellation support
│   ├── crypto-adapter/       # Vetted Libsodium adapters (X25519, Ed25519, Argon2id, BLAKE2b)
│   ├── carrier-lens/         # Static PNG chunk inspection, bitplane visualizer, frequency histogram
│   ├── stego-lab/            # LSB Matching (±1), distortion metrics (PSNR, MSE, SSIM, MAE), benchmark runner
│   ├── transit-trace/        # Lossy transit simulator (JPEG, resize, noise) & Chi-Square (PoV) forensics
│   ├── link-sharing/         # Ephemeral sharing containers, TTL timestamps, BLAKE2b carrier hash ring binding
│   ├── batch-pipeline/       # Multi-carrier capacity planning, chunked striped payloads, worker pools
│   ├── edge-sdk/             # Unified public TypeScript SDK facade (`Ombrix.*`)
│   ├── stego-advanced/       # Research stego engines: PVD (Wu & Tsai), 2D Haar DWT, JPEG 8x8 DCT
│   └── stego-forensics/      # Advanced steganalysis: RS (Fridrich), SPA (Dumitrescu), Noise Residual, Consensus
└── docs/                     # Specifications, architecture, threat model, algorithms, licenses
```

---

## 2. Core Architectural Principles

1. **Separation of Concerns:**
   - Cryptographic confidentiality is handled independently from steganographic carrier embedding.
   - Steganography methods implement a common typed interface (`StegoMethod`).
   - Image format validation occurs before any raster decoding or steganographic manipulation.
2. **Local-First & Zero-Telemetry:**
   - All image validation, payload serialization, embedding, and extraction execute directly in the browser.
   - No external APIs, cloud secret stores, or server-side media processing.
3. **Dedicated Processing Sandbox:**
   - Steganography algorithms execute within Web Workers using transferable `ArrayBuffer` objects to preserve main thread responsiveness and avoid multi-megabyte garbage collection pauses.
   - Cancellation is supported cooperatively via `AbortSignal`.

---

## 3. Data Flow Pipelines

### 3.1 Concealment Pipeline (Universal Dual-Layer Embed)

```
[User Text / Secret File / Passkey]
        │
        ▼
[Payload Protocol: Passkey Armor / OMB1 Envelope]
        │
        ▼
[Carrier Image] ──► [Image Validation: Dimensions & Bomb Defense]
                            │
                            ▼
    ┌────────────────────────────────────────────────────────┐
    │  Web Worker Sandbox: Dual-Layer Hyper-Matrix Embedding │
    │                                                        │
    │  1. Layer 1 (Robust Carrier):                          │
    │     4x4 sub-quadrant block luminance differential      │
    │     survives WhatsApp JPEG 75 & downscaling            │
    │                                                        │
    │  2. Layer 2 (High-Capacity Wavelet Vault):             │
    │     2D Haar DWT + PVD ±1 LSB matching on top           │
    │     carries multi-megabyte secret files losslessly     │
    └────────────────────────────────────────────────────────┘
                            │
                            ▼
    ┌────────────────────────────────────────────────────────┐
    │                Dual-Format Output Exporter             │
    │  • Lossless Stego PNG (for Document sharing & cloud)   │
    │  • WhatsApp Safe JPEG (1280px native photo sending)    │
    └────────────────────────────────────────────────────────┘
```

### 3.2 Reveal Pipeline (Fallback Extract)

```
[Uploaded Stego Carrier (PNG or WhatsApp JPEG)]
        │
        ▼
[Image Validation: Verify Header & Chunk Integrity]
        │
        ▼
┌────────────────────────────────────────────────────────┐
│  Web Worker Sandbox: Universal Hyper-Matrix Extraction │
│                                                        │
│  Attempt 1: High-Capacity Wavelet LSB Extraction       │
│  • Checks HYPR magic + 8-byte HMAC-SHA256              │
│  • Succeeded? ──► Decrypt & Return Payload             │
│                                                        │
│  Attempt 2: Lossy-Resilient Fallback (WhatsApp JPEG)   │
│  • Probes native & candidate scale resolutions         │
│  • Barker Sync Marker detection (0x3D4C5A9F)           │
│  • Majority-vote FEC + ChaCha20 decryption             │
│  • HMAC tag verification ──► Return Payload            │
└────────────────────────────────────────────────────────┘
        │
        ▼
[Payload Protocol: Unlock Passkey / 32-Byte Token / Chameleon]
        │
        ▼
[Recovered Payload Metadata & Plaintext / File]
```
