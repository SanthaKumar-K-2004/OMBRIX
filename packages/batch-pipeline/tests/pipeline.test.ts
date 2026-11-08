import type { CarrierImage } from '@ombrix/stego-interface';
import { describe, expect, it } from 'vitest';
import { executeBatchEmbed, executeBatchExtract } from '../src/pipeline.js';
import type { BatchEmbedTask, BatchExtractTask, BatchProgressEvent } from '../src/types.js';

function createDummyCarrier(width: number, height: number): CarrierImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 120; // R
    data[i + 1] = 130; // G
    data[i + 2] = 140; // B
    data[i + 3] = 255; // A
  }
  return { width, height, data };
}

describe('@ombrix/batch-pipeline - Execution Pipeline', () => {
  it('executes batch embedding and batch extraction across multiple carriers', async () => {
    const carrier1 = createDummyCarrier(40, 40);
    const carrier2 = createDummyCarrier(50, 50);
    const carrier3 = createDummyCarrier(60, 60);

    const payload1 = new TextEncoder().encode('Payload Alpha');
    const payload2 = new TextEncoder().encode('Payload Beta');
    const payload3 = new TextEncoder().encode('Payload Gamma');

    const tasks: BatchEmbedTask[] = [
      { id: '1', carrierName: 'c1.png', carrierImage: carrier1, payloadBytes: payload1 },
      { id: '2', carrierName: 'c2.png', carrierImage: carrier2, payloadBytes: payload2 },
      { id: '3', carrierName: 'c3.png', carrierImage: carrier3, payloadBytes: payload3 },
    ];

    const progressEvents: BatchProgressEvent[] = [];
    const embedResults = await executeBatchEmbed(tasks, {
      concurrency: 2,
      onProgress: (ev) => progressEvents.push(ev),
    });

    expect(embedResults).toHaveLength(3);
    expect(embedResults.every((r) => r.success)).toBe(true);
    expect(progressEvents.length).toBe(3);
    expect(progressEvents[2]?.percent).toBe(100);

    // Now extract
    const extractTasks: BatchExtractTask[] = embedResults.map((r) => ({
      id: r.id,
      carrierName: r.carrierName,
      stegoImage: r.stegoImage!,
    }));

    const extractResults = await executeBatchExtract(extractTasks, { concurrency: 2 });

    expect(extractResults).toHaveLength(3);
    expect(extractResults[0]?.payloadBytes).toBeDefined();
    expect(new TextDecoder().decode(extractResults[0]?.payloadBytes)).toBe('Payload Alpha');
    expect(new TextDecoder().decode(extractResults[1]?.payloadBytes)).toBe('Payload Beta');
    expect(new TextDecoder().decode(extractResults[2]?.payloadBytes)).toBe('Payload Gamma');
  });

  it('isolates errors gracefully when one carrier fails', async () => {
    const validCarrier = createDummyCarrier(40, 40);
    // Carrier with 0 dimensions will fail in embed
    const invalidCarrier: CarrierImage = {
      width: 0,
      height: 0,
      data: new Uint8ClampedArray(0),
    };

    const tasks: BatchEmbedTask[] = [
      {
        id: '1',
        carrierName: 'valid.png',
        carrierImage: validCarrier,
        payloadBytes: new Uint8Array([1, 2]),
      },
      {
        id: '2',
        carrierName: 'invalid.png',
        carrierImage: invalidCarrier,
        payloadBytes: new Uint8Array([1, 2]),
      },
    ];

    const results = await executeBatchEmbed(tasks, { concurrency: 1 });

    expect(results).toHaveLength(2);
    expect(results[0]?.success).toBe(true);
    expect(results[1]?.success).toBe(false);
    expect(results[1]?.error).toBeDefined();
  });
});
