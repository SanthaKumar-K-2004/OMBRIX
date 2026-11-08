# OMBRIX Threat Model & Security Boundaries

**Status:** v2.0 (Phase 7 Hardened)  
**Scope:** Browser-based steganography, media messaging, client-side cryptographic isolation, and forensic analysis.

---

## 1. Trust Boundaries & Assumptions

1. **Untrusted Inputs:** All files uploaded by the user are treated as potentially hostile. Filename extensions, MIME types, and client-reported metadata are never trusted.
2. **Browser Execution Environment:**
   - The application runs in the user's browser sandbox.
   - Operating system compromise, hardware rootkits, or malicious browser extensions with cross-tab script access are outside the technical mitigation capability of any pure client-side web application.
3. **Transmission Channel:** The transmission channel (email, chat app, web host, cloud drive) is assumed to be untrusted. Any lossy compression, metadata stripping, re-encoding, or downscaling by intermediaries will destroy fragile LSB embeddings. OMBRIX explicitly documents this fragility.
4. **Zero-Telemetry Boundary:** Outbound network connections from the application are strictly prohibited at the browser platform level via Content Security Policy (`connect-src 'none'`).

---

## 2. Threat Analysis & Mitigations

### 2.1 Decompression Bombs & Resource Exhaustion (Pixel Floods)
- **Threat:** A maliciously crafted PNG with small compressed file size (e.g. 100 KB) that inflates to gigabytes of raster memory (e.g. 50,000 × 50,000 pixels), crashing the browser tab or device.
- **Mitigation (`image-validation`):**
  - Dimensions are parsed directly from the `IHDR` chunk before full decompression.
  - Strict maximum limits: Width $\le 8192$, Height $\le 8192$, Total Pixels $\le 16,777,216$ (16 MP).
  - Uncompressed raster size estimate is checked against total `IDAT` compressed chunk sizes to detect abnormal expansion ratios.

### 2.2 Malformed Chunk Exploits & Buffer Overflows
- **Threat:** Malformed PNG chunks, negative or oversized chunk length fields, cyclic or missing `IEND` chunks.
- **Mitigation:**
  - Strict bounds checking on every chunk slice.
  - Chunk CRC32 verification on critical chunks.
  - Strict enforcement of `IHDR` as the first chunk and presence of `IEND`.

### 2.3 Animated PNG (APNG) Ambiguity
- **Threat:** An APNG file containing hidden frames or differing renders between decoders.
- **Mitigation:** Immediate rejection upon detection of `acTL`, `fcTL`, or `fdAT` chunks with `AnimatedPngNotSupportedError`.

### 2.4 Payload Protocol Tampering & Corrupted Headers
- **Threat:** Corrupted steganographic bytes causing unbounded memory allocation in the payload envelope parser.
- **Mitigation (`payload-protocol`):**
  - Self-delimiting header with IEEE 802.3 CRC32 checksum.
  - Header CRC32 is verified prior to payload allocation.
  - Strict maximum payload length limit ($16\,\text{MiB}$).
  - Truncated buffers fail immediately with typed errors.

### 2.5 Eavesdropping & Interception
- **Threat:** An adversary intercepts the steganographic carrier image and extracts the raw embedded bitstream.
- **Mitigation (`crypto-adapter`):**
  - All confidential payloads are encrypted using Libsodium X25519 sealed boxes (`crypto_box_seal`) before embedding.
  - Raw embedded bits are indistinguishable from uniform high-entropy random noise.
  - Without the recipient's private X25519 key, ciphertext cannot be decrypted.

### 2.6 Sender Impersonation & Forgery
- **Threat:** An attacker crafts a carrier image claiming to be from a trusted sender.
- **Mitigation (`crypto-adapter`):**
  - Optional Ed25519 digital signatures computed over the canonical signed envelope document (`buildSignDoc`).
  - Recipients independently verify sender signatures against verified public keys or out-of-band fingerprints.

### 2.7 Key Exfiltration & Outbound Telemetry
- **Threat:** Malicious dependencies or XSS attempts to exfiltrate private keys, user passwords, or image payloads over the network.
- **Mitigation:**
  - Content Security Policy (CSP) header enforces `connect-src 'none'`.
  - Zero analytics, zero crash reporting, zero tracking SDKs allowed in dependencies.

### 2.8 Ephemeral Carrier Substitution (Link Hijacking)
- **Threat:** An attacker substitutes an arbitrary clean image into an ephemeral `#link=...` sharing container.
- **Mitigation (`link-sharing`):**
  - Containers bind the 32-byte BLAKE2b hash of the authorized carrier into the signed metadata.
  - If the provided carrier's hash diverges by even a single bit, extraction fails with `CarrierTamperedError`.

### 2.9 Passphrase Cracking on Vault Backups
- **Threat:** An adversary steals an exported `.ombrix-vault` file and attempts offline dictionary or brute-force attacks.
- **Mitigation:**
  - Password key derivation utilizes Argon2id (`crypto_pwhash_argon2id13`) with 64 MiB memory cost and 2 passes.
  - Generates a fresh random 16-byte salt per export, preventing pre-computed rainbow table attacks.
