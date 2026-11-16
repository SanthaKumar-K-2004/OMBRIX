import * as vm from 'node:vm';
import { parentPort, workerData } from 'node:worker_threads';
import { createOmbrixSandboxApi } from './code-mode.js';

async function runWorker() {
  if (!parentPort || !workerData) {
    return;
  }

  const { code, root } = workerData as {
    code: string;
    root: string;
  };

  if (root) {
    process.env.OMBRIX_ROOT = root;
  }

  const logs: string[] = [];
  const api = createOmbrixSandboxApi(logs);

  // Sterile sandbox context
  const sandbox = {
    ...api,
    Uint8Array,
    Uint8ClampedArray,
    ArrayBuffer,
    TextEncoder,
    TextDecoder,
    Math,
    JSON,
    Date,
    Promise,
    Error,
    TypeError,
    RangeError,
    parseInt: Number.parseInt,
    parseFloat: Number.parseFloat,
    isNaN: Number.isNaN,
    isFinite: Number.isFinite,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Set,
    Map,
    Buffer: {
      from: (data: string | Uint8Array | readonly number[], enc?: BufferEncoding) =>
        Buffer.from(data as string, enc),
    },
  };

  // Strip host process from worker global scope
  try {
    (globalThis as unknown as { process?: unknown }).process = undefined;
  } catch {
    // ignore
  }

  const context = vm.createContext(sandbox);

  const wrappedCode = `(async () => {
    ${code}
  })()`;

  try {
    const script = new vm.Script(wrappedCode);
    const result = await script.runInContext(context, {
      displayErrors: true,
    });
    parentPort.postMessage({
      status: 'success',
      result,
      logs,
    });
  } catch (err) {
    parentPort.postMessage({
      status: 'error',
      error: (err as Error).message || String(err),
      logs,
    });
  }
}

runWorker().catch((err) => {
  if (parentPort) {
    parentPort.postMessage({
      status: 'error',
      error: (err as Error).message || String(err),
      logs: [],
    });
  }
});
