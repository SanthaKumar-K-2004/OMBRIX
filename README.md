<div align="center">

# OMBRIX™
### *Beyond what the eye can see.*

**Carrier-grade steganographic concealment with cryptographic scattering, edge-adaptive masking, and ±1 LSB matching.**

[![Tests](https://img.shields.io/badge/tests-446%20passed%20%2F%20100%25-emerald?style=for-the-badge&logo=vitest&logoColor=white)](https://github.com/SanthaKumar-K-2004/OMBRIX)
[![Architecture](https://img.shields.io/badge/architecture-100%25%20Client--Side-violet?style=for-the-badge&logo=webassembly&logoColor=white)](https://github.com/SanthaKumar-K-2004/OMBRIX)
[![Security](https://img.shields.io/badge/cryptography-Argon2id%20%2B%20Libsodium-blue?style=for-the-badge&logo=shield&logoColor=white)](https://github.com/SanthaKumar-K-2004/OMBRIX)
[![Linter](https://img.shields.io/badge/code%20style-biome%20clean-cyan?style=for-the-badge&logo=biome&logoColor=white)](https://biomejs.dev/)
[![Deploy](https://img.shields.io/badge/deploy-Vercel%20%7C%20Cloudflare-black?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FSanthaKumar-K-2004%2FOMBRIX)

<br/>

<a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FSanthaKumar-K-2004%2FOMBRIX">
  <img src="https://vercel.com/button" alt="Deploy with Vercel" height="38"/>
</a>

<br/>
<br/>

![OMBRIX Studio Interface](./Design.jpeg)

</div>

---

## ⚡ The OMBRIX Paradigm

**OMBRIX** is an advanced, military-grade steganography and visual cryptography suite engineered entirely for the browser. Unlike classical steganography tools that naively overwrite sequential least significant bits (LSBs)—leaving glaring statistical anomalies easily detected by RS analysis or Chi-square tests—OMBRIX employs high-frequency **Discrete Wavelet Transform (Haar DWT)** subbands, **Wu & Tsai Pixel Value Differencing (PVD)**, and **CSPRNG pseudorandom permutation scattering** with $\pm 1$ matching.

Every operation executes **100% locally on your device** via WebAssembly (Libsodium) and Web Workers. No payloads, images, keys, or metadata are ever transmitted over the wire.

---

## 🛡️ Key Architectural Innovations

### 1. 🔏 Military-Grade Cryptography & Argon2id Memory-Hard KDF
- **V2 Container Format**: Envelopes passkeys with a 16-byte cryptographically random salt, 24-byte nonce, and **Argon2id13** derivation (`crypto_pwhash`, 64 MiB RAM, 2 iterations).
- **Anti-GPU / ASIC Resistance**: Offline dictionary attacks and precomputed rainbow tables are rendered computationally futile.
- **Asymmetric X25519 Sealed Boxes & Ed25519 Signatures**: Cryptographically seal secrets for specific contact public keys with origin attestation and canonical `SignDoc` framing.

### 2. 🧬 Pure Web Streams Lossless PNG Codec
- **Zero GPU Color Conversions**: Standard browser Canvas APIs often apply destructive sRGB/Display-P3 color profiles and alpha premultiplication. OMBRIX includes a standalone, pure TypeScript Deflate codec ([`browserPngCodec.ts`](./apps/web/src/utils/browserPngCodec.ts)) using native `CompressionStream` and CRC32.
- **Forensically Sanitized**: Output stego PNGs contain strictly `IHDR`, `IDAT`, and `IEND`. Camera PRNU sensor noise, EXIF coordinates, and camera serial numbers are stripped.

### 3. 🦎 Chameleon Dual-Layer Deniability (Anti-Coercion)
- Embeds two distinct cryptographic layers inside a single carrier image:
  - **Master Layer**: Unlocks the confidential secret when opened with the master passkey.
  - **Decoy Layer**: Surrendering under duress reveals a plausible, harmless message, leaving zero mathematical trace of the master layer.

### 4. 🧠 In-Place RAM Zeroization & Panic Scrub
- **Zero RAM Residue**: Plaintext keys and decoded buffers are zeroized in place using `zeroMemory()` in strict `finally` blocks.
- **Blob Lifecycle Management**: Every object URL created by the browser is actively tracked and revoked, eliminating memory retention leaks.
- **Zeroize RAM Action**: 1-click panic trigger wipes all in-memory carrier and payload buffers with `0`s and purges the browser blob registry.

### 5. 🌐 Strict Zero-Server Sandbox (CSP)
- Hardened with `connect-src 'none'; object-src 'none'; form-action 'none'; frame-ancestors 'none';`.
- Outbound network requests, tracking beacons, and unauthorized sensor access are blocked at the browser engine level.

---

## 📐 Steganographic Engine Architecture

```
                                  [ Carrier Image (Cover) ]
                                              │
                                              ▼
[ Confidential Secret ] ──► [ Compress (Deflate) ] ──► [ Encrypt (Argon2id + XSalsa20) ]
                                                              │
                                                              ▼
                                                 [ Canonical OMB1 Envelope ]
                                                              │
                    ┌─────────────────────────────────────────┴─────────────────────────────┐
                    ▼                                                                       ▼
         ┌─────────────────────┐                                                 ┌─────────────────────┐
         │    Hyper-Matrix     │                                                 │    Stealth Matrix   │
         │ (Haar DWT + PVD)    │                                                 │   (PRNG Scatter)    │
         └──────────┬──────────┘                                                 └──────────┬──────────┘
                    │                                                                       │
                    └───────────────────────────────────┬───────────────────────────────────┘
                                                        │
                                                        ▼
                                           [ ±1 LSB Matching Modulo ]
                                                        │
                                                        ▼
                                           [ Lossless PNG Assembler ]
                                                        │
                                                        ▼
                                            [ Undetectable Stego PNG ]
```

---

## 🔬 Steganography Algorithm Arsenal

| Algorithm | Mechanism | Capacity | Visual Fidelity (PSNR) | Forensic Resistance |
| :--- | :--- | :---: | :---: | :---: |
| **Hyper-Matrix** *(Recommended)* | Discrete Wavelet Transform (LH, HL, HH subbands) + Edge-Adaptive PVD + CSPRNG scatter | ~12–25% | **> 52 dB** | **Highest (RS & $\chi^2$ Undetectable)** |
| **Stealth Matrix** | Fisher-Yates CSPRNG permutation with $\pm 1$ LSB matching | ~10–20% | **> 54 dB** | **High (Sample Pair Immune)** |
| **PVD Differencing** | Wu & Tsai pixel value difference in high-contrast edge boundaries | ~15–30% | **> 48 dB** | **High in Complex Textures** |
| **Haar Wavelet** | High-frequency diagonal wavelet coefficient quantization | ~8–15% | **> 50 dB** | **High in Natural Photos** |
| **Sequential LSB** | Deterministic raster scan sequential bit replacement | ~100% | > 42 dB | Baseline Testing Only |

---

## 📦 Monorepo Architecture

OMBRIX is architected as a modular, 18-package pnpm monorepo:

| Package | Purpose |
| :--- | :--- |
| [`@ombrix/web`](./apps/web) | React 19 + Tailwind CSS + Lucide studio web application. |
| [`@ombrix/crypto-adapter`](./packages/crypto-adapter) | Libsodium WebAssembly wrapper, Argon2id KDF, Ed25519 signatures, X25519 sealed boxes. |
| [`@ombrix/stego-advanced`](./packages/stego-advanced) | Hyper-Matrix, Stealth Matrix, Wu & Tsai PVD, and Haar DWT stego implementations. |
| [`@ombrix/stego-worker`](./packages/stego-worker) | Off-main-thread Web Worker pipeline with auto-probing extraction. |
| [`@ombrix/payload-protocol`](./packages/payload-protocol) | Binary OMB1 envelope serialization, framing, and CRC32 verification. |
| [`@ombrix/image-validation`](./packages/image-validation) | PNG structural validator, APNG defense, decompression bomb prevention. |
| [`@ombrix/carrier-lens`](./packages/carrier-lens) | Bitplane visualizer, RGB histogram distribution, and diff-map analysis. |
| [`@ombrix/stego-forensics`](./packages/stego-forensics) | RS Steganalysis, Sample Pair Analysis, and Laplacian noise residual engines. |
| [`@ombrix/transit-trace`](./packages/transit-trace) | Chi-square statistical test and lossy transit degradation analyzer. |
| [`@ombrix/optical-airgap`](./packages/optical-airgap) | Animated 2D optical airgap QR streaming protocol for physical transfers. |
| [`@ombrix/relay-core`](./packages/relay-core) | Multi-hop cryptographic onion envelope routing. |
| [`@ombrix/batch-pipeline`](./packages/batch-pipeline) | Automated batch carrier processing and chunked multi-image embedding. |

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Node.js**: `v20.0.0` or higher (LTS recommended)
- **pnpm**: `v9.0.0` or higher (`corepack enable pnpm`)

### 1. Clone & Install
```bash
git clone https://github.com/SanthaKumar-K-2004/OMBRIX.git
cd OMBRIX
pnpm install
```

### 2. Launch Development Studio
```bash
pnpm run dev
```
Open **`http://localhost:5173`** in your browser.

### 3. Run Test Suite
```bash
# Runs all 446 monorepo tests across 65 test suites
pnpm test
```

### 4. Code Quality & Formatting
```bash
# Biome linter check (0 warnings, 0 errors)
pnpm run lint
```

### 5. Production Build
```bash
pnpm run build
```

---

## 🌐 Free Production Deployment

OMBRIX is pre-configured for instant zero-server deployment on **Vercel** or **Cloudflare Pages**.

### Deploy to Vercel (Recommended)
1. Push your repository to **GitHub**.
2. Go to **[vercel.com/new](https://vercel.com/new)** and import the repository.
3. Keep the **Root Directory** as `./` (do not change to `apps/web`).
4. Click **Deploy**. The included [`vercel.json`](./vercel.json) handles monorepo dependencies, SPA routing, and security headers automatically.

### Deploy to Cloudflare Pages
1. In Cloudflare Dashboard, go to **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Set build command to `pnpm run build` and output directory to `apps/web/dist`.
3. The included [`_headers`](./apps/web/public/_headers) and [`_redirects`](./apps/web/public/_redirects) configure edge caching, HSTS, and strict CSP automatically.

---

## 📜 Security & Responsible Disclosure

OMBRIX was designed for privacy advocates, journalists, human-rights defenders, and cybersecurity researchers operating in hostile digital environments.

- **Client-Side Guarantee**: No secrets or keys leave the browser.
- **Zero Telemetry**: No Google Analytics, no tracking scripts, no third-party CDNs.
- **Memory Hygiene**: Secret buffers are scrubbed from RAM immediately after use.

---

<div align="center">
  <sub>Engineered with precision for absolute stealth and cryptographic integrity.</sub>
</div>
