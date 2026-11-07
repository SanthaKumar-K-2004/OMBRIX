# OMBRIX Roadmap

**Brand:** OMBRIX  
**Tagline:** *Beyond what the eye can see.*  
**Architecture:** Local-first, browser-based secure media messaging, steganography laboratory, carrier analysis, and transmission research.

---

## Roadmap Overview

OMBRIX development follows an evidence-based, incremental engineering loop. Every milestone enforces strict type safety, runtime boundary validation, zero invented cryptography, and automated test verification.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 0: Foundation, Architecture, Threat Model & Protocol Definition  │  [COMPLETED]
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│ Phase 1: Reliable Core Foundation & Application Shell                  │  [ACTIVE]
│  • M1: Web Application Shell (Vite 6, React 19, Design Tokens)         │
│  • M2: Static PNG Image Validation & Bomb Defense                      │
│  • M3: OMB1 Binary Payload Envelope Protocol                           │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│ Phase 2: Steganography Engine Baseline & Worker Sandbox                │  [ACTIVE]
│  • M4: Steganography Interface & Standard Contracts                   │
│  • M5: Deterministic Sequential RGB LSB Embed / Extract                │
│  • M6: Dedicated Web Worker Sandbox (Transferables & Cancellation)     │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│ Phase 3: Cryptographic Messaging & Vault (Upcoming)                    │  [PLANNED]
│  • M7: Vetted Cryptographic Adapter (Libsodium Sealed Boxes, Ed25519)  │
│  • M8: Key Management Vault & Fingerprint Verification                 │
│  • M9: End-to-End Secure Studio Workflow                               │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│ Phase 4: Lens, Lab & Transmission Resilience (Upcoming)                │  [PLANNED]
│  • M10: Carrier Lens (Inspection, Bitplane Analysis, Histograms)       │
│  • M11: Stego Lab (Method Comparison, PVD, LSB Matching)               │
│  • M12: Transit & Trace (Transformations, Resilience, Forensics)       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Milestone Specifications

### Milestone 0 — Repository Audit & Architecture Foundation [COMPLETED]
- Establish git repository on `main`.
- Configure pnpm workspace with `apps/*` and `packages/*`.
- Setup Biome linter/formatter and strict TypeScript base configuration.
- Specify architecture, threat model, and initial protocol designs.

---

### Phase 1 — Reliable Core Foundation & Application Shell

#### Milestone 1: Application Shell & Design System (`apps/web`)
- **Scope:**
  - Production-grade Web Application Shell using Vite 6, React 19, and Tailwind CSS.
  - Implement design tokens from `Design.jpeg`:
    - Obsidian: `#0B0F19`
    - Violet Core: `#7C3AED`
    - Aurora Purple: `#A855F7`
    - Neon Blue: `#3B82F6`
    - Teal Accent: `#14B8A6`
    - Slate: `#94A3B8`
    - Mist: `#E2E8F0`
  - Typography: Sora for brand headings, Inter for UI elements, JetBrains Mono for metrics/hex.
  - Interactive navigation for OMBRIX product suite: Core, Vault, Link, Scan, Flow, Edge.
  - Accessible, responsive layout with visible focus states and reduced-motion support.

#### Milestone 2: Static PNG Image Validation (`packages/image-validation`)
- **Scope:**
  - Header and magic byte signature verification (`\x89PNG\r\n\x1a\n`).
  - Strict chunk parsing (`IHDR`, `IDAT`, `IEND`, etc.) with CRC32 integrity verification.
  - Animated PNG (APNG) rejection via `acTL`, `fcTL`, `fdAT` chunk detection.
  - Decompression bomb defense: max dimension limits (8192px), max pixel area (16MP), expansion ratio thresholding, compressed file size bounds.
  - Typed error hierarchy and validation result contracts.

#### Milestone 3: Payload Protocol Foundation (`packages/payload-protocol`)
- **Scope:**
  - Binary envelope parser and serializer for the `OMB1` format according to `docs/protocol-v1.md`.
  - Header layout:
    - Magic bytes: `OMB1` (4 bytes)
    - Protocol Version: `0x01` (1 byte)
    - Crypto Suite: 1 byte (`0x00` Plaintext, `0x01` X25519-XSalsa20-Poly1305, etc.)
    - Stego Method ID: 1 byte (`0x01` Sequential RGB LSB)
    - Flags bitfield: 1 byte (Compressed, Signed, Has Recipient Fingerprint, Is File)
    - Message ID: 16 bytes (UUID / random salt)
    - Recipient Fingerprint: 8 bytes (conditional)
    - Payload Length: 4 bytes big-endian uint32 (bounded, max 16MB)
    - Header CRC32: 4 bytes big-endian uint32
    - Payload Data: Bounded ciphertext or plaintext bytes
    - Optional Signature: 64 bytes (Ed25519)
  - Canonical serialization, bounds validation, checksum verification, and malformed input rejection.

---

### Phase 2 — Steganography Engine Baseline & Worker Sandbox

#### Milestone 4: Steganography Interface (`packages/stego-interface`)
- **Scope:**
  - Standard abstract contracts for steganographic methods (`StegoMethod`).
  - Common types: `CarrierImage`, `StegoOptions`, `CapacityReport`, `CarrierAnalysis`.
  - Typed error hierarchy: `InsufficientCapacityError`, `InvalidCarrierError`, `ExtractionError`, `StegoAbortError`.

#### Milestone 5: Deterministic Sequential RGB LSB Baseline (`packages/stego-png-lsb`)
- **Scope:**
  - Deterministic round-trip embedding and extraction for static PNG carriers.
  - Channel order: R → G → B (alpha channel preserved to prevent premultiplication distortion).
  - Traversal order: Raster scan (row-major).
  - 32-bit big-endian length prefix framing in initial channel LSBs.
  - Strict capacity checks and bounded buffer extraction.
  - Labelled as educational baseline; no claims of undetectability or transformation resistance.

#### Milestone 6: Dedicated Web Worker Processing Sandbox
- **Scope:**
  - Web Worker architecture decoupling CPU-intensive pixel manipulation from the UI thread.
  - Zero-copy transferable objects (`ArrayBuffer`) for high-throughput raster buffers.
  - Cooperative cancellation via `AbortSignal` and worker termination.
  - Typed message protocol (`EMBED`, `EXTRACT`, `ANALYZE`, `CANCEL`, `PROGRESS`, `SUCCESS`, `ERROR`).

---

### Phase 3 — Cryptographic Messaging & Vault [PLANNED]
- **Milestone 7:** Vetted cryptographic library adapter (libsodium sealed boxes, Ed25519 signatures, Argon2id/scrypt KDF).
- **Milestone 8:** OMBRIX Vault (key pair generation, fingerprint verification, encrypted backup).
- **Milestone 9:** End-to-end Secure Studio workflow (encrypt → envelope → embed → export → import → extract → decrypt).

---

### Phase 4 — Lens, Lab & Transmission Resilience [PLANNED]
- **Milestone 10:** Carrier Lens (metadata extraction, bitplane visualizer, channel histograms).
- **Milestone 11:** Stego Lab (comparative benchmarks, LSB matching, PVD).
- **Milestone 12:** Transit & Trace (simulated transformations, recovery testing, forensics).
