export function zeroMemory(buffer: Uint8Array): void {
  buffer.fill(0);
}

export function wipeKey(key: Uint8Array): void {
  zeroMemory(key);
}

export function wipeBuffers(...buffers: (Uint8Array | null | undefined)[]): void {
  for (const buf of buffers) {
    if (buf && buf instanceof Uint8Array) {
      buf.fill(0);
    }
  }
}

/**
 * Constant-time byte array equality comparison to eliminate timing side-channel attacks.
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return mismatch === 0;
}
