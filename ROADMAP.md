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
│ Phase 2: Steganography Engine Baseline & Worker Sandbox                │  [COMPLETED]
│  • M4: Steganography Interface & Standard Contracts                   │
│  • M5: Deterministic Sequential RGB LSB Embed / Extract                │
│  • M6: Dedicated Web Worker Sandbox (Transferables & Cancellation)     │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│ Phase 3: Cryptographic Messaging & Vault                               │  [COMPLETED]
│  • M7: Vetted Cryptographic Adapter (Libsodium Sealed Boxes, Ed25519)  │
│  • M8: Key Management Vault & Fingerprint Verification                 │
│  • M9: End-to-End Secure Studio Workflow                               │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│ Phase 4: Lens, Lab & Transmission Resilience                           │  [COMPLETED]
│  • M10: Carrier Lens (Inspection, Bitplane Analysis, Histograms)       │
│  • M11: Stego Lab (Method Comparison, PVD, LSB Matching)               │
│  • M12: Transit & Trace (Transformations, Resilience, Forensics)       │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│ Phase 5: Link, Flow & Edge Ecosystem                                   │  [COMPLETED]
│  • M13: OMBRIX Link (Ephemeral Containers, TTL, Hash Ring Validation)  │
│  • M14: OMBRIX Flow (Batch Pipeline, Capacity Planning, Worker Pool)   │
│  • M15: OMBRIX Edge (Public SDK Facade, CLI & Developer Playground)    │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│ Phase 6: Research-Grade Steganography & Steganalysis                   │  [ACTIVE]
│  • M16: Advanced Engines (PVD, Haar DWT Multi-Band, JPEG 8x8 DCT)      │
│  • M17: Advanced Steganalysis (Fridrich RS, Sample Pair Analysis, SPA) │
│  • M18: OMBRIX Scan & Research Lab Studio (Consensus Forensics Suite)  │
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

### Phase 3 — Cryptographic Messaging & Vault [COMPLETED]
- **Milestone 7:** Vetted cryptographic library adapter (`@ombrix/crypto-adapter`: Libsodium X25519 sealed boxes, Ed25519 detached signatures, Argon2id KDF, BLAKE2b key ID / fingerprints).
- **Milestone 8:** OMBRIX Vault (`apps/web/src/components/VaultStudio.tsx`: Ephemeral keypair generation, fingerprint verification, contacts address book, Argon2id password-protected `.ombrix-vault` bundle export and restore).
- **Milestone 9:** End-to-end Secure Studio workflow (`apps/web/src/components/CoreStudio.tsx`: Encrypted recipient framing, Ed25519 detached signing, LSB raster embedding, worker sandbox extraction, authenticated decryption, signature verification, and discrete security status badges).

---

### Phase 4 — Lens, Lab & Transmission Resilience [COMPLETED]
- **Milestone 10:** Carrier Lens (`@ombrix/carrier-lens` & `apps/web/src/components/LensStudio.tsx`):
  - Advanced static PNG chunk and header inspection (IHDR, IDAT, color types, bit depths, compression).
  - Multi-channel Bitplane Visualizer (isolating Bit 0 LSB through Bit 7 MSB for Red, Green, Blue, Alpha channels to visually inspect stego noise vs natural image gradients).
  - Real-time 256-bin RGB frequency histograms and channel balance diagnostics.
  - Pixel Difference Map comparing original carrier vs stego carrier with 100x amplification.
- **Milestone 11:** Stego Lab (`@ombrix/stego-lab` & `apps/web/src/components/LabStudio.tsx`):
  - Alternative steganographic baseline: LSB Matching (randomized $\pm 1$ bit flipping to resist elementary Chi-square attack patterns).
  - Quantitative image quality benchmark suite: PSNR (Peak Signal-to-Noise Ratio), MSE (Mean Squared Error), SSIM approximation, and embedding throughput.
  - Side-by-side comparative laboratory evaluating payload capacity vs visual/statistical distortion across algorithms.
- **Milestone 12:** Transit & Trace (`@ombrix/transit-trace` & `apps/web/src/components/TransitStudio.tsx`):
  - Transit Transformation Simulator: In-browser execution of real-world image operations (lossy JPEG compression at configurable quality, canvas bilinear downscale/upscale resizing, simulated messenger/social media recompression, and bit-flipping noise).
  - Survival and recovery verification: Rigorous verification of payload/envelope survival across lossy pipelines, demonstrating why spatial LSB fails under lossy channels (educational transparency).
  - Trace Forensics: Chi-square ($\chi^2$) sample pair analysis (Pairs of Values - PoVs) to calculate empirical p-values detecting spatial LSB tampering.

---

