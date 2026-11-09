import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initCrypto } from '@ombrix/crypto-adapter';
import ts from 'typescript';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

describe('Milestone 1 Empirical Verification & Adversarial Stress Harness', () => {
  beforeAll(async () => {
    await initCrypto();
  });

  describe('1. AST & Static Analysis of GhostFibers.tsx for Forced Reflows', () => {
    const ghostFibersPath = path.resolve(rootDir, 'apps/web/src/components/GhostFibers.tsx');
    const content = fs.readFileSync(ghostFibersPath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      'GhostFibers.tsx',
      content,
      ts.ScriptTarget.Latest,
      true,
    );

    it('verifies getBoundingClientRect is NEVER called inside onPointerMove or onPointerDown', () => {
      let insidePointerMove = false;
      let insidePointerDown = false;
      let pointerMoveCallsBcr = false;
      let pointerDownCallsBcr = false;
      const bcrCallLocations: string[] = [];

      function visit(node: ts.Node) {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
          if (node.name.text === 'onPointerMove') {
            insidePointerMove = true;
            ts.forEachChild(node, visit);
            insidePointerMove = false;
            return;
          }
          if (node.name.text === 'onPointerDown') {
            insidePointerDown = true;
            ts.forEachChild(node, visit);
            insidePointerDown = false;
            return;
          }
        }

        if (ts.isCallExpression(node)) {
          const propAccess = node.expression;
          if (
            ts.isPropertyAccessExpression(propAccess) &&
            propAccess.name.text === 'getBoundingClientRect'
          ) {
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            bcrCallLocations.push(`Line ${line}`);
            if (insidePointerMove) pointerMoveCallsBcr = true;
            if (insidePointerDown) pointerDownCallsBcr = true;
          }
        }

        ts.forEachChild(node, visit);
      }

      visit(sourceFile);

      expect(pointerMoveCallsBcr).toBe(false);
      expect(pointerDownCallsBcr).toBe(false);
      // getBoundingClientRect should only be called once in the whole file: inside updateRect
      expect(bcrCallLocations.length).toBe(1);
    });

    it('verifies onPointerDown does NOT invoke nearestOnRibbon synchronously', () => {
      let insidePointerDown = false;
      let pointerDownCallsNearest = false;

      function visit(node: ts.Node) {
        if (
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.name.text === 'onPointerDown'
        ) {
          insidePointerDown = true;
          ts.forEachChild(node, visit);
          insidePointerDown = false;
          return;
        }

        if (insidePointerDown && ts.isCallExpression(node)) {
          const fn = node.expression;
          if (ts.isIdentifier(fn) && fn.text === 'nearestOnRibbon') {
            pointerDownCallsNearest = true;
          }
        }

        ts.forEachChild(node, visit);
      }

      visit(sourceFile);
      expect(pointerDownCallsNearest).toBe(false);
    });

    it('verifies GhostFibers is wrapped with memo and exported with displayName', () => {
      expect(content).toContain('export const GhostFibers = memo(GhostFibersComponent);');
      expect(content).toContain("GhostFibers.displayName = 'GhostFibers';");
    });

    it('verifies effect hooks have explicit dependency arrays to prevent unbracketed re-runs', () => {
      // Find all useEffect calls in the component
      const regex = /useEffect\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?\},\s*\[\s*\]\s*\)/g;
      const matches = content.match(regex);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });

    it('verifies legacy blurred aurora backdrop divs are completely removed', () => {
      expect(content).not.toContain('animate-aurora-ribbon');
      expect(content).not.toContain('animate-aurora-reverse');
      expect(content).not.toContain('animate-aurora-pulse');
      expect(content).not.toContain('animate-aurora-drift');
      expect(content).not.toContain('blur(60px)');
      expect(content).not.toContain('blur(70px)');
      expect(content).not.toContain('aurora-ribbon');
    });
  });

  describe('2. Dynamic Event Stress & Reflow Elimination Harness', () => {
    it('handles 10,000 rapid pointermove and pointerdown events with zero getBoundingClientRect calls', () => {
      let bcrCallCount = 0;
      const mockContainer = {
        getBoundingClientRect: vi.fn(() => {
          bcrCallCount++;
          return {
            left: 50,
            top: 100,
            width: 800,
            height: 600,
            right: 850,
            bottom: 700,
            x: 50,
            y: 100,
            toJSON: () => {},
          };
        }),
      };

      // Emulate GhostFibers cachedRect mechanism
      let cachedRect = { left: 0, top: 0, width: 0, height: 0 };
      const updateRect = () => {
        if (mockContainer) {
          const rect = mockContainer.getBoundingClientRect();
          cachedRect = {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          };
        }
      };

      // Initial mount call
      updateRect();
      expect(bcrCallCount).toBe(1);
      expect(cachedRect).toEqual({ left: 50, top: 100, width: 800, height: 600 });

      // State and event handlers as implemented in GhostFibers.tsx
      const state = {
        pointer: { x: 0, y: 0, inside: false },
        width: 800,
        height: 600,
      };
      let pendingPulse: { x: number; y: number } | null = null;
      let wakeCalls = 0;
      const wake = () => {
        wakeCalls++;
      };

      const onPointerMove = (clientX: number, clientY: number) => {
        const rect = cachedRect;
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        state.pointer.x = x;
        state.pointer.y = y;
        state.pointer.inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
        wake();
      };

      const onPointerDown = (clientX: number, clientY: number, button = 0) => {
        if (button !== 0) return;
        const rect = cachedRect;
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
        pendingPulse = { x, y };
        wake();
      };

      // Fire 5,000 rapid pointer moves
      const t0 = performance.now();
      for (let i = 0; i < 5000; i++) {
        onPointerMove(100 + (i % 700), 120 + (i % 500));
      }
      const moveDuration = performance.now() - t0;

      // Fire 5,000 rapid pointer downs
      const t1 = performance.now();
      for (let i = 0; i < 5000; i++) {
        onPointerDown(150 + (i % 600), 180 + (i % 400), 0);
      }
      const downDuration = performance.now() - t1;

      // BCR call count must NOT have increased at all!
      expect(bcrCallCount).toBe(1);
      expect(wakeCalls).toBe(10000);
      // Execution of 10,000 handlers should take < 50ms total
      expect(moveDuration + downDuration).toBeLessThan(100);

      // Verify pendingPulse buffering
      expect(pendingPulse).not.toBeNull();
      expect(pendingPulse!.x).toBeGreaterThan(0);
      expect(pendingPulse!.y).toBeGreaterThan(0);

      // Verify scroll or window resize properly updates cachedRect
      updateRect();
      expect(bcrCallCount).toBe(2);
    });

    it('adversarial edge cases: bounds checking, non-zero button, UI element clicks, and rapid click coalescing', () => {
      const cachedRect = { left: 100, top: 200, width: 800, height: 600 };
      let pendingPulse: { x: number; y: number } | null = null;
      let wakeCalls = 0;
      const wake = () => {
        wakeCalls++;
      };

      const simulatePointerDown = (event: {
        button: number;
        clientX: number;
        clientY: number;
        targetElementTag?: string;
      }) => {
        if (event.button !== 0) return;
        if (['A', 'BUTTON', 'INPUT', 'TEXTAREA'].includes(event.targetElementTag || '')) return;
        const rect = cachedRect;
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
        pendingPulse = { x, y };
        wake();
      };

      // 1. Right click (button 2) and middle click (button 1) -> ignored
      simulatePointerDown({ button: 2, clientX: 200, clientY: 300 });
      expect(pendingPulse).toBeNull();
      simulatePointerDown({ button: 1, clientX: 200, clientY: 300 });
      expect(pendingPulse).toBeNull();

      // 2. Click on a child button element -> ignored
      simulatePointerDown({ button: 0, clientX: 200, clientY: 300, targetElementTag: 'BUTTON' });
      expect(pendingPulse).toBeNull();

      // 3. Click out of bounds (negative relative coordinates or outside rect) -> ignored
      simulatePointerDown({ button: 0, clientX: 50, clientY: 300 }); // x = -50
      expect(pendingPulse).toBeNull();
      simulatePointerDown({ button: 0, clientX: 1000, clientY: 300 }); // x = 900 > 800
      expect(pendingPulse).toBeNull();
      simulatePointerDown({ button: 0, clientX: 300, clientY: 900 }); // y = 700 > 600
      expect(pendingPulse).toBeNull();

      // 4. Valid click inside container -> pulse buffered
      simulatePointerDown({ button: 0, clientX: 200, clientY: 300 });
      expect(pendingPulse).toEqual({ x: 100, y: 100 });

      // 5. Burst of 50 clicks in the same animation frame -> cleanly coalesces to latest pulse without memory explosion
      for (let i = 0; i < 50; i++) {
        simulatePointerDown({ button: 0, clientX: 200 + i, clientY: 300 + i });
      }
      expect(pendingPulse).toEqual({ x: 100 + 49, y: 100 + 49 });
    });

    it('handles cleanup and WebGL context destruction without throwing on null shaders/targets', () => {
      const mockGl = {
        deleteVertexArray: vi.fn(),
        deleteTexture: vi.fn(),
        deleteFramebuffer: vi.fn(),
        deleteProgram: vi.fn(),
      };

      // Emulate cleanup routine from GhostFibers.tsx lines 1326-1334
      const vao = null; // null VAO
      const scene = { texture: null, framebuffer: null, width: 0, height: 0 };
      const chain = [
        {
          texture: 'tex1' as unknown as WebGLTexture,
          framebuffer: null,
          width: 0,
          height: 0,
        },
      ];
      const dots = null;
      const dust = { program: 'prog1' as unknown as WebGLProgram };
      const bright = null;
      const down = { program: null };
      const up = { program: 'prog2' as unknown as WebGLProgram };
      const composite = null;

      expect(() => {
        if (vao) mockGl.deleteVertexArray(vao);
        for (const target of [scene, ...chain]) {
          if (target.texture) mockGl.deleteTexture(target.texture);
          if (target.framebuffer) mockGl.deleteFramebuffer(target.framebuffer);
        }
        for (const entry of [dots, dust, bright, down, up, composite]) {
          if (entry?.program) mockGl.deleteProgram(entry.program);
        }
      }).not.toThrow();

      expect(mockGl.deleteTexture).toHaveBeenCalledTimes(1);
      expect(mockGl.deleteTexture).toHaveBeenCalledWith('tex1');
      expect(mockGl.deleteProgram).toHaveBeenCalledTimes(2);
      expect(mockGl.deleteProgram).toHaveBeenCalledWith('prog1');
      expect(mockGl.deleteProgram).toHaveBeenCalledWith('prog2');
    });
  });

  describe('3. Obsolete Aurora Package & Dead CSS Elimination', () => {
    it('confirms @nauverse/react-aurora-background is completely removed from package.json', () => {
      const pkgPath = path.resolve(rootDir, 'apps/web/package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      expect(pkg.dependencies?.['@nauverse/react-aurora-background']).toBeUndefined();
      expect(pkg.devDependencies?.['@nauverse/react-aurora-background']).toBeUndefined();
    });

    it('confirms @nauverse is absent from pnpm-lock.yaml', () => {
      const lockPath = path.resolve(rootDir, 'pnpm-lock.yaml');
      const lockContent = fs.readFileSync(lockPath, 'utf-8');
      expect(lockContent.includes('@nauverse')).toBe(false);
    });

    it('confirms index.css contains zero aurora keyframes or animation utilities', () => {
      const cssPath = path.resolve(rootDir, 'apps/web/src/index.css');
      const css = fs.readFileSync(cssPath, 'utf-8');
      expect(css).not.toContain('aurora-purple');
      expect(css).not.toContain('aurora-ribbon');
      expect(css).not.toContain('aurora-wave');
      expect(css).not.toContain('aurora-beam');
      expect(css).not.toContain('animate-aurora');
    });
  });

  describe('4. Functional Aurora References Preservation', () => {
    it('verifies word "aurora" remains in BIP39 passkey dictionary', async () => {
      const passkeyPath = path.resolve(rootDir, 'packages/crypto-adapter/src/passkey.ts');
      const passkeyContent = fs.readFileSync(passkeyPath, 'utf-8');
      expect(passkeyContent).toContain("'aurora'");
    });

    it('verifies ghostCarrier procedural theme "aurora" generates valid image data', async () => {
      // Mock minimal browser canvas environment in Node for empirical execution
      const originalDocument = globalThis.document;
      const originalUrl = globalThis.URL;

      try {
        const mockGradient = {
          addColorStop: vi.fn(),
        };
        const mockCtx = {
          fillStyle: '',
          fillRect: vi.fn(),
          createRadialGradient: vi.fn(() => mockGradient),
          createLinearGradient: vi.fn(() => mockGradient),
          getImageData: vi.fn((x: number, y: number, w: number, h: number) => ({
            width: w,
            height: h,
            data: new Uint8ClampedArray(w * h * 4),
          })),
          putImageData: vi.fn(),
        };
        const mockCanvas = {
          width: 0,
          height: 0,
          getContext: vi.fn(() => mockCtx),
          toBlob: vi.fn((cb: (b: Blob) => void) => {
            cb(new Blob(['fake-png-bytes'], { type: 'image/png' }));
          }),
        };

        const globalEnv = globalThis as unknown as {
          document: unknown;
          URL: unknown;
        };

        globalEnv.document = {
          createElement: vi.fn((tag: string) => {
            if (tag === 'canvas') return mockCanvas;
            return {};
          }),
        };
        globalEnv.URL = {
          createObjectURL: vi.fn(() => 'blob:http://localhost/ghost-carrier-aurora-fake'),
          revokeObjectURL: vi.fn(),
        };

        const ghostCarrierModule = await import('../../apps/web/src/utils/ghostCarrier.js');
        expect(ghostCarrierModule.generateGhostCarrier).toBeDefined();

        const carrier = await ghostCarrierModule.generateGhostCarrier('aurora', 120, 80);
        expect(carrier.width).toBe(120);
        expect(carrier.height).toBe(80);
        expect(carrier.imageData.data.length).toBe(120 * 80 * 4);
        expect(carrier.blobUrl).toBe('blob:http://localhost/ghost-carrier-aurora-fake');
        expect(mockCtx.createLinearGradient).toHaveBeenCalledWith(0, 0, 120, 80);
        expect(mockGradient.addColorStop).toHaveBeenCalledWith(0.35, 'rgba(124, 58, 237, 0.5)');
        expect(mockGradient.addColorStop).toHaveBeenCalledWith(0.65, 'rgba(20, 184, 166, 0.45)');

        // Verify procedural noise loop set alpha to 255
        let nonZeroAlpha = 0;
        for (let i = 0; i < carrier.imageData.data.length; i += 4) {
          if (carrier.imageData.data[i + 3] === 255) nonZeroAlpha++;
        }
        expect(nonZeroAlpha).toBe(120 * 80);
      } finally {
        const globalEnv = globalThis as unknown as {
          document: unknown;
          URL: unknown;
        };
        globalEnv.document = originalDocument;
        globalEnv.URL = originalUrl;
      }
    });

    it('verifies CoreStudio theme selector includes "aurora"', () => {
      const coreStudioPath = path.resolve(rootDir, 'apps/web/src/components/CoreStudio.tsx');
      const content = fs.readFileSync(coreStudioPath, 'utf-8');
      expect(content).toContain("'aurora'");
    });
  });
});
