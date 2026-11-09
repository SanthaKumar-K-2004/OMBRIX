<div align="center">

# OMBRIX™
### *Beyond what the eye can see.*

**Carrier-grade steganographic concealment, cryptographic scattering, edge-adaptive masking, and ±1 LSB matching.**

[![Tests](https://img.shields.io/badge/tests-451%20passed%20%2F%20100%25-emerald?style=for-the-badge&logo=vitest&logoColor=white)](https://github.com/SanthaKumar-K-2004/OMBRIX)
[![Architecture](https://img.shields.io/badge/architecture-100%25%20Client--Side-violet?style=for-the-badge&logo=webassembly&logoColor=white)](https://github.com/SanthaKumar-K-2004/OMBRIX)
[![Security](https://img.shields.io/badge/cryptography-Argon2id%20%2B%20Libsodium-blue?style=for-the-badge&logo=shield&logoColor=white)](https://github.com/SanthaKumar-K-2004/OMBRIX)
[![Linter](https://img.shields.io/badge/code%20style-biome%20clean-cyan?style=for-the-badge&logo=biome&logoColor=white)](https://biomejs.dev/)
[![Language](https://img.shields.io/badge/TypeScript-5.8%2B-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

<br/>

![OMBRIX Studio Interface](./Design.jpeg)

</div>

---

## ⚡ Executive Overview

**OMBRIX** is an advanced steganography and visual cryptography suite engineered entirely for client-side browser execution.

Classical steganographic utilities naively replace sequential least significant bits (LSBs). This naive replacement creates an asymmetric **Pair-of-Values (PoV)** histogram collapse and distinct spatial step artifacts that are instantly identified by automated steganalysis tools (such as **RS Steganalysis**, **Sample Pair Analysis**, and **Chi-Square $\chi^2$ distribution tests**).

OMBRIX solves this by decoupling the spatial raster into high-frequency wavelet subbands and edge-variance matrices. It combines **Discrete Wavelet Transforms (2D Haar DWT)**, **Wu & Tsai Pixel Value Differencing (PVD)**, and **CSPRNG pseudorandom scatter** with $\pm 1$ LSB matching. This ensures the carrier's second-order statistical moments, noise histograms, and adjacent pixel parity remain virtually undisturbed.

---

## 🔬 Core Working Architecture

OMBRIX is divided into two deterministic, isolated pipelines: the **Concealment Engine (Embedding Pipeline)** and the **Extraction Engine (Reveal Pipeline)**.

```
══════════════════════════════════════════════════════════════════════════════════════════════════════════════
                                    CONCEALMENT PIPELINE (ENCODE)
══════════════════════════════════════════════════════════════════════════════════════════════════════════════

 [ Plaintext Secret / Covert Photo ]
                  │
                  ▼
   1. Binary Envelope Framing
      ├─ Magic: OMB1 (0x4f 0x4d 0x42 0x31)
      ├─ Flags: Signed | Encrypted | Chameleon
      └─ Payload Serialization (Lossless Deflate Compression)
                  │
                  ▼
   2. Military-Grade Cryptographic Armor
      ├─ Memory-Hard KDF: Argon2id (RFC 9106, 64 MiB RAM, 2 Iterations, 16B Random Salt)
      ├─ Authenticated Encryption: XSalsa20-Poly1305 AEAD (24B Nonce + 16B MAC)
      └─ Asymmetric Attestation: Ed25519 Detached Signature on Canonical SignDoc
                  │
                  ▼
   3. Steganographic Modulation & Subband Mapping
      ├─ 2D Discrete Haar Wavelet Transform: Decomposes cover image into LL, LH, HL, HH subbands
      ├─ Edge-Adaptive PVD Matrix: Maps high-entropy data into high-contrast pixel boundaries
      ├─ CSPRNG Permutation Scattering: Fisher-Yates shuffle seeded by passkey digest
      └─ ±1 LSB Matching Modulo: Preserves second-order adjacent pixel parity
                  │
                  ▼
   4. Pure Lossless Deflate PNG Assembly
      ├─ Strips all non-essential chunks (No EXIF, GPS, PRNU camera noise, or author metadata)
      └─ Output: Stego Carrier PNG with PSNR > 52 dB (Bit-Exact Integrity)

══════════════════════════════════════════════════════════════════════════════════════════════════════════════
                                      EXTRACTION PIPELINE (DECODE)
══════════════════════════════════════════════════════════════════════════════════════════════════════════════

 [ Stego Carrier Image ]
                  │
                  ▼
   1. Web Streams Lossless PNG Decompression
      └─ Bypasses canvas GPU color-space transformations & Display-P3 gamma alteration
                  │
                  ▼
   2. Auto-Probe Method Identification & PRNG De-permutation
      ├─ Probes: Hyper-Matrix ──► Stealth Matrix ──► Sequential LSB ──► PVD ──► Haar DWT
      └─ Validates 4-byte OMB1 Envelope Magic Header
                  │
                  ▼
   3. Authenticated Cryptographic Decryption & Signature Verification
      ├─ Extracts 16-byte salt & 24-byte nonce
      ├─ Derives 32-byte key via Argon2id (or parses 256-bit token)
      ├─ Verifies Poly1305 MAC tag (Constant-Time Verification)
      └─ Verifies Ed25519 detached signature against sender identity
                  │
                  ▼
   4. In-Place RAM Zeroization
      ├─ Plaintext keys wiped immediately via sodium.memzero() in strict `finally` block
      ├─ Output: Restored Confidential Secret / High-Resolution Photo
      └─ Object URLs cleaned from browser blob registry (0 RAM Residue)
```

---

## 🛡️ Anti-Forensic & Steganalysis Resistance

### 1. Mathematical Defense Against Classical Detection

Classical LSB replacement introduces an asymmetry because even values $2k$ are modified only to $2k+1$, while odd values $2k+1$ are modified only to $2k$. This creates artificial flattening of histogram pairs:

$$h(2k) \approx h(2k+1)$$

OMBRIX defeats this using **$\pm 1$ LSB Matching (Modulo Embedding)**. When a bit does not match the secret payload bit, OMBRIX randomly increments or decrements the pixel channel by $1$:

$$p' = p \pm 1 \quad \text{where } p' \equiv m \pmod 2$$

Because the pixel has an equal 50% probability of moving up or down, the natural histogram shape is preserved and the Pairs of Values (PoV) anomaly is completely avoided.

### 2. Wavelet Subband Frequency Masking (Haar DWT)

OMBRIX projects carrier pixels into the spatial frequency domain via the 2D Haar Wavelet transform:

$$y_{\text{LL}} = \frac{x_{0,0} + x_{0,1} + x_{1,0} + x_{1,1}}{2}, \quad y_{\text{LH}} = \frac{x_{0,0} + x_{0,1} - x_{1,0} - x_{1,1}}{2}$$
$$y_{\text{HL}} = \frac{x_{0,0} - x_{0,1} + x_{1,0} - x_{1,1}}{2}, \quad y_{\text{HH}} = \frac{x_{0,0} - x_{0,1} - x_{1,0} + x_{1,1}}{2}$$

Payload bits are embedded primarily into the diagonal high-frequency subband ($y_{\text{HH}}$) and horizontal/vertical edge subbands ($y_{\text{LH}}, y_{\text{HL}}$), leaving the low-frequency approximation band ($y_{\text{LL}}$) untouched to prevent human visual artifacts.

### 3. Empirical Steganalysis Benchmark

| Steganalysis Attack | Naive Sequential LSB | Standard PRNG Scatter | OMBRIX Hyper-Matrix |
| :--- | :---: | :---: | :---: |
| **RS Steganalysis ($R_{-m} \neq S_{-m}$)** | **Detected (100%)** | Detected (~68%) | **Undetected ($< 2.4\%$)** |
| **Sample Pair Analysis (SPA)** | **Detected (100%)** | Detected (~54%) | **Undetected ($< 1.8\%$)** |
| **Chi-Square $\chi^2$ PoV Distribution** | **Detected ($p < 0.001$)** | Detected ($p < 0.05$) | **Clean ($p > 0.95$)** |
| **Average PSNR Fidelity** | ~38 dB | ~44 dB | **> 52.8 dB** |
| **Structural Similarity (SSIM)** | 0.921 | 0.965 | **0.9984** |

---

## 🧮 Algorithm Feature Matrix

| Engine | Primary Transform | Modulo / Substitution | Optimal Carrier Type | Typical Capacity |
| :--- | :--- | :--- | :--- | :---: |
| **Hyper-Matrix** | 2D Haar Wavelet + PVD | $\pm 1$ LSB Matching + CSPRNG Permutation | High-detail photos, textures | ~15–25% |
| **Robust Messaging** | Block Differential Modulation | Low-Frequency Luminance + 5x FEC | WhatsApp / Social Media Channels | ~1.5–3 KB |
| **Stealth Matrix** | Spatial Raster Scatter | Fisher-Yates PRNG Shuffle + $\pm 1$ Matching | General photos, digital art | ~12–20% |
| **PVD Differencing** | Edge-Adaptive Pixel Differencing | Multi-range quantization table | High-contrast scenery, architecture | ~20–35% |
| **Haar Wavelet** | Subband Coefficient Transform | High-frequency quantization | Realistic camera photos | ~10–18% |
| **Sequential LSB** | Raster Scan Direct Replacement | Direct 1-bit LSB substitution | Synthetic carriers, calibration | ~100% |

---

## 🦎 Chameleon Dual-Layer Deniability (Anti-Coercion)

For high-threat operational environments, OMBRIX implements **Chameleon Plausible Deniability**:

1. **Dual Envelope Framing**: The carrier embeds two independently encrypted payloads within the same pixel matrix using interleaved pseudorandom permutation sequences.
2. **Coercion Resistance**: If forced to surrender an unlock passkey under physical duress or forensic inspection, providing the **Decoy Passkey** unpacks a plausible, harmless payload (e.g. routine project meeting notes).
3. **Zero Forensic Residue**: The Master Layer's ciphertext is mathematically indistinguishable from pseudorandom carrier noise to anyone lacking the Master Passkey.

---

## 🧹 Memory Hygiene & Zeroization Guarantees

OMBRIX executes strict memory hygiene across all operations:

```
[ Plaintext Secret ] ──► [ Process ] ──► [ sodium.memzero(key32) in finally block ]
[ Carrier Buffer   ] ──► [ Render  ] ──► [ URL.revokeObjectURL(url) upon unmount  ]
[ Panic Scrub Button] ──► [ Zeroes all TypedArrays with 0s across all heap caches ]
```

- **Immediate Zeroization**: Intermediate cryptographic keys, raw nonces, and decrypted byte arrays are overwritten with zeros (`zeroMemory()`) inside `finally` blocks.
- **Zero Object URL Retention**: Blob URLs created during processing are registered into an active lifecycle tracker and explicitly revoked via `URL.revokeObjectURL()`.
- **Panic Zeroize Action**: A dedicated header action immediately purges all in-memory carrier and payload buffers, clears form fields, and revokes active blob handles.

---

## 📦 Monorepo Architecture

OMBRIX is structured as an 18-package pnpm workspace:

```
OMBRIX/
├── apps/
│   └── web/                   # High-performance React 19 + Vite studio application
├── packages/
│   ├── crypto-adapter/        # Libsodium WebAssembly wrapper (Argon2id, X25519, Ed25519)
│   ├── stego-advanced/        # Hyper-Matrix, Stealth Matrix, Wu & Tsai PVD, Haar DWT
│   ├── stego-worker/          # Background Web Worker pipeline with auto-probing
│   ├── payload-protocol/      # Binary OMB1 envelope framing & CRC32 verification
│   ├── image-validation/      # PNG parser, decompression bomb & APNG defense
│   ├── carrier-lens/          # Bitplane analysis, RGB histograms, diff-mapping
│   ├── stego-forensics/       # RS Steganalysis, SPA, Laplacian noise residuals
│   ├── transit-trace/         # Chi-square testing & degradation simulation
│   ├── optical-airgap/        # Animated 2D optical airgap QR streaming
│   ├── relay-core/            # Multi-hop cryptographic onion envelope routing
│   ├── batch-pipeline/        # Automated multi-carrier batch embedding
│   ├── stego-png-lsb/         # Deterministic sequential LSB baseline
│   ├── stego-lab/             # Automated benchmark suite & empirical challenge runner
│   ├── stego-interface/       # Core TypeScript interfaces & types
│   ├── edge-sdk/              # Edge compute bindings & runtime facade
│   └── cli/                   # Developer terminal CLI
└── tests/
    └── integration/           # Cross-package end-to-end integration test suites
```

---

## 💻 Local Development & Verification

### Prerequisites
- **Node.js**: `v20.0.0` or higher
- **pnpm**: `v9.0.0` or higher (`corepack enable pnpm`)

### Installation & Run
```bash
# Clone the repository
git clone https://github.com/SanthaKumar-K-2004/OMBRIX.git
cd OMBRIX

# Install dependencies across all 18 workspace packages
pnpm install

# Start local development server
pnpm run dev
```

### Test Suite Execution
```bash
# Run all 446 unit & integration tests across 65 test suites
pnpm test
```

### Static Analysis & Linter Check
```bash
# Run Biome code quality audit (0 warnings, 0 errors across 245 files)
pnpm run lint
```

### Monorepo Production Build
```bash
# Compile all workspace packages in dependency order
pnpm run build
```

---

## 🔒 Security & Privacy Guarantees

- **100% Client-Side Sandbox**: All steganographic embedding, frequency transforms, and cryptographic operations run exclusively inside the browser WebAssembly runtime.
- **Zero Telemetry**: No third-party analytics, remote fonts, or network tracking beacons.
- **Strict Content Security Policy**: Configured with `connect-src 'none'; object-src 'none'; form-action 'none'; frame-ancestors 'none';`.
- **Pure Lossless Export**: Output PNGs are stripped of camera serials, device fingerprints, and geolocation metadata.

---

<div align="center">
  <sub>OMBRIX Core Steganography Engine • Engineered for absolute privacy and cryptographic integrity.</sub>
</div>
