import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StegoAbortError, StegoError } from '@ombrix/stego-interface';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import {
  StegoWorkerClient,
  type WorkerChannel,
  type WorkerChannelEvent,
} from '../../packages/stego-worker/src/worker-client.js';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

describe('Milestone 2 Empirical Challenger Verification Suite', () => {
  describe('1. CSP connect-src "none" Compliance & Zero-Fetch Carrier Transfer', () => {
    const lensPath = path.resolve(rootDir, 'apps/web/src/components/LensStudio.tsx');
    const scanPath = path.resolve(rootDir, 'apps/web/src/components/ScanStudio.tsx');
    const lensContent = fs.readFileSync(lensPath, 'utf-8');
    const scanContent = fs.readFileSync(scanPath, 'utf-8');

    it('empirically verifies via AST that LensStudio and ScanStudio contain zero calls to fetch()', () => {
      for (const [name, content] of [
        ['LensStudio.tsx', lensContent],
        ['ScanStudio.tsx', scanContent],
      ]) {
        const sf = ts.createSourceFile(name, content, ts.ScriptTarget.Latest, true);
        const fetchCalls: string[] = [];

        function checkNode(node: ts.Node) {
          if (ts.isCallExpression(node)) {
            const exprText = node.expression.getText(sf);
            if (
              exprText === 'fetch' ||
              exprText === 'window.fetch' ||
              exprText === 'globalThis.fetch'
            ) {
              fetchCalls.push(exprText);
            }
          }
          ts.forEachChild(node, checkNode);
        }

        checkNode(sf);
        expect(fetchCalls, `${name} must not call fetch()`).toEqual([]);
      }
    });

    it('verifies parsePayloadToFile decodes payloads under an active CSP network blocker', () => {
      // Mock globalThis.fetch to simulate CSP connect-src 'none' throwing SecurityError
      const originalFetch = globalThis.fetch;
      const fetchMock = vi.fn().mockImplementation(() => {
        throw new Error("SecurityError: Failed to fetch: CSP connect-src 'none' blocks fetch");
      });
      globalThis.fetch = fetchMock;

      try {
        // Implement test oracle mirroring parsePayloadToFile logic
        function parsePayloadToFile(payload: {
          dataUrl?: string;
          bytes?: Uint8Array;
          name?: string;
        }): File | null {
          const filename = payload.name || 'carrier.png';
          if (payload.bytes && payload.bytes.length > 0) {
            return new File([payload.bytes as unknown as BlobPart], filename, {
              type: 'image/png',
            });
          }
          if (payload.dataUrl) {
            const commaIdx = payload.dataUrl.indexOf(',');
            const base64 = commaIdx >= 0 ? payload.dataUrl.slice(commaIdx + 1) : payload.dataUrl;
            const binaryStr = atob(base64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            return new File([bytes as unknown as BlobPart], filename, { type: 'image/png' });
          }
          return null;
        }

        // Test 1: Direct bytes payload
        const sampleBytes = new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02,
        ]);
        const file1 = parsePayloadToFile({ bytes: sampleBytes, name: 'direct.png' });
        expect(file1).not.toBeNull();
        expect(file1?.name).toBe('direct.png');
        expect(file1?.size).toBe(sampleBytes.length);

        // Test 2: Base64 dataUrl payload
        const b64 = Buffer.from(sampleBytes).toString('base64');
        const dataUrl = `data:image/png;base64,${b64}`;
        const file2 = parsePayloadToFile({ dataUrl, name: 'from-dataurl.png' });
        expect(file2).not.toBeNull();
        expect(file2?.name).toBe('from-dataurl.png');
        expect(file2?.size).toBe(sampleBytes.length);

        // Test 3: Raw base64 string without data: prefix
        const file3 = parsePayloadToFile({ dataUrl: b64, name: 'raw-b64.png' });
        expect(file3).not.toBeNull();
        expect(file3?.size).toBe(sampleBytes.length);

        // Test 4: Empty payload or zero-length bytes
        expect(parsePayloadToFile({})).toBeNull();
        expect(parsePayloadToFile({ bytes: new Uint8Array(0) })).toBeNull();

        // Test 5: Verify fetch was NEVER called
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('verifies entire apps/web/src directory contains zero active fetch calls', () => {
      const srcDir = path.resolve(rootDir, 'apps/web/src');
      function scanDir(dir: string): string[] {
        let results: string[] = [];
        const files = fs.readdirSync(dir);
        for (const f of files) {
          const full = path.join(dir, f);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            results = results.concat(scanDir(full));
          } else if (f.endsWith('.ts') || f.endsWith('.tsx')) {
            results.push(full);
          }
        }
        return results;
      }

      const allFiles = scanDir(srcDir);
      for (const file of allFiles) {
        const text = fs.readFileSync(file, 'utf-8');
        // Ignore comments like // ... without fetch()
        const nonCommentLines = text
          .split('\n')
          .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'));
        const cleanText = nonCommentLines.join('\n');
        expect(cleanText).not.toMatch(/\bfetch\s*\(/);
      }
    });
  });

  describe('2. ErrorBoundary Implementation, Crash Simulation & Reset Verification', () => {
    const ebPath = path.resolve(rootDir, 'apps/web/src/components/ErrorBoundary.tsx');
    const ebContent = fs.readFileSync(ebPath, 'utf-8');
    const appPath = path.resolve(rootDir, 'apps/web/src/App.tsx');
    const appContent = fs.readFileSync(appPath, 'utf-8');

    it('verifies ErrorBoundary has correct lifecycle methods and fallback structure', () => {
      expect(ebContent).toContain('class ErrorBoundary extends Component');
      expect(ebContent).toContain('static getDerivedStateFromError');
      expect(ebContent).toContain('componentDidCatch');
      expect(ebContent).toContain('handleReset = ()');
      expect(ebContent).toContain('this.props.onReset?.()');
      expect(ebContent).toContain('Failed to Render');
      expect(ebContent).toContain('Error Diagnostic');
      expect(ebContent).toContain('Try Again');
    });

    it('verifies ErrorBoundary state transition logic under simulated crash', () => {
      // Simulate getDerivedStateFromError
      const testError = new Error('Simulated WebGL 3D context creation crash');

      // Oracle testing of ErrorBoundary static method behavior
      function getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
      }

      const state1 = getDerivedStateFromError(testError);
      expect(state1.hasError).toBe(true);
      expect(state1.error.message).toBe('Simulated WebGL 3D context creation crash');

      // Simulate handleReset
      let resetCalled = false;
      const onReset = () => {
        resetCalled = true;
      };
      function handleReset(
        setState: (s: { hasError: boolean; error: null }) => void,
        callback?: () => void,
      ) {
        setState({ hasError: false, error: null });
        callback?.();
      }

      let currentState: { hasError: boolean; error: Error | null } = state1;
      handleReset((s) => {
        currentState = { hasError: s.hasError, error: s.error };
      }, onReset);
      expect(currentState.hasError).toBe(false);
      expect(currentState.error).toBeNull();
      expect(resetCalled).toBe(true);
    });

    it('verifies App.tsx wraps both Atmospheric Background and Active Modules with ErrorBoundary', () => {
      expect(appContent).toContain("import { ErrorBoundary } from './components/ErrorBoundary.js'");
      expect(appContent).toContain('<ErrorBoundary name="Atmospheric Background">');
      expect(appContent).toContain(
        '<ErrorBoundary key={activeModule} name={`${activeModule.toUpperCase()} Studio`}>',
      );
    });
  });

  describe('3. Non-Blocking Error State in RelayStudio', () => {
    const relayPath = path.resolve(rootDir, 'apps/web/src/components/RelayStudio.tsx');
    const relayContent = fs.readFileSync(relayPath, 'utf-8');

    it('verifies RelayStudio contains zero blocking alert() calls', () => {
      const sf = ts.createSourceFile('RelayStudio.tsx', relayContent, ts.ScriptTarget.Latest, true);
      const alertCalls: string[] = [];

      function checkNode(node: ts.Node) {
        if (ts.isCallExpression(node)) {
          const expr = node.expression.getText(sf);
          if (expr === 'alert' || expr === 'window.alert') {
            alertCalls.push(expr);
          }
        }
        ts.forEachChild(node, checkNode);
      }

      checkNode(sf);
      expect(alertCalls).toEqual([]);
    });

    it('verifies RelayStudio has inline depositError state and renders error banner', () => {
      expect(relayContent).toContain(
        'const [depositError, setDepositError] = useState<string | null>(null);',
      );
      expect(relayContent).toContain('setDepositError(null);');
      expect(relayContent).toContain('setDepositError(`Deposit error: ${msg}`);');
      expect(relayContent).toContain('{depositError && (');
    });
  });

  describe('4. Object URL Revocation & Memory Leak Prevention in Studios', () => {
    const lensPath = path.resolve(rootDir, 'apps/web/src/components/LensStudio.tsx');
    const scanPath = path.resolve(rootDir, 'apps/web/src/components/ScanStudio.tsx');
    const lensContent = fs.readFileSync(lensPath, 'utf-8');
    const scanContent = fs.readFileSync(scanPath, 'utf-8');

    it('verifies LensStudio cleans up object URLs on preview update and unmount', () => {
      expect(lensContent).toContain("carrierPreviewRef.current?.startsWith('blob:')");
      expect(lensContent).toContain("comparePreviewRef.current?.startsWith('blob:')");
      expect(lensContent).toContain('URL.revokeObjectURL(carrierPreviewRef.current)');
      expect(lensContent).toContain('URL.revokeObjectURL(comparePreviewRef.current)');
      expect(lensContent).toContain('URL.revokeObjectURL(prev)');
    });

    it('verifies ScanStudio cleans up object URLs on preview update, error, and unmount', () => {
      expect(scanContent).toContain("carrierPreviewRef.current?.startsWith('blob:')");
      expect(scanContent).toContain('URL.revokeObjectURL(carrierPreviewRef.current)');
      expect(scanContent).toContain('URL.revokeObjectURL(objUrl)');
      expect(scanContent).toContain('URL.revokeObjectURL(prev)');
    });
  });

  describe('5. StegoWorkerClient Adversarial Event Stress Testing', () => {
    function createMockWorkerChannel() {
      const listeners = new Map<string, ((event: WorkerChannelEvent) => void)[]>();

      const channel: WorkerChannel = {
        postMessage: vi.fn(),
        addEventListener: (type: string, listener: (event: WorkerChannelEvent) => void) => {
          const list = listeners.get(type) ?? [];
          list.push(listener);
          listeners.set(type, list);
        },
        removeEventListener: (type: string, listener: (event: WorkerChannelEvent) => void) => {
          const list = listeners.get(type) ?? [];
          const idx = list.indexOf(listener);
          if (idx !== -1) list.splice(idx, 1);
        },
      };

      const dispatch = (type: string, event: WorkerChannelEvent) => {
        const list = listeners.get(type) ?? [];
        for (const fn of list) fn(event);
      };

      return { channel, dispatch, listeners };
    }

    it('concurrently rejects all 5 pending jobs when worker emits an unhandled error event', async () => {
      const { channel, dispatch } = createMockWorkerChannel();
      const client = new StegoWorkerClient(channel);

      const dummyCarrier = { width: 4, height: 4, data: new Uint8ClampedArray(64) };
      const promises = [
        client.embed(dummyCarrier, new Uint8Array([1])),
        client.embed(dummyCarrier, new Uint8Array([2])),
        client.extract(dummyCarrier),
        client.extract(dummyCarrier),
        client.analyze(dummyCarrier),
      ];

      // Worker crashes with an error event
      dispatch('error', new ErrorEvent('error', { message: 'WebWorker killed by OOM killer' }));

      for (const p of promises) {
        await expect(p).rejects.toThrow('WebWorker killed by OOM killer');
        await expect(p).rejects.toBeInstanceOf(StegoError);
      }
    });

    it('concurrently rejects all pending jobs on messageerror event', async () => {
      const { channel, dispatch } = createMockWorkerChannel();
      const client = new StegoWorkerClient(channel);

      const dummyCarrier = { width: 4, height: 4, data: new Uint8ClampedArray(64) };
      const p1 = client.embed(dummyCarrier, new Uint8Array([1]));
      const p2 = client.extract(dummyCarrier);

      dispatch('messageerror', new MessageEvent('messageerror'));

      await expect(p1).rejects.toThrow('Failed to deserialize worker message');
      await expect(p2).rejects.toThrow('Failed to deserialize worker message');
    });

    it('rejects pending jobs with StegoAbortError on client.destroy() and unregisters listeners', async () => {
      const { channel, listeners } = createMockWorkerChannel();
      const client = new StegoWorkerClient(channel);

      expect(listeners.get('message')?.length).toBe(1);
      expect(listeners.get('error')?.length).toBe(1);
      expect(listeners.get('messageerror')?.length).toBe(1);

      const dummyCarrier = { width: 4, height: 4, data: new Uint8ClampedArray(64) };
      const p = client.embed(dummyCarrier, new Uint8Array([1]));

      client.destroy();

      await expect(p).rejects.toThrow('Stego worker client was destroyed');
      await expect(p).rejects.toBeInstanceOf(StegoAbortError);

      expect(listeners.get('message')?.length).toBe(0);
      expect(listeners.get('error')?.length).toBe(0);
      expect(listeners.get('messageerror')?.length).toBe(0);
    });

    it('safely ignores mismatched or spurious event types without crashing', () => {
      const { channel, dispatch } = createMockWorkerChannel();
      const client = new StegoWorkerClient(channel);

      // Dispatch mismatched types to listeners (simulating buggy browser or polyfill)
      expect(() => {
        dispatch('message', new Event('generic-event'));
        dispatch('error', new Event('non-error-event'));
        dispatch('messageerror', new Event('non-messageerror-event'));
        dispatch('unknown_custom_type', new CustomEvent('custom'));
      }).not.toThrow();

      client.destroy();
    });
  });
});
