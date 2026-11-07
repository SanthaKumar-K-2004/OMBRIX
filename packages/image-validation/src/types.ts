import type { ImageValidationError } from './errors.js';

export interface PngValidationLimits {
  /** Maximum file size in compressed bytes. Default: 15 * 1024 * 1024 (15 MiB) */
  maxFileSize?: number;
  /** Maximum image width in pixels. Default: 4096 */
  maxWidth?: number;
  /** Maximum image height in pixels. Default: 4096 */
  maxHeight?: number;
  /** Maximum total pixel area (width * height). Default: 12_000_000 */
  maxPixels?: number;
  /** Maximum uncompressed raw raster bitmap memory in bytes. Default: 64 * 1024 * 1024 (64 MiB) */
  maxUncompressedBytes?: number;
  /** Maximum allowed decompression expansion ratio. Default: 500 (500:1) */
  maxDecompressionRatio?: number;
}

// Backwards compatibility alias for existing drafts
export interface ImageValidationLimits extends PngValidationLimits {
  maxFileSizeBytes?: number;
  maxRawRasterBytes?: number;
  maxExpansionRatio?: number;
  allowedColorTypes?: number[];
}

export type PngColorTypeName = 'grayscale' | 'rgb' | 'palette' | 'grayscale-alpha' | 'rgba';

export interface PngMetadata {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  colorTypeName: PngColorTypeName;
  channels: number;
  hasAlpha: boolean;
  interlaceMethod: 0 | 1;
  compressedSizeBytes: number;
  estimatedUncompressedBytes: number;
  totalPixels: number;
  chunkTypes: string[];
}

export interface PngChunkInfo {
  type: string;
  length: number;
  offset: number;
  dataOffset: number;
  crc: number;
  isValidCrc?: boolean;
}

export type PngChunk = PngChunkInfo;

export interface PngIhdr {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  compressionMethod: number;
  filterMethod: number;
  interlaceMethod: number;
  channels: number;
  bytesPerPixel: number;
}

export type PngValidationResult = PngMetadata & {
  valid: true;
  fileSizeBytes?: number;
  idatBytes?: number;
  estimatedRawBytes?: number;
  chunks?: string[];
};

export type ValidationResult =
  | { valid: true; metadata: PngMetadata; warnings?: string[] }
  | { valid: false; error: ImageValidationError };
