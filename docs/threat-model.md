# OMBRIX Threat Model & Security Boundaries

**Status:** v1.0  
**Scope:** Browser-based steganography, media messaging, and client-side validation.

---

## 1. Trust Boundaries & Assumptions

1. **Untrusted Inputs:** All files uploaded by the user are treated as potentially hostile. Filename extensions, MIME types, and client-reported metadata are never trusted.
2. **Browser Execution Environment:**
   - The application runs in the user's browser sandbox.
   - Operating system compromise, malicious browser extensions, or malicious scripts injected into the same origin are outside the mitigation capability of browser-side cryptographic applications.
3. **Transmission Channel:** The transmission channel (email, chat app, web host) is assumed to be untrusted. Any lossy compression, metadata stripping, re-encoding, or downscaling by intermediaries will destroy fragile LSB embeddings. OMBRIX explicitly documents this fragility.

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
