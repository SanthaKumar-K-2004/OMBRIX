# OMBRIX Protocol Specification — v1 (OMB1)

**Status:** Draft / Active Specification  
**Format Identifier:** `OMB1`  
**Purpose:** Versioned binary envelope format for steganographic payloads and encrypted messages.

---

## 1. Design Objectives

1. **Self-Delimiting & Bounded:** Every envelope specifies its exact length before payload allocation. Arbitrary unbounded allocations are prohibited.
2. **Deterministic Canonical Encoding:** A given payload and metadata layout produces an exact byte sequence.
3. **Integrity-Protected Header:** A standard CRC32 checksum covers all header fields to detect transmission corruption before parsing payload data.
4. **Independent Cryptographic & Steganographic Suites:** The envelope explicitly decouples the cryptographic encryption/signature algorithm from the carrier embedding technique.
5. **No Secret Leaks:** No plaintext or private key identifiers are exposed. Recipient fingerprints are truncated one-way hashes.

---

## 2. Byte-Level Wire Format

An `OMB1` envelope consists of:
1. **Fixed Header** (24 bytes)
2. **Conditional Header Extension** (0 or 8 bytes)
3. **Length & Header Checksum** (8 bytes)
4. **Payload Body** ($N$ bytes)
5. **Conditional Signature** (0 or 64 bytes)

### Detailed Header Layout

| Field | Offset (bytes) | Size (bytes) | Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Magic Bytes** | `0x00` | 4 | `[0x4F, 0x4D, 0x42, 0x31]` | ASCII string `"OMB1"` |
| **Protocol Version** | `0x04` | 1 | uint8 | Protocol version (`0x01` for v1) |
| **Crypto Suite ID** | `0x05` | 1 | uint8 | Encryption scheme identifier |
| **Stego Method ID** | `0x06` | 1 | uint8 | Steganographic carrier method identifier |
| **Flags** | `0x07` | 1 | uint8 | Bitfield for optional features |
| **Message ID** | `0x08` | 16 | bytes | Random 128-bit identifier (UUID v4 / salt) |
| **Recipient Fingerprint** | `0x18` (conditional) | 0 or 8 | bytes | Truncated recipient public key fingerprint (if flag `0x04` set) |
| **Payload Length** | Variable (`0x18` or `0x20`) | 4 | uint32 BE | Big-endian length of payload body in bytes ($N$) |
| **Header CRC32** | Variable (`0x1C` or `0x24`) | 4 | uint32 BE | IEEE 802.3 CRC32 checksum over preceding header bytes |
| **Payload Body** | Variable | $N$ | bytes | Ciphertext or raw payload data ($0 \le N \le 16\,\text{MiB}$) |
| **Signature** | Variable | 0 or 64 | bytes | Ed25519 signature over all preceding envelope bytes (if flag `0x02` set) |

---

## 3. Enumerations & Field Definitions

### 3.1 Crypto Suite Identifier

| Value | Name | Description |
| :--- | :--- | :--- |
| `0x00` | `NONE` | Unencrypted plaintext (for testing/diagnostics) |
| `0x01` | `X25519_XSALSA20_POLY1305` | Libsodium sealed box (anonymous public-key encryption) |
| `0x02` | `HPKE_DRAFT` | Hybrid Public Key Encryption (future research suite) |

### 3.2 Stego Method Identifier

| Value | Name | Description |
| :--- | :--- | :--- |
| `0x01` | `PNG_LSB_SEQUENTIAL` | Deterministic sequential RGB LSB in raster scan order |
| `0x02` | `PNG_LSB_PRNG` | PRNG-scattered RGB LSB embedding |

### 3.3 Flags Bitfield

| Bit | Mask | Name | Description |
| :--- | :--- | :--- | :--- |
| Bit 0 | `0x01` | `COMPRESSED` | Payload body is Deflate/Gzip compressed before encryption |
| Bit 1 | `0x02` | `SIGNED` | 64-byte Ed25519 signature is appended to the envelope |
| Bit 2 | `0x04` | `RECIPIENT_FINGERPRINT` | An 8-byte recipient public-key fingerprint is present |
| Bit 3 | `0x08` | `IS_FILE` | Payload represents a structured file rather than text |
| Bits 4–7 | `0xF0` | `RESERVED` | Reserved for future use; **must be 0** in v1 |

---

## 4. Integrity Checksum (Header CRC32)

- The checksum algorithm is IEEE 802.3 CRC32 (polynomial `0xEDB88320`).
- The CRC32 is calculated over all header bytes starting from byte offset `0` (Magic `"OMB1"`) up to immediately before the `Header CRC32` field (i.e. length 28 bytes without recipient fingerprint, or 36 bytes with recipient fingerprint).
- If the computed CRC32 does not match the 4-byte header value, deserialization fails immediately with `HeaderChecksumMismatchError` without processing the payload.

---

## 5. Security and Resource Bounds

1. **Maximum Payload Size:** $16\,\text{MiB}$ ($16,777,216$ bytes). Any envelope declaring a length greater than this limit is rejected with `PayloadLengthExceededError`.
2. **Buffer Bounds:** Parsing checks buffer length before attempting reads. Any truncated envelope raises `TruncatedEnvelopeError`.
3. **Canonical Verification:** When `FLAG_SIGNED` is set, the 64-byte Ed25519 signature covers all bytes preceding the signature offset.
