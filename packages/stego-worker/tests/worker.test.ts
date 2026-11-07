import {
  type CarrierImage,
  InsufficientCapacityError,
  StegoAbortError,
} from '@ombrix/stego-interface';
import { describe, expect, it } from 'vitest';
import {
  StegoWorkerClient,
  StegoWorkerHandler,
  type StegoWorkerIncomingMessage,
  type StegoWorkerResponse,
  type WorkerChannel,
  type WorkerPostMessagePort,
} from '../src/index.js';

function createMockChannel() {
  const listeners: ((event: MessageEvent<StegoWorkerResponse>) => void)[] = [];

  const port: WorkerPostMessagePort = {
    postMessage(message: StegoWorkerResponse) {
      queueMicrotask(() => {
        const event = new MessageEvent('message', { data: message });
        for (const listener of listeners) {
          listener(event);
        }
      });
    },
  };

  const handler = new StegoWorkerHandler(port);

  const clientChannel: WorkerChannel = {
    postMessage(message: StegoWorkerIncomingMessage) {
      queueMicrotask(() => {
        handler.handleMessage(message);
      });
    },
    addEventListener(_type, listener) {
      listeners.push(listener);
    },
    removeEventListener(_type, listener) {
      const idx = listeners.indexOf(listener);
      if (idx !== -1) listeners.splice(idx, 1);
    },
  };

  const client = new StegoWorkerClient(clientChannel);

  return { client, handler };
}

function createCarrier(width: number, height: number): CarrierImage {
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(128);
  return { width, height, data };
}

describe('stego-worker package', () => {
  it('performs end-to-end embed and extract via worker channel', async () => {
    const { client } = createMockChannel();
    const carrier = createCarrier(60, 60);
    const payload = new TextEncoder().encode('OMBRIX Worker Sandbox Verification Message');

    const progressLog: number[] = [];
    const stegoCarrier = await client.embed(carrier, payload, undefined, undefined, (p) =>
      progressLog.push(p),
    );

    expect(stegoCarrier.width).toBe(60);
    expect(stegoCarrier.height).toBe(60);
    expect(progressLog.length).toBeGreaterThan(0);

    const extracted = await client.extract(stegoCarrier);
    expect(new TextDecoder().decode(extracted)).toBe('OMBRIX Worker Sandbox Verification Message');
  });

  it('runs carrier analysis in worker sandbox', async () => {
    const { client } = createMockChannel();
    const carrier = createCarrier(50, 50);

    const analysis = await client.analyze(carrier);
    expect(analysis.totalPixels).toBe(2500);
    expect(analysis.capacity.usableBytes).toBeGreaterThan(0);
  });

  it('handles and maps typed worker errors back to client', async () => {
    const { client } = createMockChannel();
    const tinyCarrier = createCarrier(10, 10);
    const oversizedPayload = new Uint8Array(5000); // Exceeds 33 usable bytes

    await expect(client.embed(tinyCarrier, oversizedPayload)).rejects.toThrow(
      InsufficientCapacityError,
    );
  });

  it('supports cancellation via AbortSignal in worker client', async () => {
    const { client } = createMockChannel();
    const carrier = createCarrier(100, 100);
    const payload = new Uint8Array(2000);
    const controller = new AbortController();

    controller.abort();

    await expect(client.embed(carrier, payload, undefined, controller.signal)).rejects.toThrow(
      StegoAbortError,
    );
  });
});
