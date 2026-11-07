// IEEE 802.3 standard CRC32 table
const CRC_TABLE: Uint32Array = new Uint32Array(256);

for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    if ((c & 1) !== 0) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c >>>= 1;
    }
  }
  CRC_TABLE[i] = c >>> 0;
}

/**
 * Calculates standard IEEE 802.3 CRC32 checksum for a Uint8Array slice.
 * Pure zero-allocation implementation without forbidden non-null assertions.
 */
export function crc32(buffer: Uint8Array, start = 0, end = buffer.length): number {
  let crc = 0xffffffff;
  const stop = Math.min(end, buffer.length);
  for (let i = start; i < stop; i++) {
    const byte = buffer[i];
    if (byte === undefined) break;
    const tableVal = CRC_TABLE[(crc ^ byte) & 0xff] ?? 0;
    crc = tableVal ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
