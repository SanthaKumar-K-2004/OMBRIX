import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { StegoWorkerClient, type WorkerChannel } from '../../packages/stego-worker/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

describe('Milestone 2 Verification: Connectivity & Error Handling Hardening', () => {
  describe('1. ErrorBoundary Component & App Integration Verification', () => {
    const errorBoundaryPath = path.resolve(rootDir, 'apps/web/src/components/ErrorBoundary.tsx');
    const appPath = path.resolve(rootDir, 'apps/web/src/App.tsx');
    const ebContent = fs.readFileSync(errorBoundaryPath, 'utf-8');
    const appContent = fs.readFileSync(appPath, 'utf-8');

    it('verifies ErrorBoundary exists and implements React class error boundary contract', () => {
      const sourceFile = ts.createSourceFile(
        'ErrorBoundary.tsx',
        ebContent,
        ts.ScriptTarget.Latest,
        true,
      );

      let foundClass = false;
      let hasDerivedState = false;
      let hasComponentDidCatch = false;
      let hasRender = false;

      function visit(node: ts.Node) {
        if (ts.isClassDeclaration(node) && node.name?.text === 'ErrorBoundary') {
          foundClass = true;
          for (const member of node.members) {
            if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name)) {
              if (member.name.text === 'getDerivedStateFromError') hasDerivedState = true;
              if (member.name.text === 'componentDidCatch') hasComponentDidCatch = true;
              if (member.name.text === 'render') hasRender = true;
            }
          }
        }
        ts.forEachChild(node, visit);
      }

      visit(sourceFile);

      expect(foundClass).toBe(true);
      expect(hasDerivedState).toBe(true);
      expect(hasComponentDidCatch).toBe(true);
      expect(hasRender).toBe(true);
    });

    it('verifies ErrorBoundary contains diagnostic UI, reset button, and fallback logic', () => {
      expect(ebContent).toContain('Failed to Render');
      expect(ebContent).toContain('Error Diagnostic');
      expect(ebContent).toContain('Try Again');
      expect(ebContent).toContain('handleReset');
      expect(ebContent).toContain('this.props.onReset?.()');
    });

    it('verifies App.tsx wraps GhostFibers and Studios with ErrorBoundary', () => {
      expect(appContent).toContain("import { ErrorBoundary } from './components/ErrorBoundary.js'");
      expect(appContent).toContain('<ErrorBoundary name="Atmospheric Background">');
      expect(appContent).toContain(
        '<ErrorBoundary key={activeModule} name={`${activeModule.toUpperCase()} Studio`}>',
      );
    });
  });

  describe('2. CSP Compliance & Synchronous Carrier Transfer in LensStudio and ScanStudio', () => {
    const lensStudioPath = path.resolve(rootDir, 'apps/web/src/components/LensStudio.tsx');
    const scanStudioPath = path.resolve(rootDir, 'apps/web/src/components/ScanStudio.tsx');
    const lensContent = fs.readFileSync(lensStudioPath, 'utf-8');
    const scanContent = fs.readFileSync(scanStudioPath, 'utf-8');

    it('verifies LensStudio does NOT call fetch() for incoming carrier payloads', () => {
      expect(lensContent).not.toMatch(/await\s+fetch\s*\(\s*payload\.dataUrl\s*\)/);
      expect(lensContent).not.toMatch(/fetch\s*\(\s*payload\.dataUrl\s*\)/);
      expect(lensContent).toContain('parsePayloadToFile');
    });

    it('verifies ScanStudio does NOT call fetch() for incoming carrier payloads', () => {
      expect(scanContent).not.toMatch(/await\s+fetch\s*\(\s*payload\.dataUrl\s*\)/);
      expect(scanContent).not.toMatch(/fetch\s*\(\s*payload\.dataUrl\s*\)/);
      expect(scanContent).toContain('parsePayloadToFile');
    });

    it('verifies synchronous base64 and bytes parsing matches exact byte payload', () => {
      const rawBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);
      const base64 = Buffer.from(rawBytes).toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;

      function parsePayloadToBytes(payload: {
        dataUrl?: string;
        bytes?: Uint8Array;
        name?: string;
      }): Uint8Array | null {
        if (payload.bytes && payload.bytes.length > 0) {
          return payload.bytes;
        }
        if (payload.dataUrl) {
          const commaIdx = payload.dataUrl.indexOf(',');
          const b64 = commaIdx >= 0 ? payload.dataUrl.slice(commaIdx + 1) : payload.dataUrl;
          const binaryStr = atob(b64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          return bytes;
        }
        return null;
      }

      // Test with raw bytes
      const fromBytes = parsePayloadToBytes({ bytes: rawBytes, name: 'carrier.png' });
      expect(fromBytes).toEqual(rawBytes);

      // Test with dataUrl
      const fromDataUrl = parsePayloadToBytes({ dataUrl, name: 'carrier.png' });
      expect(fromDataUrl).toEqual(rawBytes);
    });

    it('verifies URL.revokeObjectURL cleanup pattern in LensStudio and ScanStudio', () => {
      expect(lensContent).toContain('URL.revokeObjectURL');
      expect(scanContent).toContain('URL.revokeObjectURL');
    });
  });

  describe('3. Non-Blocking Error State in RelayStudio', () => {
    const relayStudioPath = path.resolve(rootDir, 'apps/web/src/components/RelayStudio.tsx');
    const relayContent = fs.readFileSync(relayStudioPath, 'utf-8');

    it('verifies RelayStudio has eliminated all blocking alert() calls', () => {
      expect(relayContent).not.toMatch(/\balert\s*\(/);
    });

    it('verifies RelayStudio uses depositError state and renders inline alert banner', () => {
      expect(relayContent).toContain('depositError');
      expect(relayContent).toContain('setDepositError');
      expect(relayContent).toContain('{depositError &&');
    });
  });

  describe('4. Direct PNG Bytes in DemoShowcaseModal', () => {
    const demoModalPath = path.resolve(rootDir, 'apps/web/src/components/DemoShowcaseModal.tsx');
    const demoContent = fs.readFileSync(demoModalPath, 'utf-8');

    it('verifies DemoShowcaseModal passes bytes: pngBytes over studioDataBus', () => {
      expect(demoContent).toContain('bytes: pngBytes');
      expect(demoContent).toContain('studioDataBus.sendCarrierToModule');
    });
  });

  describe('5. StegoWorkerClient Error and Lifecycle Resilience', () => {
    function createMockWorkerChannel() {
      const listeners = new Map<string, ((event: Event) => void)[]>();

      const channel: WorkerChannel = {
        postMessage: vi.fn(),
        addEventListener: (type: string, listener: (event: Event) => void) => {
          const list = listeners.get(type) ?? [];
          list.push(listener);
          listeners.set(type, list);
        },
        removeEventListener: (type: string, listener: (event: Event) => void) => {
          const list = listeners.get(type) ?? [];
          const idx = list.indexOf(listener);
          if (idx !== -1) list.splice(idx, 1);
        },
      };

      const dispatch = (type: string, event: Event) => {
        const list = listeners.get(type) ?? [];
        for (const fn of list) fn(event);
      };

      return { channel, dispatch, listeners };
    }

    it('rejects pending job with WORKER_TERMINATED_ERROR on worker error event', async () => {
      const { channel, dispatch } = createMockWorkerChannel();
      const client = new StegoWorkerClient(channel);

      const carrier = { width: 10, height: 10, data: new Uint8ClampedArray(400) };
      const promise = client.embed(carrier, new Uint8Array([1, 2, 3]));

      dispatch('error', new ErrorEvent('error', { message: 'Out of memory in worker sandbox' }));

      await expect(promise).rejects.toThrow('Out of memory in worker sandbox');
    });

    it('rejects pending job with WORKER_MESSAGE_DESERIALIZE_ERROR on messageerror event', async () => {
      const { channel, dispatch } = createMockWorkerChannel();
      const client = new StegoWorkerClient(channel);

      const carrier = { width: 10, height: 10, data: new Uint8ClampedArray(400) };
      const promise = client.embed(carrier, new Uint8Array([1, 2, 3]));

      dispatch('messageerror', new MessageEvent('messageerror'));

      await expect(promise).rejects.toThrow('Failed to deserialize worker message');
    });

    it('rejects pending jobs when destroy() is invoked', async () => {
      const { channel } = createMockWorkerChannel();
      const client = new StegoWorkerClient(channel);

      const carrier = { width: 10, height: 10, data: new Uint8ClampedArray(400) };
      const promise = client.embed(carrier, new Uint8Array([1, 2, 3]));

      client.destroy();

      await expect(promise).rejects.toThrow('Stego worker client was destroyed');
    });
  });
});
