---
title: OMBRIX MCP 2.0 Server
emoji: 🛡️
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Zero-telemetry steganography & forensics MCP server for AI agents
---

# 🛡️ OMBRIX MCP 2.0 — Zero-Telemetry Steganography Server

A high-performance, air-gapped, zero-telemetry **Model Context Protocol (MCP 2.0)** server. Connect your AI assistants (**Claude Desktop**, **Cursor**, **Google Antigravity**, **Windsurf**, **Claude Code**) directly to OMBRIX's military-grade steganography, multi-detector forensics, and sandboxed Code Mode runtime.

---

## 🔌 Live MCP Connect URL (Server-Sent Events)

When deployed on Hugging Face Spaces, connect your AI agent using the HTTPS SSE endpoint:

```
https://<YOUR_HF_USERNAME>-<SPACE_NAME>.hf.space/sse
```

### Client Configuration Example

#### Claude Desktop (`claude_desktop_config.json`) / Google Antigravity (`mcp_config.json`)
```json
{
  "mcpServers": {
    "ombrix": {
      "url": "https://<YOUR_HF_USERNAME>-<SPACE_NAME>.hf.space/sse"
    }
  }
}
```

#### Cursor IDE (`~/.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "ombrix": {
      "url": "https://<YOUR_HF_USERNAME>-<SPACE_NAME>.hf.space/sse"
    }
  }
}
```

---

## 🌐 Remote MCP + Catbox.moe Workflow

Because remote cloud MCP servers running on Hugging Face cannot access local desktop file paths (e.g., `/home/...` or `C:\...`), and embedding giant base64 payloads inside chat context hits prompt token limits:

1. **Upload your carrier PNG** to [Catbox.moe](https://catbox.moe).
   - Catbox provides direct HTTPS links (`https://files.catbox.moe/xxxxxx.png`).
   - **Critical Stego Guarantee:** Unlike Imgur, Discord, or WhatsApp, Catbox does **not** compress, re-encode, or strip PNG bits. The file remains bit-for-bit lossless!
2. **Pass the Catbox direct URL** to the MCP tool:
   ```json
   {
     "carrierUrl": "https://files.catbox.moe/xxxxxx.png",
     "payload": "Classified coordinates and operational parameters",
     "passphrase": "correct-horse-battery-staple",
     "method": "hyper-matrix"
   }
   ```
3. The server downloads the untouched carrier into ephemeral memory, embeds the encrypted payload, and returns the result safely.

---

## ⚡ Zero-Install Local Use (Stdio / Offline)

You can also run OMBRIX MCP locally without any remote server:

```bash
# Auto-detect and configure all local AI clients:
npx -y ombrix-cli mcp install

# Or run standalone via stdio:
npx -y ombrix-mcp-server
```

---

## 🧰 11 Production MCP Tools

| Tool | Description |
| :--- | :--- |
| `stego_embed` | Embed arbitrary data into PNG carriers with choice of 7 algorithms and passkey encryption. |
| `stego_extract` | Extract hidden data with auto-detection across all supported steganographic methods. |
| `stego_hide` | High-level, zero-friction embedding tool with in-memory self-verification. |
| `stego_reveal` | High-level extraction tool returning recovered plaintext with prompt-injection defenses. |
| `stego_scan` | Comprehensive forensic steganalysis (RS, SPA, Laplacian noise residuals, Chi-square). |
| `stego_inspect` | Carrier dimension and usable byte capacity analysis across all 7 algorithms. |
| `stego_benchmark` | Empirical fidelity benchmark measuring MSE, PSNR, and SSIM per algorithm. |
| `stego_keygen` | Cryptographic passkey generator (Diceware, 32-byte token, Photo key, Keypair). |
| `stego_plan` | Channel-aware engine recommending optimal methods based on transmission channel. |
| `stego_code_mode` | Air-gapped sandboxed JavaScript execution inside an isolated worker thread. |
| `stego_api_docs` | Reference documentation for Code Mode scripts. |

---

## 🧬 7 Steganography Algorithms

- **`hyper-matrix`** — 2D Haar DWT + Edge PVD + $\pm 1$ LSB. Evades RS/SPA steganalysis; 15%–25% capacity.
- **`robust-resilient`** — YCbCr Luminance Sub-Quadrants. Survives lossy JPEG recompression and messaging apps.
- **`matching`** — Spatial RGB $\pm 1$ Modulo Arithmetic. Clean histogram distribution.
- **`pvd`** — Pixel Value Differencing. High visual fidelity in textured regions.
- **`dwt`** — Discrete Wavelet Transform. High-frequency sub-band concealment.
- **`dct`** — Discrete Cosine Transform. Mid-frequency luminance embedding.
- **`lsb`** — Classic Least Significant Bit with Libsodium Argon2id + XChaCha20-Poly1305 authenticated encryption.

---

## 📦 Open Source & Package Links

- GitHub: [SanthaKumar-K-2004/OMBRIX](https://github.com/SanthaKumar-K-2004/OMBRIX)
- npm CLI: [ombrix-cli](https://www.npmjs.com/package/ombrix-cli)
- npm MCP Server: [ombrix-mcp-server](https://www.npmjs.com/package/ombrix-mcp-server)
