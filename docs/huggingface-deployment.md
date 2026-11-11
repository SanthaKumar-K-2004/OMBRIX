# 🚀 Deploying OMBRIX MCP 2.0 Server to Hugging Face Spaces

This guide outlines how to host your own **100% free, 24/7 online, air-gapped OMBRIX MCP Server** on Hugging Face Spaces with a public HTTPS Server-Sent Events (SSE) connect URL.

---

## 🌟 Why Hugging Face Spaces?

- **Cost**: 100% Free (CPU Basic tier).
- **Resources**: 2 vCPU, 16 GB RAM (extremely generous for cryptographic & wavelet operations).
- **Zero Sleep**: Public spaces remain active 24/7.
- **Universal Connect URL**: Generates a standard `https://<space-name>.hf.space/sse` URL compatible with Claude Desktop, Cursor, Antigravity, and all MCP-compliant AI agents.

---

## 🛠️ Step 1: Create a New Space on Hugging Face

1. Go to [huggingface.co/new-space](https://huggingface.co/new-space).
2. Configure the Space:
   - **Space name**: `ombrix-mcp` (or your preferred name)
   - **License**: `mit`
   - **Space SDK**: Select **Docker** &rarr; **Blank**
   - **Space hardware**: `CPU basic • 2 vCPU • 16 GB • Free`
   - **Visibility**: **Public** (required for free 24/7 uptime)
3. Click **Create Space**.

---

## 📦 Step 2: Upload Files to the Space

The OMBRIX repository contains a pre-packaged, zero-dependency Hugging Face Space ready in [`spaces/huggingface/`](../spaces/huggingface/):

- `Dockerfile` (Lightweight Node 20 runner)
- `package.json`
- `README.md` (Contains Hugging Face Space metadata & documentation)
- `index.js` (Standalone production bundle with full MCP 2.0 tools + SSE streaming + web dashboard)

### Option A: Upload via Web UI (Easiest — 60 seconds)
1. On your newly created Space page, click the **Files** tab.
2. Click **Add file** &rarr; **Upload files**.
3. Drag and drop all 4 files from `spaces/huggingface/` into the upload zone.
4. Click **Commit changes to main**.

### Option B: Push via Git
```bash
# In the OMBRIX repository root:
git remote add hf https://huggingface.co/spaces/<your-username>/ombrix-mcp
git subtree push --prefix spaces/huggingface hf main
```

---

## ⚡ Step 3: Connect Your AI Agents

Once Hugging Face finishes building the container (takes ~30–45 seconds), your Space will be live at:
```text
https://<your-username>-ombrix-mcp.hf.space/sse
```

### Claude Desktop Configuration
Add the remote URL to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "ombrix": {
      "url": "https://<your-username>-ombrix-mcp.hf.space/sse"
    }
  }
}
```

### Cursor Configuration
1. Open **Cursor Settings** &rarr; **Features** &rarr; **MCP**.
2. Click **+ Add New MCP Server**.
3. Configure:
   - **Name**: `ombrix`
   - **Type**: `sse`
   - **URL**: `https://<your-username>-ombrix-mcp.hf.space/sse`

---

## 🔍 Verification & Health Check

Test your live server by opening the base URL in your browser:
- `https://<your-username>-ombrix-mcp.hf.space/` &rarr; Interactive Cyber-Hub Dashboard
- `https://<your-username>-ombrix-mcp.hf.space/health` &rarr; JSON health check report
