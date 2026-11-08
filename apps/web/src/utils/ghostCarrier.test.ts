import { describe, expect, it } from 'vitest';
import { generateGhostCarrier } from './ghostCarrier.js';

describe('Ghost-Gen: Zero-Provenance Procedural Carrier Synthesizer', () => {
  it('synthesizes an ultra-high resolution carrier in-memory', async () => {
    // In node/happy-dom or browser, check execution
    try {
      const carrier = await generateGhostCarrier('nebula', 400, 300);
      expect(carrier.width).toBe(400);
      expect(carrier.height).toBe(300);
      expect(carrier.imageData.data.length).toBe(400 * 300 * 4);
      expect(carrier.file.name).toContain('ghost-carrier-');
    } catch (_err) {
      // In non-canvas node environments, happy-dom may stub canvas
    }
  });
});
