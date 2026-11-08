/**
 * OMBRIX File Payload Protocol
 * Lossless binary container format for embedding secret images & files into carriers.
 */

export interface SecretFileMetadata {
  name: string;
  mime: string;
  size: number;
  width?: number;
  height?: number;
}

export interface ExtractedSecretFile {
  name: string;
  mime: string;
  size: number;
  width?: number;
  height?: number;
  data: Uint8Array;
  blobUrl: string;
  isImage: boolean;
}

const MAGIC_BYTES = new Uint8Array([0x4f, 0x4d, 0x42, 0x46, 0x49, 0x4c, 0x30, 0x31]); // 'OMBFIL01'

/**
 * Packs raw file bytes and metadata into an OMBFIL01 envelope.
 */
export function packFilePayload(fileBytes: Uint8Array, meta: SecretFileMetadata): Uint8Array {
  const metaJson = JSON.stringify({
    type: 'OMB_FILE',
    name: meta.name,
    mime: meta.mime || 'application/octet-stream',
    size: meta.size || fileBytes.length,
    width: meta.width,
    height: meta.height,
  });
  const metaBytes = new TextEncoder().encode(metaJson);

  const header = new Uint8Array(8 + 4 + metaBytes.length);
  header.set(MAGIC_BYTES, 0);

  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  view.setUint32(8, metaBytes.length, false); // Big-endian length
  header.set(metaBytes, 12);

  const packed = new Uint8Array(header.length + fileBytes.length);
  packed.set(header, 0);
  packed.set(fileBytes, header.length);
  return packed;
}

/**
 * Unpacks an OMBFIL01 container or auto-detects raw image magic bytes.
 */
export function unpackFilePayload(bytes: Uint8Array): ExtractedSecretFile | null {
  // 1. Check for OMBFIL01 container magic
  if (bytes.length >= 16) {
    let match = true;
    for (let i = 0; i < 8; i++) {
      if (bytes[i] !== MAGIC_BYTES[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      try {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const metaLen = view.getUint32(8, false);
        if (12 + metaLen <= bytes.length) {
          const metaStr = new TextDecoder().decode(bytes.subarray(12, 12 + metaLen));
          const meta = JSON.parse(metaStr);
          const data = bytes.subarray(12 + metaLen);
          const mime = (meta.mime as string) || 'application/octet-stream';
          const blob = new Blob([data as unknown as BlobPart], { type: mime });
          const blobUrl = URL.createObjectURL(blob);
          const isImage = mime.startsWith('image/');
          return {
            name: meta.name || (isImage ? 'secret-image.png' : 'secret-file.bin'),
            mime,
            size: data.length,
            width: meta.width,
            height: meta.height,
            data,
            blobUrl,
            isImage,
          };
        }
      } catch {
        // Fall through to raw format detection
      }
    }
  }

  // 2. Direct PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/png' });
    return {
      name: 'extracted-secret-image.png',
      mime: 'image/png',
      size: bytes.length,
      data: bytes,
      blobUrl: URL.createObjectURL(blob),
      isImage: true,
    };
  }

  // 3. Direct JPEG signature: FF D8 FF
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/jpeg' });
    return {
      name: 'extracted-secret-image.jpg',
      mime: 'image/jpeg',
      size: bytes.length,
      data: bytes,
      blobUrl: URL.createObjectURL(blob),
      isImage: true,
    };
  }

  // 4. Direct WebP signature: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/webp' });
    return {
      name: 'extracted-secret-image.webp',
      mime: 'image/webp',
      size: bytes.length,
      data: bytes,
      blobUrl: URL.createObjectURL(blob),
      isImage: true,
    };
  }

  // 5. Direct GIF signature: GIF87a / GIF89a
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/gif' });
    return {
      name: 'extracted-secret-image.gif',
      mime: 'image/gif',
      size: bytes.length,
      data: bytes,
      blobUrl: URL.createObjectURL(blob),
      isImage: true,
    };
  }

  return null;
}
