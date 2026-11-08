import type { CarrierImage } from '@ombrix/stego-interface';

export interface CarrierBatchItem {
  readonly id: string;
  readonly name: string;
  readonly carrierBytes?: Uint8Array;
  readonly carrierImage?: CarrierImage;
  readonly width: number;
  readonly height: number;
  readonly capacityBytes: number;
  readonly isValid: boolean;
  readonly validationError?: string;
}

export interface BatchCapacityAudit {
  readonly totalCarriers: number;
  readonly validCarriers: number;
  readonly totalCapacityBytes: number;
  readonly items: readonly CarrierBatchItem[];
}

export interface BatchEmbedTask {
  readonly id: string;
  readonly carrierName: string;
  readonly carrierImage: CarrierImage;
  readonly payloadBytes: Uint8Array;
}

export interface BatchEmbedItemResult {
  readonly id: string;
  readonly carrierName: string;
  readonly stegoImage?: CarrierImage;
  readonly payloadSize: number;
  readonly durationMs: number;
  readonly success: boolean;
  readonly error?: string;
}

export interface BatchExtractTask {
  readonly id: string;
  readonly carrierName: string;
  readonly stegoImage: CarrierImage;
}

export interface BatchExtractItemResult {
  readonly id: string;
  readonly carrierName: string;
  readonly payloadBytes?: Uint8Array;
  readonly payloadSize: number;
  readonly durationMs: number;
  readonly success: boolean;
  readonly error?: string;
}

export interface BatchProgressEvent {
  readonly phase: 'auditing' | 'embedding' | 'extracting' | 'completed';
  readonly total: number;
  readonly current: number;
  readonly currentName: string;
  readonly percent: number;
  readonly successCount: number;
  readonly failureCount: number;
}

export interface BatchExecutionOptions {
  readonly concurrency?: number;
  readonly onProgress?: (event: BatchProgressEvent) => void;
  readonly signal?: AbortSignal;
}
