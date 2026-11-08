import { pngLsbSequential } from '@ombrix/stego-png-lsb';
import type {
  BatchEmbedItemResult,
  BatchEmbedTask,
  BatchExecutionOptions,
  BatchExtractItemResult,
  BatchExtractTask,
} from './types.js';

export async function executeBatchEmbed(
  tasks: readonly BatchEmbedTask[],
  options?: BatchExecutionOptions,
): Promise<BatchEmbedItemResult[]> {
  const results: BatchEmbedItemResult[] = [];
  const concurrency = Math.max(1, options?.concurrency ?? 2);
  let completedCount = 0;
  let successCount = 0;
  let failureCount = 0;

  // Process in chunks of size `concurrency`
  for (let i = 0; i < tasks.length; i += concurrency) {
    if (options?.signal?.aborted) {
      throw new Error('Batch embedding aborted by signal.');
    }

    const chunk = tasks.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async (task) => {
      const startTime = performance.now();
      try {
        const stegoImage = await pngLsbSequential.embed(task.carrierImage, task.payloadBytes);
        const durationMs = performance.now() - startTime;
        successCount++;
        return {
          id: task.id,
          carrierName: task.carrierName,
          stegoImage,
          payloadSize: task.payloadBytes.length,
          durationMs,
          success: true,
        };
      } catch (err) {
        const durationMs = performance.now() - startTime;
        failureCount++;
        return {
          id: task.id,
          carrierName: task.carrierName,
          payloadSize: task.payloadBytes.length,
          durationMs,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      } finally {
        completedCount++;
        if (options?.onProgress) {
          options.onProgress({
            phase: 'embedding',
            total: tasks.length,
            current: completedCount,
            currentName: task.carrierName,
            percent: Math.round((completedCount / tasks.length) * 100),
            successCount,
            failureCount,
          });
        }
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }

  return results;
}

export async function executeBatchExtract(
  tasks: readonly BatchExtractTask[],
  options?: BatchExecutionOptions,
): Promise<BatchExtractItemResult[]> {
  const results: BatchExtractItemResult[] = [];
  const concurrency = Math.max(1, options?.concurrency ?? 2);
  let completedCount = 0;
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < tasks.length; i += concurrency) {
    if (options?.signal?.aborted) {
      throw new Error('Batch extraction aborted by signal.');
    }

    const chunk = tasks.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async (task) => {
      const startTime = performance.now();
      try {
        const payloadBytes = await pngLsbSequential.extract(task.stegoImage);
        const durationMs = performance.now() - startTime;
        successCount++;
        return {
          id: task.id,
          carrierName: task.carrierName,
          payloadBytes,
          payloadSize: payloadBytes.length,
          durationMs,
          success: true,
        };
      } catch (err) {
        const durationMs = performance.now() - startTime;
        failureCount++;
        return {
          id: task.id,
          carrierName: task.carrierName,
          payloadSize: 0,
          durationMs,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      } finally {
        completedCount++;
        if (options?.onProgress) {
          options.onProgress({
            phase: 'extracting',
            total: tasks.length,
            current: completedCount,
            currentName: task.carrierName,
            percent: Math.round((completedCount / tasks.length) * 100),
            successCount,
            failureCount,
          });
        }
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }

  return results;
}
