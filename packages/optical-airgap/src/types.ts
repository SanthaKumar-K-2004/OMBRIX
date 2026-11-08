export interface OpticalFrame {
  readonly magic: 'OMB_OPT_V1';
  readonly sequenceId: string;
  readonly frameIndex: number;
  readonly totalFrames: number;
  readonly chunkBase64: string;
  readonly chunkCrc32: number;
  readonly totalPayloadBytes: number;
  readonly overallCrc32: number;
}

export interface OpticalAssemblyResult {
  readonly complete: boolean;
  readonly data?: Uint8Array;
  readonly receivedFrames: number;
  readonly totalFrames: number;
  readonly missingFrames: readonly number[];
  readonly progressPercent: number;
}
