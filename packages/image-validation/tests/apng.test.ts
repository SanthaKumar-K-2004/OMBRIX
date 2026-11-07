import { describe, expect, it } from 'vitest';
import {
  AnimatedPngDetectedError,
  AnimatedPngNotSupportedError,
  validatePng,
  validatePngOrThrow,
} from '../src/index.js';
import { createApngVector } from './helpers/png-builder.js';

describe('apng test suite', () => {
  it('rejects acTL chunk before IDAT with AnimatedPngDetectedError', () => {
    const apng = createApngVector('acTL', 'before-idat');

    expect(() => validatePngOrThrow(apng)).toThrow(AnimatedPngDetectedError);
    expect(() => validatePngOrThrow(apng)).toThrow(AnimatedPngNotSupportedError);

    const res = validatePng(apng);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toBeInstanceOf(AnimatedPngDetectedError);
      expect(res.error.code).toBe('ANIMATED_PNG_DETECTED');
      expect(res.error.message).toContain('chunk "acTL"');
    }
  });

  it('rejects fcTL chunk before IDAT', () => {
    const apng = createApngVector('fcTL', 'before-idat');

    expect(() => validatePngOrThrow(apng)).toThrow(AnimatedPngDetectedError);

    const res = validatePng(apng);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toBeInstanceOf(AnimatedPngDetectedError);
      expect(res.error.message).toContain('chunk "fcTL"');
    }
  });

  it('rejects fcTL chunk after IDAT', () => {
    const apng = createApngVector('fcTL', 'after-idat');

    expect(() => validatePngOrThrow(apng)).toThrow(AnimatedPngDetectedError);

    const res = validatePng(apng);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toBeInstanceOf(AnimatedPngDetectedError);
    }
  });

  it('rejects fdAT chunk after IDAT', () => {
    const apng = createApngVector('fdAT', 'after-idat');

    expect(() => validatePngOrThrow(apng)).toThrow(AnimatedPngDetectedError);

    const res = validatePng(apng);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error).toBeInstanceOf(AnimatedPngDetectedError);
      expect(res.error.message).toContain('chunk "fdAT"');
    }
  });
});
