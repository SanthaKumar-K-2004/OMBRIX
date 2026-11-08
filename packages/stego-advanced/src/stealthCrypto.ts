/**
 * OMBRIX Stealth Matrix Cryptographic Primitives
 * High-performance, zero-dependency SHA-256, HMAC, and ChaCha20 PRNG
 * designed for deterministic steganographic scattering and authenticated encryption.
 */

// --- SHA-256 Implementation ---

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

export function sha256(data: Uint8Array): Uint8Array {
  const len = data.length;
  // Pre-processing (Padding)
  const bitLen = len * 8;
  const kPad = (56 - ((len + 1) % 64) + 64) % 64;
  const totalLen = len + 1 + kPad + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(data, 0);
  padded[len] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(totalLen - 4, bitLen & 0xffffffff, false);
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let i = 0; i < totalLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(7, w[t - 15]!) ^ rotr(18, w[t - 15]!) ^ (w[t - 15]! >>> 3);
      const s1 = rotr(17, w[t - 2]!) ^ rotr(19, w[t - 2]!) ^ (w[t - 2]! >>> 10);
      w[t] = (w[t - 16]! + s0 + w[t - 7]! + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let t = 0; t < 64; t++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t]! + w[t]!) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

// --- HMAC-SHA256 ---

export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  let k = key;
  if (k.length > 64) {
    k = sha256(k);
  }
  const kPad = new Uint8Array(64);
  kPad.set(k, 0);

  const iPad = new Uint8Array(64 + message.length);
  const oPad = new Uint8Array(64 + 32);

  for (let i = 0; i < 64; i++) {
    iPad[i] = kPad[i]! ^ 0x36;
    oPad[i] = kPad[i]! ^ 0x5c;
  }
  iPad.set(message, 64);
  const innerHash = sha256(iPad);
  oPad.set(innerHash, 64);
  return sha256(oPad);
}

// --- ChaCha20 Stream PRNG & Cipher ---

function chachaQuarterRound(x: Uint32Array, a: number, b: number, c: number, d: number): void {
  x[a] = (x[a]! + x[b]!) >>> 0;
  x[d] = rotr(16, (x[d]! ^ x[a]!) >>> 0);
  x[c] = (x[c]! + x[d]!) >>> 0;
  x[b] = rotr(20, (x[b]! ^ x[c]!) >>> 0);
  x[a] = (x[a]! + x[b]!) >>> 0;
  x[d] = rotr(24, (x[d]! ^ x[a]!) >>> 0);
  x[c] = (x[c]! + x[d]!) >>> 0;
  x[b] = rotr(25, (x[b]! ^ x[c]!) >>> 0);
}

export class ChaCha20Prng {
  private state = new Uint32Array(16);
  private block = new Uint8Array(64);
  private blockIndex = 64;

  constructor(key32: Uint8Array, nonce12?: Uint8Array) {
    // "expand 32-byte k" constants
    this.state[0] = 0x61707865;
    this.state[1] = 0x3320646e;
    this.state[2] = 0x79622d32;
    this.state[3] = 0x6b206574;

    const keyView = new DataView(key32.buffer, key32.byteOffset, key32.byteLength);
    for (let i = 0; i < 8; i++) {
      this.state[4 + i] = keyView.getUint32(i * 4, true);
    }

    this.state[12] = 0; // counter
    if (nonce12) {
      const nonceView = new DataView(nonce12.buffer, nonce12.byteOffset, nonce12.byteLength);
      this.state[13] = nonceView.getUint32(0, true);
      this.state[14] = nonceView.getUint32(4, true);
      this.state[15] = nonceView.getUint32(8, true);
    } else {
      this.state[13] = 0x4f4d4231; // OMB1
      this.state[14] = 0x53544547; // STEG
      this.state[15] = 0x32303236; // 2026
    }
  }

  private generateBlock(): void {
    const x = new Uint32Array(this.state);

    for (let i = 0; i < 10; i++) {
      // 20 rounds (10 column + 10 diagonal)
      chachaQuarterRound(x, 0, 4, 8, 12);
      chachaQuarterRound(x, 1, 5, 9, 13);
      chachaQuarterRound(x, 2, 6, 10, 14);
      chachaQuarterRound(x, 3, 7, 11, 15);
      chachaQuarterRound(x, 0, 5, 10, 15);
      chachaQuarterRound(x, 1, 6, 11, 12);
      chachaQuarterRound(x, 2, 7, 8, 13);
      chachaQuarterRound(x, 3, 4, 9, 14);
    }

    const blockView = new DataView(this.block.buffer);
    for (let i = 0; i < 16; i++) {
      blockView.setUint32(i * 4, (x[i]! + this.state[i]!) >>> 0, true);
    }

    this.state[12] = (this.state[12]! + 1) >>> 0;
    this.blockIndex = 0;
  }

  /**
   * Returns next uniform random byte [0, 255]
   */
  public nextByte(): number {
    if (this.blockIndex >= 64) {
      this.generateBlock();
    }
    return this.block[this.blockIndex++]!;
  }

  /**
   * Returns next uniform 32-bit unsigned integer [0, 2^32-1]
   */
  public nextUint32(): number {
    const b0 = this.nextByte();
    const b1 = this.nextByte();
    const b2 = this.nextByte();
    const b3 = this.nextByte();
    return ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
  }

  /**
   * Encrypts / decrypts data in-place via XOR with keystream
   */
  public xorProcess(data: Uint8Array): Uint8Array {
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      out[i] = data[i]! ^ this.nextByte();
    }
    return out;
  }
}
