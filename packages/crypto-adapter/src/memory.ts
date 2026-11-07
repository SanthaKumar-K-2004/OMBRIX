export function zeroMemory(buffer: Uint8Array): void {
  buffer.fill(0);
}

export function wipeKey(key: Uint8Array): void {
  zeroMemory(key);
}
