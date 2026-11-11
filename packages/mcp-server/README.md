# ombrix-mcp-server

Model Context Protocol (MCP 2.0) Server with Code Mode architecture for the **OMBRIX** Steganography & Visual Cryptanalysis Suite.

## Features

- **MCP 2.0 Code Mode (`stego_code_mode`)**: Sandboxed Node.js V8 VM environment allowing AI agents to script multi-step embedding, extraction, forensic scanning, and benchmarking in a single call, reducing token consumption by over 95% with zero intermediate payload leakage.
- **Code Mode Discovery (`stego_api_docs`)**: Instant TypeScript signature introspection for the sandboxed `ombrix` API.
- **Standard MCP Tools**:
  - `stego_embed`: Universal Hyper-Matrix, Robust Resilient, DWT Haar, PVD, and LSB Matching with Argon2id passkeys.
  - `stego_extract`: Multi-algorithm payload extraction with auto-probing.
  - `stego_scan`: Fridrich RS Steg, Dumitrescu SPA, Westfeld Chi-Square, and Laplacian residual noise variance.
  - `stego_inspect`: Carrier capacity and channel layout analysis.
  - `stego_benchmark`: Empirical PSNR (dB), SSIM, and MSE image quality metrics.
  - `stego_keygen`: Diceware, 32-byte cryptographic tokens, X25519, and Ed25519 keypairs.

## Quick Setup

Run via `npx`:

```json
{
  "mcpServers": {
    "ombrix": {
      "command": "npx",
      "args": ["-y", "ombrix-mcp-server"]
    }
  }
}
```

Or configure automatically using the OMBRIX CLI:

```bash
npx ombrix-cli mcp install
```

