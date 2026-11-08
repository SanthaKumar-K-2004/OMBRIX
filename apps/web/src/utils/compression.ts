/**
 * OMBRIX Lossless Dynamic Compression Engine
 * Transparently compresses large text messages, confidential documents, and binary payloads
 * using native streaming Deflate algorithms to defeat carrier size limitations.
 */

export const COMPRESSION_MAGIC = new Uint8Array([0x4f, 0x4d, 0x42, 0x43, 0x4d, 0x50, 0x30, 0x31]); // "OMBCMP01"

/**
 * Checks whether a byte buffer starts with the OMBCMP01 compression magic.
 */
export function isCompressedPayload(data: Uint8Array): boolean {
  if (data.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (data[i] !== COMPRESSION_MAGIC[i]) return false;
  }
  return true;
}

/**
 * Compresses arbitrary byte arrays using native browser/Node CompressionStream (deflate-raw).
 */
export async function compressBytes(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    return data;
  }

  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(data as unknown as BufferSource);
  await writer.close();

  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Decompresses raw deflate streams using native DecompressionStream.
 */
export async function decompressBytes(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    return data;
  }

  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(data as unknown as BufferSource);
  await writer.close();

  const chunks: Uint8Array[] = [];
  const reader = ds.readable.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Opportunistically compresses data if compression achieves measurable savings.
 * Prepends OMBCMP01 header if compressed.
 */
export async function smartCompress(
  data: Uint8Array,
): Promise<{ data: Uint8Array; compressed: boolean; savedBytes: number }> {
  // Only attempt compression if payload is large enough to benefit (> 32 bytes)
  if (data.length <= 32) {
    return { data, compressed: false, savedBytes: 0 };
  }

  try {
    const compressed = await compressBytes(data);
    const withHeaderLen = compressed.length + COMPRESSION_MAGIC.length;

    // Only apply if it actually saves space
    if (withHeaderLen < data.length) {
      const packaged = new Uint8Array(withHeaderLen);
      packaged.set(COMPRESSION_MAGIC, 0);
      packaged.set(compressed, COMPRESSION_MAGIC.length);
      return {
        data: packaged,
        compressed: true,
        savedBytes: data.length - withHeaderLen,
      };
    }
  } catch (err) {
    console.warn('Compression skipped due to stream error:', err);
  }

  return { data, compressed: false, savedBytes: 0 };
}

/**
 * Decompresses data if OMBCMP01 magic header is detected; otherwise returns data untouched.
 */
export async function smartDecompress(data: Uint8Array): Promise<Uint8Array> {
  if (isCompressedPayload(data)) {
    try {
      const rawCompressed = data.subarray(COMPRESSION_MAGIC.length);
      return await decompressBytes(rawCompressed);
    } catch (err) {
      console.warn('Decompression failed, returning raw bytes:', err);
      return data;
    }
  }
  return data;
}
