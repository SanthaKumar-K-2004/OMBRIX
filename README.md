<div align="center">

# OMBRIX

### Zero-Knowledge Steganography & Visual Cryptanalysis Suite

Carrier-grade visual steganography, subband wavelet modulation, and lossy-resilient messaging engineered entirely for client-side execution.

<br/>

[![Live Demo](https://img.shields.io/badge/Live%20App-ombrix--stego.vercel.app-7C3AED.svg?style=flat-square&logo=vercel)](https://ombrix-stego.vercel.app/)
[![MCP 2.0](https://img.shields.io/badge/MCP%202.0-Code%20Mode%20Ready-black.svg?style=flat-square)](https://github.com/SanthaKumar-K-2004/OMBRIX/tree/main/packages/mcp-server)
[![CLI](https://img.shields.io/badge/CLI-@ombrix/cli-blueviolet.svg?style=flat-square)](https://github.com/SanthaKumar-K-2004/OMBRIX/tree/main/packages/cli)
[![Language](https://img.shields.io/badge/TypeScript-5.8+-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Cryptography](https://img.shields.io/badge/Cryptography-Libsodium%20%2F%20Argon2id-4B5563.svg?style=flat-square)](https://libsodium.gitbook.io/)
[![Security Policy](https://img.shields.io/badge/Network-Zero--Telemetry%20Air--Gap-059669.svg?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

<br/>

![OMBRIX Studio Interface](./Design.jpeg)

</div>

---

## Overview

**OMBRIX** is an offline-first steganographic engineering suite designed to conceal confidential data and secret imagery inside innocent carrier images without leaving statistical or visual traces.

### The Problem with Traditional Steganography

Classical steganographic utilities naively overwrite sequential least significant bits (LSBs). This replacement introduces an asymmetric distortion known as the **Pair-of-Values (PoV)** anomaly: even pixel values $2k$ are modified only to $2k+1$, while odd values $2k+1$ are modified only to $2k$. 

This artifact causes immediate histogram flattening ($h(2k) \approx h(2k+1)$), allowing automated steganalysis tools—such as **Sample Pair Analysis (SPA)**, **RS Steganalysis**, and **Chi-Square ($\chi^2$) distribution tests**—to detect the presence of hidden data with high statistical confidence.

### The OMBRIX Solution

OMBRIX prevents detection by decoupling the carrier image across multiple domains:

* **Frequency Domain Masking (2D Haar DWT)**: Projects carrier pixels into spatial wavelet subbands ($LL, LH, HL, HH$), steering payload bits into high-frequency edge textures where human vision and statistical scanners exhibit lowest sensitivity.
* **Pixel Value Differencing (PVD)**: Evaluates edge variance between neighboring pixels, allocating larger payload capacities to complex textures while strictly preserving smooth gradient regions.
* **$\pm 1$ LSB Matching (Modulo Embedding)**: When a carrier bit differs from a payload bit, the pixel channel is randomly incremented or decremented by $1$ ($p' = p \pm 1$ where $p' \equiv m \pmod 2$). Because pixel values have equal probability of increasing or decreasing, natural histogram contours remain statistically undisturbed.

---

## Core Pipeline Architecture

OMBRIX operates through two isolated, deterministic client-side pipelines:

```
 CONCEALMENT (ENCODE)                             EXTRACTION (DECODE)
 ┌──────────────────────────┐                    ┌──────────────────────────┐
 │ Plaintext / Covert Photo │                    │   Stego Carrier Image    │
 └────────────┬─────────────┘                    └────────────┬─────────────┘
              │                                               │
              ▼                                               ▼
 ┌──────────────────────────┐                    ┌──────────────────────────┐
 │  OMB1 Envelope Framing   │                    │ Web Streams Lossless PNG │
 │  (Deflate Compression)   │                    │ (Bypasses GPU Re-encode) │
 └────────────┬─────────────┘                    └────────────┬─────────────┘
              │                                               │
              ▼                                               ▼
 ┌──────────────────────────┐                    ┌──────────────────────────┐
 │ Cryptographic Hardening  │                    │ Multi-Method Auto-Probe  │
 │ Argon2id KDF + ChaCha20  │                    │ (Hyper-Matrix / Robust)  │
 │  + Ed25519 Signatures    │                    └────────────┬─────────────┘
 └────────────┬─────────────┘                                 │
              │                                               ▼
              ▼                                  ┌──────────────────────────┐
 ┌──────────────────────────┐                    │ Authenticated Decryption │
 │ Steganographic Subband   │                    │ Poly1305 MAC / HMAC-256  │
 │ Haar DWT + PVD + Modulo  │                    │  + Signature Validate    │
 └────────────┬─────────────┘                    └────────────┬─────────────┘
              │                                               │
              ▼                                               ▼
 ┌──────────────────────────┐                    ┌──────────────────────────┐
 │ Lossless Clean Export    │                    │ In-Place Heap Zeroize    │
 │ (EXIF & Metadata Purged) │                    │ (Plaintext Recovered)    │
 └──────────────────────────┘                    └──────────────────────────┘
```

---

## Steganography Engines

| Engine | Transform Architecture | Modulation Model | Recommended Use Case | Capacity |
| :--- | :--- | :--- | :--- | :---: |
| **Hyper-Matrix** | 2D Haar Wavelet + PVD | $\pm 1$ Modulo Matching + ChaCha20 PRNG | High-capacity documents, secret photos | ~15–25% |
| **Robust Messaging** | Block Luminance Modulation | YCbCr Differential + 5x FEC + HMAC-256 | WhatsApp, Telegram, compressed social media | ~1.5–3 KB |
| **Stealth Matrix** | Spatial Raster Scatter | Fisher-Yates PRNG Permutation + $\pm 1$ | Digital art, general photographs | ~12–20% |
| **Edge-Adaptive PVD** | Quantization Range Table | Multi-bit pixel boundary substitution | High-contrast urban & landscape photos | ~20–35% |
| **Haar Wavelet** | Wavelet Subband Decomposition | High-frequency diagonal modulation | Camera captures, organic textures | ~10–18% |
| **Sequential LSB** | Raster Scan Sequential | Direct least-significant bit insertion | Synthetic calibration carriers | ~100% |

---

## Cross-Platform & Messaging Resilience

Messaging platforms like WhatsApp, Telegram, Discord, and Instagram automatically recompress standard photo uploads into lossy JPEG/WebP formats and resize large resolutions, destroying fragile least-significant bits.

OMBRIX provides two distinct operational transmission paths:

### 1. Normal Social Share (No Document Needed)
* **Engine**: Robust Messaging (`stego-robust-resilient`)
* **How it works**: Modulates luminance differentials across $8 \times 8$ pixel blocks in YCbCr space combined with 5x Forward Error Correction (FEC) repetition coding and 32-bit Barker frame synchronization.
* **Resilience**: Survives lossy JPEG recompression (Quality 60–85), channel noise, and downscaling without bit error.
* **JPEG Export**: Provides a direct **Download Social JPEG** option so carriers can be sent as standard photos without requiring file attachment tricks.

### 2. Lossless Document Mode (Maximum Capacity)
* **Engine**: Hyper-Matrix (`stego-hyper-matrix`)
* **How it works**: Embeds high-capacity payloads (including high-resolution covert secret photos) into spatial wavelet coefficients.
* **Transmission**: Transmitted via messaging apps using **Send as Document** (📎 ➔ Document), preserving the PNG bit-for-bit with pristine carrier visual fidelity ($PSNR > 52\text{ dB}$, $SSIM > 0.998$).

---

## Cryptographic Architecture & Key Management

### Perceptual Visual Photo Keys
Traditional photo-key utilities hash raw file bytes (`BLAKE2b(fileBytes)`), causing key derivation to fail when a photo is transferred across mobile platforms that transcode image metadata. 

OMBRIX implements **Perceptual Visual Hashing**:
* Evaluates an invariant $8 \times 8$ superblock visual luminance array.
* Derives deterministic 256-bit cryptographic keys from spatial visual structure rather than byte encoding.
* Ensures the exact same encryption key is derived on both desktop and mobile devices even after lossy social media compression.

### Dual-Layer Chameleon Deniability
For hostile environments where key disclosure may be coerced:
* Embeds two independent encrypted payloads within a single carrier using non-overlapping pseudorandom permutations.
* Surrendering a **Decoy Passkey** unlocks an authentic, benign cover document (e.g., standard project notes).
* The **Master Payload** remains cryptographically indistinguishable from carrier noise to any observer without the master key.

---

## Security & Privacy Guarantees

* **Zero-Network Client-Side Execution**: All steganographic embedding, frequency transforms, and cryptographic operations run exclusively inside the local browser WebAssembly sandbox.
* **Enforced Content Security Policy**: Configured with strict network isolation:
  ```http
  Content-Security-Policy: default-src 'self'; connect-src 'none'; object-src 'none'; frame-ancestors 'none';
  ```
* **Memory Hygiene & Zeroization**: Cryptographic keys, nonces, and decrypted byte arrays are explicitly wiped from memory (`sodium.memzero`) inside strict execution `finally` blocks.
* **Privacy by Default**: Generated carriers are automatically stripped of EXIF tags, GPS coordinates, camera serial numbers, and device fingerprints.

---

## Getting Started

### Prerequisites
* **Node.js**: `v20.0.0` or higher
* **pnpm**: `v9.0.0` or higher (`corepack enable pnpm`)

### Installation & Development
```bash
# Clone the repository
git clone https://github.com/SanthaKumar-K-2004/OMBRIX.git
cd OMBRIX

# Install dependencies across the workspace
pnpm install

# Start local development studio
pnpm run dev
```

### Production Build
```bash
# Compile all workspace packages and mirror production assets
pnpm run build
```

---

## Model Context Protocol (MCP 2.0) Server

OMBRIX includes an official, zero-telemetry MCP server with **MCP 2.0 Code Mode** support for AI assistants (Claude Desktop, Cursor IDE, Google Antigravity, Windsurf).

### Automatic Assistant Configuration
```bash
npx @ombrix/cli mcp install
```
This auto-detects existing AI clients on your system, creates backups, and merges `@ombrix/mcp-server`.

### Manual Configuration
Add to your client configuration (e.g. `~/.config/Claude/claude_desktop_config.json` or `~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "ombrix": {
      "command": "npx",
      "args": ["-y", "@ombrix/mcp-server"]
    }
  }
}
```

### MCP 2.0 Code Mode
Agents can script multi-step workflows in an air-gapped sandboxed runtime without intermediate payload leakage and with >95% token savings:
```javascript
const carrier = ombrix.createCarrier(128, 128);
const token = await ombrix.keygen('crypto32');
const embedded = await ombrix.embed(carrier, 'Secret transmission', {
  method: 'hyper-matrix',
  passkey: token.passkey
});
const scan = ombrix.scan(embedded.carrier);
return { anomaly: scan.overallAnomalyScore, passkey: token.passkey };
```

---

## Command Line Interface (CLI)

Run directly or install globally:
```bash
# Embed secret message with Argon2id passkey
npx @ombrix/cli embed cover.png -p "Classified Coordinates" -k "secret-passkey" -m hyper-matrix -o stego.png

# Extract protected secret
npx @ombrix/cli extract stego.png -k "secret-passkey"

# Analyze carrier capacity across 7 algorithms
npx @ombrix/cli inspect cover.png

# Multi-detector forensic steganalysis (RS, SPA, Chi-Square, Laplacian)
npx @ombrix/cli scan candidate.png

# Run Code Mode scripts directly from the terminal
npx @ombrix/cli eval "const cap = ombrix.inspect('cover.png'); return cap;"
```

---

## Deployment

OMBRIX is configured for zero-configuration static deployment on modern hosting platforms (Vercel, Cloudflare Pages, Netlify):

* **Framework Preset**: Vite
* **Build Command**: `pnpm run build`
* **Output Directory**: `dist` (automatically mirrored across `dist` and `apps/web/dist`)
* **Security Headers**: Production `vercel.json` and Cloudflare `_headers` pre-configured with strict CSP, HSTS, and frame protections.

---

<div align="center">
  <sub>OMBRIX • Client-Side Forensic Steganography & Visual Cryptanalysis Suite</sub>
</div>
