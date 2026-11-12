# OMBRIX Privacy Policy

**Effective Date:** November 12, 2026  
**Last Updated:** November 12, 2026

OMBRIX is engineered from the ground up on an **offline-first, zero-telemetry, zero-knowledge** architecture. We believe privacy and security are fundamental engineering principles, not afterthoughts.

---

## 1. Zero Telemetry & Zero Tracking
- **No Analytics:** The OMBRIX CLI, MCP Server, and Web Studio do not collect, store, transmit, or process any telemetry, analytics, event pings, or diagnostic metrics.
- **No Third-Party Trackers:** No tracking pixels, Google Analytics, cookies, or remote scripts are embedded or loaded.
- **Zero Network Egress During Steganography:** All embedding, extraction, forensic scanning, and benchmarking operations are performed strictly in-memory on your local machine or browser sandbox. No image data or payload data ever leaves your device.

---

## 2. Model Context Protocol (MCP) Safety
- **Local Stdio Transport:** The OMBRIX MCP Server executes locally via `stdio` communication directly with your host AI client (e.g., Claude Desktop, Cursor, local agent runtimes).
- **Secret Protection:** Passkeys and cryptographic seeds can be passed via environment variables (`passkeyEnv`) or local secret files (`passkeyFile`) to ensure secrets never travel in plaintext through AI conversation context windows.
- **Deniable Authentication:** Cryptographic verification failures output generic, deniable responses (`E_AUTH_FAILED`) to prevent timing or oracle attacks confirming hidden payload existence.
- **Prompt-Injection Defense:** Extracted payloads returned to AI clients are explicitly tagged with `untrusted: true` and guarded with cautionary notices.

---

## 3. Data Storage & Retention
- **No Remote Servers:** We do not operate backend databases or cloud storage for user data.
- **Ephemeral Processing:** Image carriers, secret payloads, and keying material exist only in volatile memory during operation execution and are cleaned up immediately upon completion.
- **Client-Side Keys:** All cryptographic keypairs generated via `stego_keygen` (Libsodium X25519, Ed25519, Diceware) are derived on your CPU. Private keys are never transmitted or logged anywhere.

---

## 4. Open Source & Auditability
- OMBRIX is free, open source, and licensed under the **MIT License**.
- Every line of code, cryptographic algorithm implementation, and MCP server handler is open for public inspection, independent security auditing, and reproducible builds at:  
  [https://github.com/SanthaKumar-K-2004/OMBRIX](https://github.com/SanthaKumar-K-2004/OMBRIX)

---

## 5. Contact & Security Inquiries
If you discover a security vulnerability or have privacy questions, please submit an issue or reach out via the official repository:  
[https://github.com/SanthaKumar-K-2004/OMBRIX/issues](https://github.com/SanthaKumar-K-2004/OMBRIX/issues)

