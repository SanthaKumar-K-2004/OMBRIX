import { StegoWorkerHandler } from '@ombrix/stego-worker';
import type { StegoWorkerIncomingMessage, StegoWorkerResponse } from '@ombrix/stego-worker';

const handler = new StegoWorkerHandler({
  postMessage: (msg: StegoWorkerResponse, transfer?: Transferable[]) => {
    if (transfer && transfer.length > 0) {
      self.postMessage(msg, { transfer });
    } else {
      self.postMessage(msg);
    }
  },
});

self.onmessage = (e: MessageEvent<StegoWorkerIncomingMessage>) => {
  handler.handleMessage(e.data);
};
