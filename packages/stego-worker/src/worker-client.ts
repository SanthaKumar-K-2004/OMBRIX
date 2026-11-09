import {
  type CarrierAnalysis,
  type CarrierImage,
  ExtractionError,
  InsufficientCapacityError,
  InvalidCarrierError,
  StegoAbortError,
  StegoError,
  type StegoOptions,
  type StegoProgressCallback,
} from '@ombrix/stego-interface';
import type {
  StegoWorkerIncomingMessage,
  StegoWorkerRequest,
  StegoWorkerResponse,
  StegoWorkerSuccessResponse,
} from './protocol.js';

export type WorkerChannelEvent = Event | MessageEvent<StegoWorkerResponse> | ErrorEvent;

export interface WorkerChannel {
  postMessage(message: StegoWorkerIncomingMessage, transfer?: Transferable[]): void;
  addEventListener(type: string, listener: (event: WorkerChannelEvent) => void): void;
  removeEventListener(type: string, listener: (event: WorkerChannelEvent) => void): void;
}

export interface StegoEmbedResult extends CarrierImage {
  metrics?: { mse: number; psnr: number; elapsedMs: number };
}

export class StegoWorkerClient {
  private nextId = 1;
  private pendingJobs = new Map<
    string,
    {
      resolve: (value: StegoWorkerSuccessResponse) => void;
      reject: (reason: Error) => void;
      onProgress?: StegoProgressCallback;
    }
  >();

  constructor(private channel: WorkerChannel) {
    this.handleMessage = this.handleMessage.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleMessageError = this.handleMessageError.bind(this);
    this.channel.addEventListener('message', this.handleMessage);
    this.channel.addEventListener('error', this.handleError);
    this.channel.addEventListener('messageerror', this.handleMessageError);
  }

  private handleMessage(event: WorkerChannelEvent): void {
    if (!('data' in event) || event.type !== 'message') {
      return;
    }
    const data = event.data as StegoWorkerResponse;
    if (!data?.id) return;

    const job = this.pendingJobs.get(data.id);
    if (!job) return;

    if (data.type === 'PROGRESS') {
      job.onProgress?.(data.progress);
    } else if (data.type === 'SUCCESS') {
      this.pendingJobs.delete(data.id);
      job.resolve(data);
    } else if (data.type === 'ERROR') {
      this.pendingJobs.delete(data.id);
      const err = mapError(data.error);
      job.reject(err);
    }
  }

  private handleError(event: WorkerChannelEvent): void {
    if (event.type !== 'error') {
      return;
    }
    const message =
      ('message' in event && typeof event.message === 'string' && event.message) ||
      ('error' in event && event.error instanceof Error ? event.error.message : undefined) ||
      'Stego worker terminated with an unhandled error';
    const err = new StegoError(message, 'WORKER_TERMINATED_ERROR');
    for (const [_id, job] of this.pendingJobs) {
      job.reject(err);
    }
    this.pendingJobs.clear();
  }

  private handleMessageError(event: WorkerChannelEvent): void {
    if (event.type !== 'messageerror') {
      return;
    }
    const err = new StegoError(
      'Failed to deserialize worker message',
      'WORKER_MESSAGE_DESERIALIZE_ERROR',
    );
    for (const [_id, job] of this.pendingJobs) {
      job.reject(err);
    }
    this.pendingJobs.clear();
  }

  public async embed(
    carrier: CarrierImage,
    payload: Uint8Array,
    options?: StegoOptions,
    signal?: AbortSignal,
    onProgress?: StegoProgressCallback,
  ): Promise<StegoEmbedResult> {
    const id = `job_${this.nextId++}`;

    // Create transferable copies
    const carrierCopy = new Uint8ClampedArray(carrier.data);
    const payloadCopy = new Uint8Array(payload);

    const request: StegoWorkerRequest = {
      id,
      type: 'EMBED',
      width: carrier.width,
      height: carrier.height,
      carrierBuffer: carrierCopy.buffer,
      payloadBuffer: payloadCopy.buffer,
      options,
    };

    return this.executeJob<StegoEmbedResult>(
      id,
      request,
      [carrierCopy.buffer, payloadCopy.buffer],
      signal,
      onProgress,
      (res) => ({
        width: carrier.width,
        height: carrier.height,
        data: new Uint8ClampedArray(res.carrierBuffer!),
        metrics: res.metrics,
      }),
    );
  }