### Phase 5 — Link, Flow & Edge Ecosystem [COMPLETED]
- **Milestone 13: OMBRIX Link (`@ombrix/link-sharing` & `apps/web/src/components/LinkStudio.tsx`):**
  - Ephemeral sharing container format with configurable Time-to-Live (TTL) expiration timestamps.
  - Tamper-evident cryptographic hash ring binding carrier image BLAKE2b/SHA-256 integrity to container access.
  - Optional Argon2id/KDF password derivation protecting the embedded steganographic bundle.
  - Zero-server client-side URI fragment packaging (`#link=...`) and `.ombrix-link` portable container export.
  - Transparent threat disclosure: Explains client-side enforcement boundaries (no false claims of server-side destruction).
- **Milestone 14: OMBRIX Flow (`@ombrix/batch-pipeline` & `apps/web/src/components/FlowStudio.tsx`):**
  - High-throughput multi-carrier batch embedding and extraction engine.
  - Dynamic capacity planner calculating individual carrier capacities, allocating discrete payloads or chunked streams.
  - Concurrency-controlled worker pool execution with real-time aggregated progress reporting.
  - Batch results export with manifest generation and automated regression verification.
- **Milestone 15: OMBRIX Edge & Public SDK (`packages/edge-sdk` and `apps/web/src/components/EdgeStudio.tsx`):**
  - Unified, ergonomic TypeScript SDK facade exposing all 9 OMBRIX modules under a single cohesive interface (`Ombrix.embed`, `Ombrix.extract`, `Ombrix.inspect`, `Ombrix.benchmark`, `Ombrix.simulateTransit`, `Ombrix.createShareLink`, `Ombrix.batchProcess`).
  - Browser and CLI/Node environment compatibility.
  - Interactive Developer Playground in `EdgeStudio.tsx` featuring live syntax examples, parameter generators, and SDK export.

---

### Phase 6 — Research-Grade Steganography & Steganalysis [COMPLETED]
- **Milestone 16: Research Steganography Engines (`@ombrix/stego-advanced`):**
  - **PVD (Pixel Value Differencing):** Wu & Tsai (2003) spatial adaptive algorithm. Partitions pixels into adjacent pairs, computes differences, and adaptively allocates more bits into edge/textured regions while embedding fewer bits in smooth regions (HVS masking).
  - **2D Haar Discrete Wavelet Transform (DWT):** Multi-resolution frequency decomposition into $LL, LH, HL, HH$ sub-bands. Integer wavelet reconstruction with imperceptible detail-band coefficient modulation.
  - **JPEG 8x8 DCT Coefficient-Domain Engine:** Forward/Inverse DCT with standard $Q_{50}$ quantization matrices. Modulates quantized AC coefficients (avoiding zeros and ones) to implement true JPEG codec-domain steganography.
- **Milestone 17: Advanced Steganalysis & Forensics (`@ombrix/stego-forensics`):**
  - **RS Steganalysis (Fridrich et al., 2001):** Dual-mask ($M, -M$) local variation analysis measuring Regular ($R$) and Singular ($S$) block distributions to estimate hidden payload ratios ($\hat{\alpha} \in [0, 1]$) with mathematical curve fitting.
  - **Sample Pair Analysis (SPA / Dumitrescu et al., 2003):** Closed-form algebraic estimation of relative payload length across color channels.
  - **Spatial Noise Residual Variance:** 2nd-derivative Laplacian kernel filtering isolating high-frequency noise profiles to distinguish natural sensor noise from steganographic perturbations.
- **Milestone 18: OMBRIX Scan & Research Lab Studio (`ScanStudio.tsx` & `LabStudio.tsx` in `apps/web`):**
  - Full-featured **OMBRIX Scan** forensic workbench analyzing suspect images with multi-detector consensus (RS, SPA, $\chi^2$, Noise Residual), accompanied by required scientific caveats and false-positive disclosure.
  - Integration of PVD, DWT, and DCT into the comparative **OMBRIX Lab** benchmark matrix evaluating PSNR, SSIM, MSE, throughput, and steganalysis detectability.

---

### Phase 7 — Release Hardening & Production Polish [COMPLETED]
- **Milestone 19: Security Review, CSP Enforcement & Dependency License Inventory:**
  - Content Security Policy (CSP) enforcement in `apps/web/index.html` blocking all outbound network connections (`connect-src 'none'`), mathematically guaranteeing zero-telemetry local-first operation.
  - Complete dependency and license inventory (`docs/licenses.md`) documenting all direct and transitive packages and verifying permissive open-source licenses (MIT, Apache-2.0, BSD-3-Clause, ISC).
  - Security audit and threat model publication (`docs/threat-model.md` and `docs/key-management.md`) detailing Libsodium sealed-box boundaries, Argon2id KDF parameters, and memory retention constraints.
