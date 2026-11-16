# Security Policy

OMBRIX is designed from the ground up for high-security, privacy-critical, zero-knowledge steganography and visual forensics. This document outlines our security model, threat boundaries, zero-telemetry commitments, and vulnerability disclosure procedures.

---

## Supported Versions

| Version | Supported | Status |
| :--- | :---: | :--- |
| `0.1.5` | ✅ | **Current Stable Production Release** |
| `0.1.4` | ⚠️ | Superseded (Upgrade recommended) |
| `< 0.1.4` | ❌ | End of Life |

---

## Reporting a Vulnerability

We welcome responsible security research. If you discover a vulnerability or potential flaw in OMBRIX:

1. **Do NOT open a public GitHub issue.**
2. Send an email to the maintainer: **`santha.k.2004@gmail.com`** or submit an advisory via GitHub Security Advisories.
3. Include:
   - Description of the vulnerability.
   - Minimal reproducible test case or script.
   - Impact assessment (e.g., sandbox escape, path traversal, crypto compromise).
4. You will receive an initial response within **24 hours**, and a coordinated patch release within **72 hours** for critical flaws.

---

## Zero-Telemetry Guarantee

OMBRIX strictly enforces a **Zero-Telemetry** invariant across all packages:
- **No Analytics / No Tracking**: No external analytics, metrics, or usage tracking are compiled into the CLI, MCP server, or Edge SDK.
- **No Outbound Network Exfiltration**: Except for explicit user requests (e.g., downloading an input image via `carrierUrl` through strictly guarded Anti-SSRF channels), OMBRIX makes **zero outbound network requests**.
- **In-Memory Operations**: Cryptographic operations occur in local memory. Sensitive key buffers are wiped using `sodium.memzero` upon completion.

---

## Security Architecture & Defenses

### 1. Model Context Protocol (MCP 2.0) Sandbox Isolation
- **Worker Thread Execution**: Code Mode execution runs within an isolated Node.js `Worker` thread.
- **Process Cleanup**: The global `process` object is scrubbed from the sandbox execution environment to prevent hostile process termination or environment variable leakage.
- **Watchdog Timeout**: Async infinite loops (e.g., `while(true){await null}`) are forcefully halted by a hard isolate termination (`worker.terminate()`) at the configured timeout boundary.

### 2. Path Confinement & Traversal Defense
- **Root Confinement**: All tool-initiated filesystem operations are validated via `validatePathConfinement()`.
- **Traversal Prevention**: Relative traversals (`../`) attempting to breakout beyond `OMBRIX_ROOT` (default: current working directory) or the system temporary directory are blocked with `E_ACCESS_DENIED`.
- **Hidden File Protection**: Access to sensitive dotfiles (`.env`, `.bashrc`, `.ssh`, `.git`, `.aws/credentials`) is rejected by default.
- **Overwrite Guards**: Filesystem writes enforce explicit `overwrite: true` validation to prevent accidental or malicious destruction of existing files.

### 3. Anti-SSRF Network Fetch Protection
- **Scheme Validation**: Only `http:` and `https:` schemes are permitted. Schemes such as `file://`, `ftp://`, and `gopher://` are rejected.
- **IP Range Filtering**: Hostnames are resolved via DNS, and IP addresses are validated against private, loopback, link-local, and cloud metadata ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`, `::1`, `fe80::/10`). Requests targeting these ranges are rejected with `E_SSRF_BLOCKED`.
- **Payload Size & Timeout Caps**: Downloaded payloads are restricted to a maximum of 25 MB and a 10-second request timeout via `AbortController`.

### 4. Cryptographic Standards
- **Key Derivation (KDF)**: Argon2id (via libsodium sumo) with strict parameter profiles (`interactive`, `moderate`, `sensitive`). BLAKE2b fallback on Argon2id failure is forbidden.
- **Authenticated Encryption**: XChaCha20-Poly1305 with random 192-bit nonces.
- **Plausible Deniability**: V3 container envelopes support stealth headerless operation. Decryption failures and absence of stego data return uniform `E_AUTH_FAILED` errors to maintain indistinguishability under adversary interrogation.

### 5. Steganographic Integrity
- **Self-Verification**: `stego_embed` and `stego_hide` tools perform in-memory roundtrip self-verification before writing or returning output. If extraction fails, the carrier is rejected with `E_VERIFY_FAILED`.
- **Untrusted Tags**: All extracted data payloads carry an explicit `{ untrusted: true }` tag to inform calling LLMs and autonomous agents that payload contents must be treated as untrusted user input.
