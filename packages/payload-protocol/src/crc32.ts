const CRC_TABLE: Uint32Array = new Uint32Array(256);

(() => {
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      if ((c & 1) !== 0) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    CRC_TABLE[i] = c >>> 0;
  }
})();

export function crc32(buffer: Uint8Array, start = 0, end = buffer.length): number {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) {
    const byte = buffer[i]!;
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
