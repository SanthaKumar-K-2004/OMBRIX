---
title: OMBRIX MCP 2.0 Server
emoji: 🛡️
colorFrom: blue
colorTo: purple
sdk: static
pinned: false
license: mit
short_description: Stego & forensics MCP server for AI agents
---

# 🛡️ OMBRIX MCP 2.0 — Zero-Telemetry Steganography Server

> **This space is a landing page.** The live MCP server runs on [Render.com](https://ombrix-mcp.onrender.com) (see below).

A high-performance, air-gapped, zero-telemetry **Model Context Protocol (MCP 2.0)** server. Connect your AI assistants (Claude Desktop, Cursor, Antigravity, Open WebUI, Windsurf) directly to OMBRIX's military-grade steganography, multi-detector forensics, and sandboxed Code Mode runtime.

---

## 🔌 Live MCP Connect URL

```
https://ombrix-mcp.onrender.com/sse
```

> **Note:** Render free tier spins down after 15 min of inactivity. First connection after sleep may take ~30 seconds. For always-on, upgrade Render to Starter ($7/mo) or use the local npx command.

---

## ⚡ Zero-Install Local Use (No Server Needed)

```bash
npx ombrix-mcp-server
```

Then connect your MCP client to: `http://localhost:3000/sse`

---

## 🛠️ Smithery One-Click Connect

[Connect on Smithery](https://smithery.ai/server/ombrix-mcp-server)

---

## 🧰 11 Available Tools

| Tool | Description |
|------|-------------|
| `stego_embed` | Hide data in PNG images (6 algorithms) |
| `stego_extract` | Extract hidden data with auto-detect |
| `stego_inspect` | Capacity analysis per algorithm |
| `stego_scan` | Chi-square + RS steganalysis |
| `stego_benchmark` | Performance benchmark all 6 algorithms |
| `stego_keygen` | Generate cryptographic diceware passkeys |
| `stego_validate` | Validate PNG integrity |
| `stego_plan` | Channel-aware method recommender |
| `stego_hide` | Simplified embed alias |
| `stego_reveal` | Simplified extract alias |
| `code_execute` | Sandboxed Node.js code runner |

## 🔬 6 Steganography Algorithms

- `hyper-matrix` — Best for large payloads, full round-trip ✅
- `lsb` — Classic LSB, now fixed and verified ✅
- `matching` — ±1 embedding, low distortion
- `pvd` — Pixel value differencing
- `dwt` — Discrete wavelet transform
- `robust-resilient` — Survives JPEG recompression (≤56 bytes)

## 📦 Source

- GitHub: [SanthaKumar-K-2004/OMBRIX](https://github.com/SanthaKumar-K-2004/OMBRIX)
- npm: [ombrix-mcp-server](https://npmjs.com/package/ombrix-mcp-server)
