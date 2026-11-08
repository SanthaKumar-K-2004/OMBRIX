# OMBRIX — Cryptographic Key Management Architecture

**Classification:** Technical Documentation  
**Implementation:** `@ombrix/crypto-adapter` & `@ombrix/link-sharing`  
**Underlying Engine:** Libsodium WebAssembly Sumo (`libsodium-wrappers-sumo`)

---

## 1. Cryptographic Key Separation Principle

OMBRIX strictly enforces algorithmic and key role separation. A single cryptographic key must never be used for both public-key encryption and digital signing.

```
                    ┌─────────────────────────────────────────┐
                    │            User Identity Vault          │
                    └───────────────────┬─────────────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
  ┌─────────────────────────────┐               ┌─────────────────────────────┐
  │     X25519 Keypair          │               │      Ed25519 Keypair        │
  │  (Asymmetric Encryption)    │               │    (Digital Signatures)     │
  ├─────────────────────────────┤               ├─────────────────────────────┤
  │ Public: 32 bytes (Curve25519)│              │ Public: 32 bytes (Ed25519)  │
  │ Private: 32 bytes (Scalar)  │               │ Private: 64 bytes (Expanded)│
  │ Primitive: crypto_box_seal  │               │ Primitive: crypto_sign_*    │
  └─────────────────────────────┘               └─────────────────────────────┘
```

### 1.1 Encryption Keypair (X25519)
- **Role:** Asymmetric message confidentiality.
- **Generation:** `sodium.crypto_box_keypair()`.
- **Sealed Box Encryption (`crypto_box_seal`):** Senders encrypt messages using the recipient's public key without needing a prior handshake. Libsodium generates an ephemeral X25519 keypair, derives a shared secret via ECDH, and encrypts the payload using XSalsa20-Poly1305 authenticated encryption.
- **Anonymity:** Only the recipient possessing the private scalar key can decrypt the envelope. The sender's identity remains unlinked at the encryption layer unless paired with an explicit digital signature.

### 1.2 Digital Signature Keypair (Ed25519)
- **Role:** Authenticity, non-repudiation, and sender integrity.
- **Generation:** `sodium.crypto_sign_keypair()`.
- **Detached Signatures (`crypto_sign_detached`):** 64-byte detached signatures generated over the canonical signed envelope document:
  $$\text{SignDoc} = \text{BLAKE2b}(\text{version} \parallel \text{envelope\_type} \parallel \text{recipient\_key\_id} \parallel \text{ciphertext})$$
- **Verification:** Evaluated via `crypto_sign_verify_detached()` against the sender's verified Ed25519 public key.

---

## 2. Key Identification and Fingerprinting

### 2.1 Key ID (8 Bytes / 16 Hexadecimal Characters)
- Calculated as the first 8 bytes of the BLAKE2b hash of the public key:
  $$\text{KeyID} = \text{BLAKE2b-64}(\text{PublicKey})$$
- Included in plaintext envelope framing to allow recipients with multiple keypairs to quickly identify which private key decrypts the envelope without trying trial decryptions.

### 2.2 Visual Fingerprint (64 Hexadecimal Characters)
- Full 32-byte BLAKE2b digest formatted into space-delimited 4-character blocks:
  ```
  A1B2 C3D4 E5F6 0718 293A 4B5C 6D7E 8F90 1234 5678 9ABC DEF0 1357 2468 3579 4680
  ```
- Intended for out-of-band verification (e.g. reading verbally over an encrypted voice call or comparing against a personal business card).

---

## 3. Vault Backup Encryption (Argon2id + XSalsa20-Poly1305)

Private keys stored in OMBRIX Vault can be exported as an encrypted `.ombrix-vault` portable container protected by a user passphrase.

### 3.1 Key Derivation Function (Argon2id)
- **Algorithm:** `sodium.crypto_pwhash` using `ALG_ARGON2ID13`.
- **Memory Cost (`memlimit`):** $67,108,864$ bytes ($64\text{ MiB}$ — `MEMLIMIT_INTERACTIVE`).
- **Iterations (`opslimit`):** 2 passes (`OPSLIMIT_INTERACTIVE`).
- **Salt:** 16 cryptographically secure pseudo-random bytes generated fresh per export.
- **Resistance:** Mitigates GPU/ASIC parallel dictionary attacks.

### 3.2 Vault Container Serialization
```
┌───────────────┬──────────────┬──────────────┬───────────────────────────────┐
│ Magic 8 Bytes │ Salt 16 Bytes│ Nonce 24 B   │ Ciphertext + Poly1305 Tag     │
│ "OMB1VAULT"   │ (Argon2id)   │ (XSalsa20)   │ (Encrypted JSON Private Keys) │
└───────────────┴──────────────┴──────────────┴───────────────────────────────┘
```

---

## 4. Ephemeral Sharing Integrity (BLAKE2b Hash Rings)

In Milestone 13 (`@ombrix/link-sharing`), ephemeral sharing links (`#link=...`) bind access to a specific carrier image using a tamper-evident BLAKE2b hash ring.

1. **Carrier Image Hash:**
   $$\text{CarrierHash} = \text{BLAKE2b-256}(\text{CarrierRawBytes})$$
2. **Access Gate:**
   When opening a link, the recipient must provide the carrier image. OMBRIX computes the hash and verifies exact match against the embedded hash ring before releasing or decrypting the payload. If the carrier was recompressed or modified in transit, access is rejected.

---

## 5. Security Boundaries & Memory Hygiene Caveats

> [!WARNING]
> **JavaScript Memory Erasure Limitations**  
> While Libsodium provides `sodium_memzero()` in C and WASM linear memory, higher-level JavaScript primitives (such as strings and immutable typed array buffers) are managed by the browser engine's garbage collector. Complete immediate erasure from physical hardware RAM cannot be mathematically guaranteed by any pure web application. Sensitive operations should be executed on trusted, physically secure endpoints.

