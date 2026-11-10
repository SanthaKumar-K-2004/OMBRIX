# OMBRIX — Limitations, Threat Boundaries & Honest Disclosure

**Classification:** Security Architecture & User Guidance  
**Core Policy:** Honest Engineering Over Marketing Claims  

---

## 1. Steganography vs. Cryptography

> [!IMPORTANT]
> **Steganography does not replace encryption.**
> Steganography aims to conceal the *existence* of a message. Cryptography protects the *meaning* of a message if the ciphertext is discovered.

In OMBRIX, all payloads should be encrypted with Libsodium authenticated encryption (X25519 sealed boxes or Argon2id passphrases) before embedding. If an adversary suspects an image and extracts the raw embedded bitstream:
- **Without Encryption:** The plaintext secret is immediately exposed.
- **With OMBRIX Cryptography:** The adversary obtains high-entropy, indistinguishable-from-random ciphertext that cannot be decrypted without the private key or passphrase.

---

## 2. The Active Warden & Lossy Transmission Channels

Traditional spatial domain steganography algorithms (LSB Replacement, LSB Matching, PVD) modify pixel intensities at the discrete raster level. 

### Why Standard Spatial LSBs Degrade:
- **Lossy JPEG Recompression:** Quantization in the frequency domain discards high-frequency pixel variations, destroying spatial LSBs.
- **Social Media & Messaging Recompression:** Platforms such as WhatsApp, WeChat, Facebook Messenger, Instagram, and Twitter automatically recompress, resize, and strip metadata from standard photo uploads.
- **Canvas Downscaling & Bilinear Resampling:** Interpolating pixel neighborhoods alters discrete integer values.

### The OMBRIX Dual-Layer Architecture:
To bridge this fundamental limitation without compromising capacity, OMBRIX features a **Universal Dual-Layer Hybrid Architecture** in its flagship **Hyper-Matrix** engine:
1. **Layer 1: Resilient Robust Carrier Layer:**
   - Embeds into $8 \times 8$ blocks using $4 \times 4$ diagonal vs. anti-diagonal sub-quadrant differential luminance modulation.
   - Protected by 5-fold Forward Error Correction (FEC), ChaCha20 stream encryption, HMAC-SHA256 authentication, and multi-scale resampling recovery.
   - **Survives normal WhatsApp photo sending, Instagram, Telegram JPEG 75 compression, and spatial downscaling.**
2. **Layer 2: Wavelet High-Capacity LSB Layer:**
   - 2D Haar DWT frequency isolation + Wu & Tsai PVD edge-adaptive masking with ChaCha20 coordinate scattering.
   - Provides multi-megabyte capacity for full secret photos, audio files, and Chameleon Dual-Layer containers.
   - Preserved with $100\%$ bit-exact fidelity when sent as a Document / uncompressed file.

### Recommended Transmission Channels:
- **For Normal Social Media Sharing (Photos):** Use the default **Hyper-Matrix** engine. It embeds both layers; if WhatsApp compresses the carrier into a JPEG, OMBRIX extraction automatically falls back to Layer 1.
- **For Multi-Megabyte Secret Files & High-Res Covert Photos:** Use messaging platforms with an uncompressed "Send as Document" or "Send as File" option (e.g. WhatsApp 📎 ➔ Document, Signal uncompressed, Telegram File, email attachments).
- **Direct Storage & AirDrop:** USB flash storage, direct peer-to-peer AirDrop, or local file sharing.
- **Lossless Cloud Storage:** Google Drive, Dropbox, or self-hosted S3 with exact byte-for-byte retention.

---

## 3. Statistical Steganalysis Limitations

Forensic detectors provided in OMBRIX Scan (RS Steganalysis, Sample Pair Analysis, Westfeld Chi-Square, Noise Residual Variance) are statistical models based on expected distributions in natural photographs.

- **False Positives:**
  - Computer-generated artwork, flat vector graphics, and extreme geometric gradients.
  - High-ISO camera sensor noise or low-light grain.
  - Scanned halftones and dithered images.
- **False Negatives:**
  - Very low payload embedding ratios ($< 5\%$ capacity).
  - Modern adaptive steganography (syndromic trellis coding, frequency wavelet modulation).
  - Spread-spectrum or PRNG-scattered embeddings.
- **Forensic Takeaway:** Statistical anomalies indicate deviations from theoretical models, not courtroom-level proof of malicious intent. Findings must always be cross-referenced with visual bitplane inspection and carrier provenance.

---

## 4. Client-Side Runtime & Memory Boundaries

- **Zero Telemetry Enforcement:** Outbound network connections are blocked by the browser Content Security Policy (`connect-src 'none'`).
- **Memory Erasure:** Because JavaScript runs in an engine with an automatic generational garbage collector, immediate in-place zeroization of typed array buffers and string instances in RAM cannot be strictly guaranteed.
- **Resource Constraints:** Image carriers are bounded to $16,384 \times 16,384$ pixels and $100\text{ MiB}$ uncompressed buffer size to prevent decompression bomb denial-of-service attacks.

