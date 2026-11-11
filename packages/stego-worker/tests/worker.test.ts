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

if (typeof globalThis.ErrorEvent === 'undefined') {
  class ErrorEventPolyfill extends Event {
    readonly message: string;
    constructor(type: string, init?: { message?: string }) {
      super(type);
      this.message = init?.message ?? '';
    }
  }
  // @ts-expect-error Node.js polyfill
  globalThis.ErrorEvent = ErrorEventPolyfill;
}

function createMockChannel() {
  const eventListeners = new Map<
    string,
    ((event: Event | MessageEvent<StegoWorkerResponse> | ErrorEvent) => void)[]
  >();

  const dispatchEvent = (
    type: string,
    event: Event | MessageEvent<StegoWorkerResponse> | ErrorEvent,
  ) => {
    const list = eventListeners.get(type) ?? [];
    for (const listener of list) {
      listener(event);
    }
  };

  const port: WorkerPostMessagePort = {
    postMessage(message: StegoWorkerResponse) {
      queueMicrotask(() => {
        const event = new MessageEvent('message', { data: message });
        dispatchEvent('message', event);
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
    addEventListener(type, listener) {
      const list = eventListeners.get(type) ?? [];
      list.push(listener);
      eventListeners.set(type, list);
    },
    removeEventListener(type, listener) {
      const list = eventListeners.get(type) ?? [];
      const idx = list.indexOf(listener);
      if (idx !== -1) list.splice(idx, 1);
    },
  };

  const client = new StegoWorkerClient(clientChannel);

  return { client, handler, dispatchEvent, clientChannel };
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

  it('embeds and extracts via stealth matrix with passphrase in worker sandbox', async () => {
    const { client } = createMockChannel();
    const carrier = createCarrier(80, 80);
    const payload = new TextEncoder().encode('Stealth Matrix in Worker Test');
    const options = { methodId: 'stego-stealth-matrix', passphrase: 'worker-passphrase-test' };

    const stegoCarrier = await client.embed(carrier, payload, options);
    const extracted = await client.extract(stegoCarrier, options);
    expect(new TextDecoder().decode(extracted)).toBe('Stealth Matrix in Worker Test');
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

  it('rejects pending jobs when worker terminates with an unhandled error event', async () => {
    const { client, dispatchEvent } = createMockChannel();
    const carrier = createCarrier(100, 100);
    const payload = new Uint8Array(2000);

    const embedPromise = client.embed(carrier, payload);
    dispatchEvent('error', new ErrorEvent('error', { message: 'Worker crashed unexpectedly' }));

    await expect(embedPromise).rejects.toThrow('Worker crashed unexpectedly');
  });

  it('rejects pending jobs when messageerror event is fired', async () => {
    const { client, dispatchEvent } = createMockChannel();
    const carrier = createCarrier(100, 100);
    const payload = new Uint8Array(2000);

    const embedPromise = client.embed(carrier, payload);
    dispatchEvent('messageerror', new MessageEvent('messageerror'));

    await expect(embedPromise).rejects.toThrow('Failed to deserialize worker message');
  });

  it('rejects pending jobs when client is destroyed', async () => {
    const { client } = createMockChannel();
    const carrier = createCarrier(100, 100);
    const payload = new Uint8Array(2000);

    const embedPromise = client.embed(carrier, payload);
    client.destroy();

    await expect(embedPromise).rejects.toThrow('Stego worker client was destroyed');
  });
});
