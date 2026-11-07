export interface StegoDistortionReport {
  readonly mse: number;
  readonly psnr: number; // in dB, Infinity if MSE is 0
  readonly ssim: number; // approximate SSIM in [0, 1]
  readonly totalAlteredChannels: number;
  readonly maxChannelDiff: number;
}

export interface StegoBenchmarkResult {
  readonly methodId: string;
  readonly methodName: string;
  readonly embedDurationMs: number;
  readonly extractDurationMs: number;
  readonly payloadBytes: number;
  readonly distortion: StegoDistortionReport;
  readonly success: boolean;
}
