# ombrix-cli

Command-line interface and MCP 2.0 Code Mode execution runner for the **OMBRIX** Steganography & Visual Cryptanalysis Suite.

## Quickstart

Run directly with `npx` (zero install):

```bash
npx ombrix-cli --help
```

Or install globally:

```bash
npm install -g ombrix-cli
```

## CLI Usage

### Steganographic Operations

```bash
# Embed secret message with Argon2id passkey
ombrix embed carrier.png -p "Secret coordinates" -k "secure-passkey" -m hyper-matrix -o stego.png

# Extract protected message
ombrix extract stego.png -k "secure-passkey"

# Analyze carrier capacity across 7 algorithms
ombrix inspect carrier.png

# Multi-detector forensic steganalysis
ombrix scan candidate.png
```

### Key Generation

```bash
ombrix keygen diceware 4
ombrix keygen crypto32
ombrix keygen keypair
ombrix keygen signing
```

### MCP 2.0 Code Mode Execution

```bash
# Execute Code Mode script directly from CLI
ombrix eval "const cap = ombrix.inspect('cover.png'); return cap.capacities;"

# Run workflow script file
ombrix run-script workflow.js
```

### MCP Assistant Integration

```bash
# Interactive assistant setup (Claude Desktop, Cursor, Antigravity, etc.)
ombrix mcp install

# Show configuration blocks
ombrix mcp show

# Run MCP server stdio process
ombrix mcp run
```

