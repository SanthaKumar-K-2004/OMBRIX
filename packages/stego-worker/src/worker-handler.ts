import {
  haarDwtStego,
  hyperMatrixMethod,
  pvdStego,
  stealthMatrixMethod,
} from '@ombrix/stego-advanced';
import type { StegoMethod } from '@ombrix/stego-interface';
import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import type { StegoWorkerIncomingMessage, StegoWorkerResponse } from './protocol.js';

export interface WorkerPostMessagePort {
  postMessage(message: StegoWorkerResponse, transfer?: Transferable[]): void;
}

function resolveMethod(methodId?: string): StegoMethod {
  switch (methodId) {
    case 'stego-hyper-matrix':
      return hyperMatrixMethod;
    case 'png-lsb-sequential':
      return pngLsbSequential;
    case 'stego-pvd':
      return pvdStego;
    case 'stego-dwt':
      return haarDwtStego;
    default:
      return stealthMatrixMethod;
  }
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
        const method = resolveMethod(message.options?.methodId);

        const resultCarrier = await method.embed(
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
        let extracted: Uint8Array | null = null;
        let lastError: unknown = null;

        const requestedMethodId = message.options?.methodId;

        if (
          requestedMethodId &&
          requestedMethodId !== 'auto' &&
          requestedMethodId !== 'stego-stealth-matrix'
        ) {
          // Explicit method requested
          const method = resolveMethod(requestedMethodId);
          extracted = await method.extract(
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
        } else {
          // Auto-probe: First try Hyper-Matrix, then Stealth Matrix, then fallback to LSB Sequential, PVD, DWT
          const probeMethods: StegoMethod[] = [
            hyperMatrixMethod,
            stealthMatrixMethod,
            pngLsbSequential,
            pvdStego,
            haarDwtStego,
          ];

          for (const method of probeMethods) {
            try {
              extracted = await method.extract(
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
              if (extracted && extracted.length > 0) {
                break;
              }
            } catch (err) {
              lastError = err;
            }
          }

          if (!extracted) {
            throw lastError || new Error('No valid steganographic payload detected in carrier.');
          }
        }

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
        const method = resolveMethod(message.options?.methodId);
        const analysis = await method.analyze(carrier, message.options, controller.signal);

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
