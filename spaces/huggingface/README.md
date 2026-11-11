---
title: OMBRIX MCP 2.0 Server
emoji: 🛡️
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Stego & forensics MCP server for AI agents
---

# 🛡️ OMBRIX MCP 2.0 Server (Hugging Face Spaces)

A high-performance, air-gapped, zero-telemetry **Model Context Protocol (MCP 2.0)** server. Connect your AI assistants (Claude Desktop, Cursor, Antigravity, Open WebUI, Windsurf) directly to OMBRIX's military-grade steganography, multi-detector forensics, and sandboxed Code Mode runtime over high-speed Server-Sent Events (SSE).

---

## 🔌 Live Connect URL

```text
https://spidysanta-ombrix-mcp.hf.space/sse
```

---

## 💻 AI Agent Configuration

### 1. Claude Desktop
Add to your `claude_desktop_config.json`:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ombrix": {
      "url": "https://spidysanta-ombrix-mcp.hf.space/sse"
    }
  }
}
```

### 2. Cursor
1. Go to **Cursor Settings** &rarr; **Features** &rarr; **MCP**.
2. Click **+ Add New MCP Server**.
3. Set:
   - **Name**: `ombrix`
   - **Type**: `sse`
   - **URL**: `https://spidysanta-ombrix-mcp.hf.space/sse`

---

## 🛠️ Available MCP Tools (11)

| Tool | Capability |
| :--- | :--- |
| `stego_plan` | Channel recommendation engine. Advises on method, checks capacity fit, and warns about lossy JPEG recompression on WhatsApp Photos vs Documents. |
| `stego_hide` | Simplified one-step payload hiding with safe defaults, Base64/URL support, and automated in-memory self-verification (`verified: true`). |
| `stego_reveal` | Simplified one-step payload extraction with automatic multi-algorithm sequential fallback and prompt-injection safety tags. |
| `stego_embed` | Conceals secret plaintext messages or files into PNG carriers using Hyper-Matrix, DWT, PVD, LSB Matching, or Robust Resilient with Argon2id encryption. |
| `stego_extract` | Extracts concealed secret payloads with automatic algorithm detection and passkey unlocking. |
| `stego_scan` | Multi-detector forensic steganalysis using calibrated Fridrich RS Steganalysis, Dumitrescu Sample Pair Analysis (SPA), Chi-Square (PoVs), and Laplacian noise variance. |
| `stego_benchmark` | Benchmarks all 6 steganography algorithms across empirical image quality metrics (PSNR in dB, MSE, capacity limits). |
| `stego_keygen` | Generates Diceware passphrases, 32-byte tokens, X25519 keypairs, and Ed25519 signing keys. |
| `stego_inspect` | Inspects image dimensions, color channels, and exact usable byte payload capacity per algorithm. |
| `stego_code_mode` | Sandboxed JavaScript/TypeScript execution inside a single air-gapped call, reducing LLM token consumption by over 95%. |
| `stego_api_docs` | Discovers full TypeScript API definitions and signatures for Code Mode. |

---

## 🔒 Security & Privacy Guarantee

- **Zero-Telemetry Boundary**: Operates strictly within ephemeral RAM.
- **No Persistence / No Logs**: Images and secret payloads processed in-memory are never written to disk or transmitted to third parties.
- **Prompt Injection Defense**: All revealed content is tagged with `{ untrusted: true }` and strict safety notices to protect host LLMs.
- **Memory Released Instantly**: Ephemeral buffers are garbage-collected immediately upon response completion.

---

## 🌐 Links

- **Main Repository**: [github.com/SanthaKumar-K-2004/OMBRIX](https://github.com/SanthaKumar-K-2004/OMBRIX)
- **Web Studio**: [ombrix-stego.vercel.app](https://ombrix-stego.vercel.app/)
- **npm Package**: [npmjs.com/package/ombrix-mcp-server](https://www.npmjs.com/package/ombrix-mcp-server)


