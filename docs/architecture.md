# OMBRIX Architecture Documentation

**Document Status:** v1.0  
**Project:** OMBRIX — Local-First Secure Media Messaging & Steganography Research

---

## 1. Monorepo Organization

The OMBRIX repository is organized as a pnpm monorepo with strict package boundaries:

```
OMBRIX/
├── apps/
│   └── web/                   # Vite 6 + React 19 + Tailwind CSS application shell
├── packages/
│   ├── image-validation/     # Static PNG validation, chunk inspection, decompression bomb defense
│   ├── payload-protocol/     # OMB1 binary envelope parser & serializer
│   ├── stego-interface/      # Common steganography contracts, options, and error hierarchies
│   ├── stego-png-lsb/        # Baseline sequential RGB LSB embed & extract engine
│   └── crypto-adapter/       # (Phase 3) Vetted cryptographic adapters
└── docs/                     # Specifications, architecture, threat model, roadmaps
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

### 3.1 Concealment Pipeline (Embed)

```
[User Text / File]
        │
        ▼
[Payload Protocol: Serialize OMB1 Envelope]
        │
        ▼
[Carrier PNG File] ──► [Image Validation: Static PNG & Bomb Defense]
                               │
                               ▼
        [Web Worker Sandbox: Sequential RGB LSB Embedding]
                               │
                               ▼
                    [Output Stego PNG File]
```

### 3.2 Reveal Pipeline (Extract)

```
[Uploaded Stego PNG File]
        │
        ▼
[Image Validation: Verify Header & Chunk Integrity]
        │
        ▼
[Web Worker Sandbox: Sequential RGB LSB Extraction]
        │
        ▼
[Payload Protocol: Parse & Verify OMB1 Envelope Checksum]
        │
        ▼
[Recovered Payload Metadata & Plaintext / File]
```