- **Milestone 20: Fuzzing Verification, Robustness Hardening & Curated Demo Dataset:**
  - Robustness & mutation fuzzing suite across all protocol envelopes, chunked streams, and advanced stego formats ensuring zero unhandled crashes or unconstrained loops.
  - Curated demo dataset (`tests/fixtures/demo-dataset/`) providing reference carriers, benchmark stego images across all 5 algorithms, malformed test vectors, and cryptographic keys.
  - Integration verification test suite (`tests/integration/phase7-security-release.test.ts`).
- **Milestone 21: Production Documentation, Browser Compatibility & Release Packaging:**
  - Exhaustive technical documentation:
    - `docs/algorithms.md`: Mathematical formulations for all 5 stego methods and all 4 forensic detectors.
    - `docs/limitations.md`: Explicit transparent disclosures on active warden scenarios, lossy channel vulnerabilities, and statistical detection boundaries.
    - `docs/browser-compatibility.md`: Cross-browser analysis (Chromium, Firefox, Safari) across Web Workers, WASM Libsodium, TypedArrays, and Canvas APIs.
    - `docs/release-process.md`: Reproducible build instructions, package verification, subresource integrity, and signed artifact guidelines.
  - Final end-to-end verification across the entire monorepo with 215 tests passing across 39 test suites.

---

### Phase 8 — CLI Tooling, Experiment Engine & Offline PWA [COMPLETED]
- **Milestone 22: Scientific Experiment Engine (`@ombrix/edge-sdk` / `OmbrixExperimentV1`):**
  - Section 16.5 Reproducibility Record implementation capturing experiment IDs, timestamps, algorithm versions, parameters, seeds, distortion metrics (PSNR, MSE, SSIM, MAE), and forensic consensus outcomes.
  - Standardized `.ombrix-experiment.json` format parser and serializer.
- **Milestone 23: OMBRIX CLI (`@ombrix/cli`):**
  - Standalone terminal tool (`ombrix`) exposing CLI commands: `embed`, `extract`, `scan`, `benchmark`, `experiment`, and `verify`.
  - Built-in pure TypeScript PNG encoder/decoder utilizing `node:zlib` and zero external native dependencies.
  - Terminal ANSI colored reports and `--json` output format for CI/CD automated steganography security pipelines.
- **Milestone 24: Offline PWA & Air-Gapped Deployment:**
  - Web App Manifest (`manifest.webmanifest`) and Cache-First Service Worker (`sw.js`) enabling 100% installable, air-gapped forensic desktop deployment.
  - Strict Content Security Policy (`connect-src 'none'`) mathematically preventing any network exfiltration.
  - Comprehensive end-to-end integration test suite (`tests/integration/phase8-cli-experiment.test.ts`).

---

## Complete Project Verification Summary

| Phase | Title | Modules / Packages | Status | Test Suites |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | Product & Architecture Foundation | Root Monorepo, Configs, Design Tokens | **COMPLETED** | — |
| **Phase 1** | Image Validation & Payload Protocol | `@ombrix/image-validation`, `@ombrix/payload-protocol` | **COMPLETED** | 6 suites |
| **Phase 2** | Stego Core, Workers & Web Shell | `@ombrix/stego-interface`, `@ombrix/stego-png-lsb`, `@ombrix/stego-worker`, `@ombrix/web` | **COMPLETED** | 3 suites |
| **Phase 3** | Vault, Sealed Box & Cryptography | `@ombrix/crypto-adapter`, `VaultStudio.tsx`, `CoreStudio.tsx` | **COMPLETED** | 6 suites |
| **Phase 4** | Lens, Lab & Transmission Resilience | `@ombrix/carrier-lens`, `@ombrix/stego-lab`, `@ombrix/transit-trace` | **COMPLETED** | 8 suites |
| **Phase 5** | Link, Flow & Edge Ecosystem | `@ombrix/link-sharing`, `@ombrix/batch-pipeline`, `@ombrix/edge-sdk` | **COMPLETED** | 7 suites |
| **Phase 6** | Research Steganography & Steganalysis | `@ombrix/stego-advanced`, `@ombrix/stego-forensics`, `ScanStudio.tsx` | **COMPLETED** | 8 suites |
| **Phase 7** | Release Hardening & Production Polish | CSP, Security Audit, Demo Dataset, Documentation | **COMPLETED** | 1 suite (7 tests) |
| **Phase 8** | CLI Tooling, Experiment Engine & Offline PWA | `@ombrix/cli`, `OmbrixExperimentV1`, `sw.js`, `manifest.webmanifest` | **COMPLETED** | 3 suites (18 tests) |
| **Total** | **OMBRIX Complete Suite** | **16 Workspace Projects, 8 Interactive Studios, CLI & PWA** | **100% VERIFIED** | **42 suites (233 tests)** |




