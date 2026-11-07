import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import type { StegoWorkerIncomingMessage, StegoWorkerResponse } from './protocol.js';

export interface WorkerPostMessagePort {
  postMessage(message: StegoWorkerResponse, transfer?: Transferable[]): void;
}

export class StegoWorkerHandler {
  private activeJobs = new Map<string, AbortController>();

  constructor(private port: WorkerPostMessagePort) {}

  public async handleMessage(message: StegoWorkerIncomingMessage): Promise<void> {
    if (message.type === 'CANCEL') {
      const controller = this.activeJobs.get(message.id);
      if (controller) {
        controller.abort();
        this.activeJobs.delete(message.id);
      }
      return;
    }

    const controller = new AbortController();
    this.activeJobs.set(message.id, controller);

    try {
      const carrierData = new Uint8ClampedArray(message.carrierBuffer);
      const carrier = {
        width: message.width,
        height: message.height,
        data: carrierData,
      };

      if (message.type === 'EMBED') {
        if (!message.payloadBuffer) {
          throw new Error('Payload buffer is required for EMBED operation.');
        }

        const payload = new Uint8Array(message.payloadBuffer);
        const resultCarrier = await pngLsbSequential.embed(
          carrier,
          payload,
          message.options,
          controller.signal,
          (progress) => {
            this.port.postMessage({
              id: message.id,
              type: 'PROGRESS',
              progress,
            });
          },
        );

        const resultBuffer = resultCarrier.data.buffer as ArrayBuffer;
        this.port.postMessage(
          {
            id: message.id,
            type: 'SUCCESS',
            carrierBuffer: resultBuffer,
          },
          [resultBuffer],
        );
      } else if (message.type === 'EXTRACT') {
        const extracted = await pngLsbSequential.extract(
          carrier,
          message.options,
          controller.signal,
          (progress) => {
            this.port.postMessage({
              id: message.id,
              type: 'PROGRESS',
              progress,
            });
          },
        );

        const payloadBuffer = extracted.buffer as ArrayBuffer;
        this.port.postMessage(
          {
            id: message.id,
            type: 'SUCCESS',
            payloadBuffer,
          },
          [payloadBuffer],
        );
      } else if (message.type === 'ANALYZE') {
        const analysis = await pngLsbSequential.analyze(
          carrier,
          message.options,
          controller.signal,
        );

        this.port.postMessage({
          id: message.id,
          type: 'SUCCESS',
          analysis,
        });
      }
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      this.port.postMessage({
        id: message.id,
        type: 'ERROR',
        error: {
          name: errorObj.name,
          message: errorObj.message,
          code: (errorObj as { code?: string }).code,
        },
      });
    } finally {
      this.activeJobs.delete(message.id);
    }
  }
}
