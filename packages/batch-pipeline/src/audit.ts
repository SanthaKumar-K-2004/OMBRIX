import type { CarrierImage } from '@ombrix/stego-interface';
import type { BatchCapacityAudit, CarrierBatchItem } from './types.js';

export function calculateCarrierLsbCapacity(width: number, height: number): number {
  const totalChannels = width * height * 3; // 3 bits per pixel (R, G, B)
  const availableBits = totalChannels - 32; // 32 bits reserved for length header
  return Math.max(0, Math.floor(availableBits / 8));
}

export function auditCarrierItem(
  name: string,
  carrier: CarrierImage | { width: number; height: number; data?: Uint8ClampedArray },
  id: string,
): CarrierBatchItem {
  if (carrier.width <= 0 || carrier.height <= 0) {
    return {
      id,
      name,
      width: carrier.width,
      height: carrier.height,
      capacityBytes: 0,
      isValid: false,
      validationError: 'Invalid image dimensions (must be positive).',
    };
  }

  // Dimension and pixel count bounds check (e.g. max 8192px, max 16MP)
  if (carrier.width > 8192 || carrier.height > 8192) {
    return {
      id,
      name,
      width: carrier.width,
      height: carrier.height,
      capacityBytes: 0,
      isValid: false,
      validationError: 'Image exceeds maximum dimension limit of 8192px.',
    };
  }

  const pixelCount = carrier.width * carrier.height;
  if (pixelCount > 16777216) {
    return {
      id,
      name,
      width: carrier.width,
      height: carrier.height,
      capacityBytes: 0,
      isValid: false,
      validationError: 'Image exceeds maximum 16MP pixel count limit.',
    };
  }

  const capacityBytes = calculateCarrierLsbCapacity(carrier.width, carrier.height);
  const carrierImage: CarrierImage | undefined =
    carrier.data instanceof Uint8ClampedArray
      ? {
          width: carrier.width,
          height: carrier.height,
          data: carrier.data,
        }
      : undefined;

  return {
    id,
    name,
    carrierImage,
    width: carrier.width,
    height: carrier.height,
    capacityBytes,
    isValid: true,
  };
}

export function auditBatchCarriers(
  carriers: Array<{
    name: string;
    carrier: CarrierImage | { width: number; height: number; data?: Uint8ClampedArray };
  }>,
): BatchCapacityAudit {
  const items: CarrierBatchItem[] = [];
  let totalCapacity = 0;
  let validCount = 0;

  for (let i = 0; i < carriers.length; i++) {
    const entry = carriers[i];
    if (!entry) continue;
    const item = auditCarrierItem(entry.name, entry.carrier, `carrier-${i + 1}`);
    items.push(item);
    if (item.isValid) {
      validCount++;
      totalCapacity += item.capacityBytes;
    }
  }

  return {
    totalCarriers: items.length,
    validCarriers: validCount,
    totalCapacityBytes: totalCapacity,
    items,
  };
}
