import type { CarrierAnalysis, StegoOptions } from '@ombrix/stego-interface';

export type WorkerActionType = 'EMBED' | 'EXTRACT' | 'ANALYZE';

export interface StegoWorkerRequest {
  readonly id: string;
  readonly type: WorkerActionType;
  readonly width: number;
  readonly height: number;
  readonly carrierBuffer: ArrayBuffer;
  readonly payloadBuffer?: ArrayBuffer;
  readonly options?: StegoOptions;
}

export interface StegoWorkerCancel {
  readonly id: string;
  readonly type: 'CANCEL';
}

export type StegoWorkerIncomingMessage = StegoWorkerRequest | StegoWorkerCancel;

export interface StegoWorkerProgressResponse {
  readonly id: string;
  readonly type: 'PROGRESS';
  readonly progress: number;
}

export interface StegoWorkerSuccessResponse {
  readonly id: string;
  readonly type: 'SUCCESS';
  readonly carrierBuffer?: ArrayBuffer;
  readonly payloadBuffer?: ArrayBuffer;
  readonly analysis?: CarrierAnalysis;
}

export interface StegoWorkerErrorResponse {
  readonly id: string;
  readonly type: 'ERROR';
  readonly error: {
    name: string;
    message: string;
    code?: string;
  };
}

export type StegoWorkerResponse =
  | StegoWorkerProgressResponse
  | StegoWorkerSuccessResponse
  | StegoWorkerErrorResponse;
