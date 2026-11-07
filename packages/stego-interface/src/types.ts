export interface CarrierImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray | Uint8Array;
}

export type ChannelName = 'R' | 'G' | 'B';

export interface StegoOptions {
  /** Number of least significant bits used per channel. Default: 1 */
  bitsPerChannel?: number;
  /** Active RGB channels to embed into. Default: ['R', 'G', 'B'] */
  channels?: ChannelName[];
  /** Optional deterministic PRNG seed for scattering */
  seed?: number;
}

export interface CapacityReport {
  /** Theoretical maximum bytes using all available bits in the carrier */
  theoreticalBytes: number;
  /** Usable payload bytes excluding required stego framing headers */
  usableBytes: number;
  /** Framing header overhead in bytes */
  overheadBytes: number;
  /** Total pixel count in carrier image */
  totalPixels: number;
  /** Bits embedded per pixel */
  bitsPerPixel: number;
  /** Channels used for embedding */
  channelsUsed: ChannelName[];
}

export interface CarrierAnalysis {
  width: number;
  height: number;
  totalPixels: number;
  capacity: CapacityReport;
  estimatedNoiseEntropy?: number;
}

export type StegoProgressCallback = (fraction: number) => void;

export interface StegoMethod {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;

  /**
   * Calculates maximum embedding capacity for the given carrier dimensions.
   */
  calculateCapacity(carrier: CarrierImage, options?: StegoOptions): CapacityReport;

  /**
   * Analyzes carrier image characteristics and capacity.
   */
  analyze(
    carrier: CarrierImage,
    options?: StegoOptions,
    signal?: AbortSignal,
  ): Promise<CarrierAnalysis>;

  /**
   * Embeds payload bytes into a carrier raster image.
   * Returns a new CarrierImage with modified pixel data.
   */
  embed(
    carrier: CarrierImage,
    payload: Uint8Array,
    options?: StegoOptions,
    signal?: AbortSignal,
    onProgress?: StegoProgressCallback,
  ): Promise<CarrierImage>;

  /**
   * Extracts embedded payload bytes from a stego carrier image.
   */
  extract(
    carrier: CarrierImage,
    options?: StegoOptions,
    signal?: AbortSignal,
    onProgress?: StegoProgressCallback,
  ): Promise<Uint8Array>;
}
