import { describe, expect, it } from 'vitest';
import { auditBatchCarriers, calculateCarrierLsbCapacity } from '../src/audit.js';

describe('@ombrix/batch-pipeline - Capacity Auditing', () => {
  it('calculates deterministic LSB capacity for dimensions', () => {
    // 100x100 = 10,000 pixels. 30,000 bits. Minus 32 bits = 29,968 bits / 8 = 3,746 bytes.
    const capacity = calculateCarrierLsbCapacity(100, 100);
    expect(capacity).toBe(3746);
  });

  it('audits batch of heterogeneous carriers correctly', () => {
    const carriers = [
      { name: 'small.png', carrier: { width: 50, height: 50 } },
      { name: 'medium.png', carrier: { width: 200, height: 200 } },
      { name: 'invalid-zero.png', carrier: { width: 0, height: 100 } },
      { name: 'invalid-huge.png', carrier: { width: 10000, height: 10000 } },
    ];

    const audit = auditBatchCarriers(carriers);

    expect(audit.totalCarriers).toBe(4);
    expect(audit.validCarriers).toBe(2);
    expect(audit.items[0]?.isValid).toBe(true);
    expect(audit.items[1]?.isValid).toBe(true);
    expect(audit.items[2]?.isValid).toBe(false);
    expect(audit.items[3]?.isValid).toBe(false);

    expect(audit.totalCapacityBytes).toBe(
      calculateCarrierLsbCapacity(50, 50) + calculateCarrierLsbCapacity(200, 200),
    );
  });
});
