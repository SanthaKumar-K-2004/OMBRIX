import {
  haarDwtStego,
  hyperMatrixMethod,
  jpegDctStego,
  pvdStego,
  robustResilientStego,
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
    case 'stego-robust-resilient':
      return robustResilientStego;
    case 'stego-dct':
      return jpegDctStego;
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

        const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
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

        // Compute empirical MSE & PSNR inside worker to eliminate main-thread lag
        let sumSq = 0;
        const totalBytes = carrierData.length;
        for (let i = 0; i < totalBytes; i++) {
          const d = (carrierData[i] ?? 0) - (resultCarrier.data[i] ?? 0);
          sumSq += d * d;
        }
        const calculatedMse = sumSq / totalBytes;
        const calculatedPsnr =
          calculatedMse === 0 ? 99.9 : 10 * Math.log10((255 * 255) / calculatedMse);
        const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const elapsedMs = Math.round((endTime - startTime) * 100) / 100;
        const metrics = {
          mse: Math.round(calculatedMse * 10000) / 10000,
          psnr: Math.round(calculatedPsnr * 10) / 10,
          elapsedMs,
        };

        const resultBuffer = resultCarrier.data.buffer as ArrayBuffer;
        this.port.postMessage(
          {
            id: message.id,
            type: 'SUCCESS',
            carrierBuffer: resultBuffer,
            metrics,
          },
          [resultBuffer],
        );
      } else if (message.type === 'EXTRACT') {
        let extracted: Uint8Array | null = null;
        const requestedMethodId = message.options?.methodId;

        if (requestedMethodId && requestedMethodId !== 'auto') {
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
          // Auto-probe: Hyper-Matrix -> Stealth Matrix -> Robust Messaging (WhatsApp safe) -> LSB -> PVD -> DWT -> DCT
          const probeMethods: StegoMethod[] = [
            hyperMatrixMethod,
            stealthMatrixMethod,
            robustResilientStego,
            pngLsbSequential,
            pvdStego,
            haarDwtStego,
            jpegDctStego,
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
            } catch {
              // Method probe failed, try next method in probe sequence
            }
          }

          if (!extracted || extracted.length === 0) {
            throw new Error(
              'No valid steganographic payload detected in this carrier. If this secret is locked with a Passkey or Token, please ensure the exact matching passkey is entered. Also verify the carrier image was not recompressed or resized by third-party messaging apps.',
            );
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
