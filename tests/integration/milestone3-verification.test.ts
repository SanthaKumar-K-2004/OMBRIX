import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StegoWorkerResponse, StegoWorkerSuccessResponse } from '@ombrix/stego-worker';
import { StegoWorkerHandler } from '@ombrix/stego-worker';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

describe('Milestone 3 & Performance Verification Suite', () => {
  const sliderPath = path.resolve(rootDir, 'apps/web/src/components/SplitComparisonSlider.tsx');
  const coreStudioPath = path.resolve(rootDir, 'apps/web/src/components/CoreStudio.tsx');
  const ghostFibersPath = path.resolve(rootDir, 'apps/web/src/components/GhostFibers.tsx');
  const appPath = path.resolve(rootDir, 'apps/web/src/App.tsx');
  const protocolPath = path.resolve(rootDir, 'packages/stego-worker/src/protocol.ts');
  const workerHandlerPath = path.resolve(rootDir, 'packages/stego-worker/src/worker-handler.ts');
  const workerClientPath = path.resolve(rootDir, 'packages/stego-worker/src/worker-client.ts');
  const workerEntryPath = path.resolve(rootDir, 'packages/stego-worker/src/stego.worker.ts');

  const sliderContent = fs.readFileSync(sliderPath, 'utf-8');
  const coreContent = fs.readFileSync(coreStudioPath, 'utf-8');
  const ghostContent = fs.readFileSync(ghostFibersPath, 'utf-8');
  const appContent = fs.readFileSync(appPath, 'utf-8');
  const protocolContent = fs.readFileSync(protocolPath, 'utf-8');
  const handlerContent = fs.readFileSync(workerHandlerPath, 'utf-8');
  const clientContent = fs.readFileSync(workerClientPath, 'utf-8');

  describe('1. SplitComparisonSlider Responsiveness & Pointer Capture', () => {
    it('caches container bounding client rect on pointerdown rather than querying on every move event', () => {
      expect(sliderContent).toContain(
        'rectRef.current = containerRef.current.getBoundingClientRect()',
      );
      expect(sliderContent).toContain('onPointerDown={handlePointerDown}');
    });

    it('uses e.currentTarget.setPointerCapture and releasePointerCapture for drag interactions', () => {
      expect(sliderContent).toContain('e.currentTarget.setPointerCapture(e.pointerId)');
      expect(sliderContent).toContain('e.currentTarget.releasePointerCapture(e.pointerId)');
      expect(sliderContent).toContain('onPointerUp={handlePointerUp}');
      expect(sliderContent).toContain('onPointerCancel={handlePointerUp}');
    });

    it('batches/throttles position updates using requestAnimationFrame (rafRef)', () => {
      expect(sliderContent).toContain('requestAnimationFrame');
      expect(sliderContent).toContain('rafRef.current');
      expect(sliderContent).toContain('cancelAnimationFrame');
    });

    it('ensures clean cleanup of RAF on unmount', () => {
      expect(sliderContent).toContain('useEffect(() =>');
      expect(sliderContent).toContain('cancelAnimationFrame(rafRef.current)');
      expect(sliderContent).toContain('rafRef.current = null');
    });

    it('simulates RAF throttling behavior: multiple rapid move events coalesce into 1 frame update', () => {
      let rafId: number | null = null;
      let scheduledCallback: (() => void) | null = null;
      let renderCount = 0;
      let renderedX = 0;
      let latestX = 0;

      const mockRequestAnimationFrame = (cb: () => void) => {
        scheduledCallback = cb;
        return 123;
      };

      const handleMove = (clientX: number) => {
        latestX = clientX;
        if (rafId !== null) return;
        rafId = mockRequestAnimationFrame(() => {
          rafId = null;
          renderCount++;
          renderedX = latestX;
        });
      };

      // 5 rapid move events
      handleMove(10);
      handleMove(20);
      handleMove(35);
      handleMove(50);
      handleMove(75);

      expect(renderCount).toBe(0);
      expect(rafId).toBe(123);

      // Execute frame
      scheduledCallback?.();
      expect(renderCount).toBe(1);
      expect(renderedX).toBe(75);
    });
  });

  describe('2. CoreStudio Main-Thread Offload & Debounce', () => {
    it('debounces smartCompress on rawPayloadBytes with 250ms delay to prevent typing lag', () => {
      expect(coreContent).toContain('setTimeout(');
      expect(coreContent).toContain('250');
      expect(coreContent).toContain('clearTimeout(timer)');
      expect(coreContent).toContain('smartCompress(rawPayloadBytes)');
    });

    it('consumes worker-computed metrics directly to eliminate main-thread 8.3M byte loops', () => {
      expect(coreContent).toContain('if (stegoCarrier.metrics)');
      expect(coreContent).toContain('setMse(stegoCarrier.metrics.mse)');
      expect(coreContent).toContain('setPsnr(stegoCarrier.metrics.psnr)');
    });

    it('provides clean fallback calculation when worker metrics are absent', () => {
      expect(coreContent).toContain('} else {');
      expect(coreContent).toContain('const totalBytes = carrierImageData.data.length');
      expect(coreContent).toContain('const step = totalBytes > 1000000 ? 16 : 1');
    });
  });

  describe('3. GhostFibers Performance Tuning', () => {
    it('clamps MAX_RENDER_DIM to 1280 to prevent 4K fill-rate exhaustion', () => {
      expect(ghostContent).toContain('const MAX_RENDER_DIM = 1280');
    });

    it('reduces BLOOM_LEVELS to 1 to cut redundant off-screen framebuffer ping-pong passes', () => {
      expect(ghostContent).toContain('const BLOOM_LEVELS = 1');
    });

    it('eliminates continuous nearestOnRibbon trigonometric raymarching from the frame loop', () => {
      expect(ghostContent).not.toMatch(/state\.frame\s*%\s*3\s*===/);
      expect(ghostContent).not.toContain('const nearestOnRibbon =');
    });

    it('throttles pointermove with requestAnimationFrame when mouse interaction is active', () => {
      expect(ghostContent).toContain('let moveRaf = 0');
      expect(ghostContent).toContain('requestAnimationFrame');
    });
  });

  describe('4. App.tsx Code-Splitting & Transition Smoothing', () => {
    it('uses React.lazy to split all secondary studios into on-demand async chunks', () => {
      expect(appContent).toContain('lazy(() =>');
      expect(appContent).toContain('./components/VaultStudio.js');
      expect(appContent).toContain('./components/LensStudio.js');
      expect(appContent).toContain('./components/LabStudio.js');
      expect(appContent).toContain('./components/TransitStudio.js');
      expect(appContent).toContain('./components/LinkStudio.js');
      expect(appContent).toContain('./components/FlowStudio.js');
      expect(appContent).toContain('./components/EdgeStudio.js');
      expect(appContent).toContain('./components/ScanStudio.js');
      expect(appContent).toContain('./components/AirGapStudio.js');
      expect(appContent).toContain('./components/RelayStudio.js');
    });

    it('statically imports CoreStudio for instant initial page display', () => {
      expect(appContent).toContain("import { CoreStudio } from './components/CoreStudio.js';");
    });

    it('wraps studio navigation state updates in React.startTransition', () => {
      expect(appContent).toContain('startTransition(');
      expect(appContent).toContain('setActiveModule(');
    });

    it('wraps dynamic studios in Suspense with fallback loader', () => {
      expect(appContent).toContain('<Suspense');
      expect(appContent).toContain('fallback=');
      expect(appContent).toContain('Loading studio workspace...');
    });
  });

  describe('5. StegoWorker Protocol & Metrics Pipeline', () => {
    it('defines metrics in StegoWorkerSuccessResponse protocol with elapsedMs', () => {
      expect(protocolContent).toContain(
        'readonly metrics?: { mse: number; psnr: number; elapsedMs: number }',
      );
    });

    it('ensures stego.worker.ts entry point exists in packages/stego-worker/src', () => {
      expect(fs.existsSync(workerEntryPath)).toBe(true);
    });

    it('computes MSE, PSNR, and elapsedMs directly inside worker-handler.ts', () => {
      expect(handlerContent).toContain('const calculatedMse = sumSq / totalBytes');
      expect(handlerContent).toContain('10 * Math.log10((255 * 255) / calculatedMse)');
      expect(handlerContent).toContain('elapsedMs');
      expect(handlerContent).toContain('metrics,');
    });

    it('exposes StegoEmbedResult from StegoWorkerClient', () => {
      expect(clientContent).toContain('export interface StegoEmbedResult extends CarrierImage');
      expect(clientContent).toContain('Promise<StegoEmbedResult>');
    });

    it('empirically computes metrics { mse, psnr, elapsedMs } during actual worker embed execution', async () => {
      let response: StegoWorkerResponse | null = null;
      const handler = new StegoWorkerHandler({
        postMessage: (msg: StegoWorkerResponse) => {
          response = msg;
        },
      });

      const width = 32;
      const height = 32;
      const carrierBuffer = new Uint8ClampedArray(width * height * 4);
      // Initialize with realistic gradient pixels
      for (let i = 0; i < carrierBuffer.length; i += 4) {
        carrierBuffer[i] = (i * 3) % 256;
        carrierBuffer[i + 1] = (i * 7) % 256;
        carrierBuffer[i + 2] = (i * 11) % 256;
        carrierBuffer[i + 3] = 255;
      }

      const payload = new TextEncoder().encode('Empirical Milestone 3 Test Payload');

      await handler.handleMessage({
        id: 'test_m3_metrics_job',
        type: 'EMBED',
        width,
        height,
        carrierBuffer: carrierBuffer.buffer,
        payloadBuffer: payload.buffer,
        options: {
          methodId: 'png-lsb-sequential',
        },
      });

      expect(response).not.toBeNull();
      const successResp = response as unknown as StegoWorkerSuccessResponse;
      expect(successResp.type).toBe('SUCCESS');
      expect(successResp.metrics).toBeDefined();
      expect(typeof successResp.metrics?.mse).toBe('number');
      expect(typeof successResp.metrics?.psnr).toBe('number');
      expect(typeof successResp.metrics?.elapsedMs).toBe('number');
      expect(successResp.metrics?.mse).toBeGreaterThanOrEqual(0);
      expect(successResp.metrics?.psnr).toBeGreaterThan(0);
      expect(successResp.metrics?.elapsedMs).toBeGreaterThanOrEqual(0);
    });
  });
});