  public async extract(
    carrier: CarrierImage,
    options?: StegoOptions,
    signal?: AbortSignal,
    onProgress?: StegoProgressCallback,
  ): Promise<Uint8Array> {
    const id = `job_${this.nextId++}`;
    const carrierCopy = new Uint8ClampedArray(carrier.data);

    const request: StegoWorkerRequest = {
      id,
      type: 'EXTRACT',
      width: carrier.width,
      height: carrier.height,
      carrierBuffer: carrierCopy.buffer,
      options,
    };

    return this.executeJob<Uint8Array>(
      id,
      request,
      [carrierCopy.buffer],
      signal,
      onProgress,
      (res) => new Uint8Array(res.payloadBuffer!),
    );
  }

  public async analyze(
    carrier: CarrierImage,
    options?: StegoOptions,
    signal?: AbortSignal,
  ): Promise<CarrierAnalysis> {
    const id = `job_${this.nextId++}`;
    const carrierCopy = new Uint8ClampedArray(carrier.data);

    const request: StegoWorkerRequest = {
      id,
      type: 'ANALYZE',
      width: carrier.width,
      height: carrier.height,
      carrierBuffer: carrierCopy.buffer,
      options,
    };

    return this.executeJob<CarrierAnalysis>(
      id,
      request,
      [carrierCopy.buffer],
      signal,
      undefined,
      (res) => res.analysis!,
    );
  }

  private executeJob<T>(
    id: string,
    request: StegoWorkerRequest,
    transferables: Transferable[],
    signal?: AbortSignal,
    onProgress?: StegoProgressCallback,
    transform?: (response: StegoWorkerSuccessResponse) => T,
  ): Promise<T> {
    if (signal?.aborted) {
      return Promise.reject(new StegoAbortError());
    }

    return new Promise<T>((resolve, reject) => {
      let onAbort: (() => void) | undefined;

      if (signal) {
        onAbort = () => {
          this.channel.postMessage({ id, type: 'CANCEL' });
          this.pendingJobs.delete(id);
          reject(new StegoAbortError());
        };
        signal.addEventListener('abort', onAbort, { once: true });
      }

      this.pendingJobs.set(id, {
        resolve: (val) => {
          if (signal && onAbort) signal.removeEventListener('abort', onAbort);
          resolve(transform ? transform(val) : (val as unknown as T));
        },
        reject: (err) => {
          if (signal && onAbort) signal.removeEventListener('abort', onAbort);
          reject(err);
        },
        onProgress,
      });

      this.channel.postMessage(request, transferables);
    });
  }

  public destroy(): void {
    this.channel.removeEventListener('message', this.handleMessage);
    this.channel.removeEventListener('error', this.handleError);
    this.channel.removeEventListener('messageerror', this.handleMessageError);
    for (const [_id, job] of this.pendingJobs) {
      job.reject(new StegoAbortError('Stego worker client was destroyed'));
    }
    this.pendingJobs.clear();
  }
}

function mapError(errData: { name: string; message: string; code?: string }): Error {
  switch (errData.name) {
    case 'InsufficientCapacityError':
      return new InsufficientCapacityError(errData.message);
    case 'InvalidCarrierError':
      return new InvalidCarrierError(errData.message);
    case 'ExtractionError':
      return new ExtractionError(errData.message);
    case 'StegoAbortError':
      return new StegoAbortError(errData.message);
    default:
      return new StegoError(errData.message, errData.code ?? 'UNKNOWN_WORKER_ERROR');
  }
}
