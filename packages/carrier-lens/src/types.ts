export type ColorChannel = 'r' | 'g' | 'b' | 'a';
export type BitIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ChannelHistogram = Uint32Array;

export interface ImageHistogram {
  readonly r: ChannelHistogram;
  readonly g: ChannelHistogram;
  readonly b: ChannelHistogram;
  readonly a: ChannelHistogram;
  readonly luminance: ChannelHistogram;
}

export interface BitplaneOptions {
  readonly channel: ColorChannel;
  readonly bitIndex: BitIndex; // 0 = LSB, 7 = MSB
  readonly invert?: boolean; // if true, active bit is 0, inactive is 255
}

export interface BitplaneResult {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray; // RGBA grayscale buffer (0 or 255)
}

export interface DifferenceMapOptions {
  readonly amplification?: number; // scale factor for visual difference (default: 100)
  readonly includeAlpha?: boolean; // default: false
}

export interface DifferenceMapResult {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray; // RGBA amplified difference image
  readonly maxDiff: number;
  readonly totalDiffPixels: number;
  readonly averageDiff: number;
}
